/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { request as httpRequest, type ClientRequest, type IncomingMessage } from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DisposableLike, OwnedProcessHandle, WorkspaceReference } from '../domain/runtime';
import type { DiagnosticSink, OpenCodeClient, OpenCodeEvent, OpenCodeRequest } from '../application/runtimePorts';

export type { OpenCodeEvent, OpenCodeRequest } from '../application/runtimePorts';
export type OpenCodeHttpMethod = OpenCodeRequest['method'];

export interface OpenCodeHttpClientOptions {
	readonly requestTimeoutMs?: number;
	readonly startupTimeoutMs?: number;
	readonly healthCheckIntervalMs?: number;
	readonly diagnostics?: DiagnosticSink;
	readonly sleep?: (milliseconds: number) => Promise<void>;
}

const REQUIRED_OPERATIONS = [
	{ method: 'GET', path: '/global/health' },
	{ method: 'GET', path: '/path' },
	{ method: 'GET', path: '/event' },
	{ method: 'GET', path: '/session' },
	{ method: 'POST', path: '/session' },
	{ method: 'GET', path: '/session/status' },
	{ method: 'GET', path: '/session/{}' },
	{ method: 'GET', path: '/session/{}/message' },
	{ method: 'POST', path: '/session/{}/prompt_async' },
	{ method: 'POST', path: '/session/{}/abort' },
	{ method: 'GET', path: '/session/{}/diff' },
	{ method: 'POST', path: '/session/{}/permissions/{}' },
	{ method: 'GET', path: '/provider' },
	{ method: 'GET', path: '/config/providers' },
] as const;

interface DocumentOperation {
	readonly method: OpenCodeHttpMethod;
	readonly template: string;
	readonly matcher: RegExp;
}

const KNOWN_EVENT_TYPES = new Set([
	'server.connected',
	'session.created',
	'session.updated',
	'session.deleted',
	'session.status',
	'session.idle',
	'session.error',
	'message.updated',
	'message.part.updated',
	'message.part.removed',
	'session.diff',
	'permission.updated',
	'permission.replied',
]);

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedDocumentPath(value: string): string {
	return value.replace(/\{[^}]+\}/g, '{}');
}

function escapedRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function documentPathMatcher(template: string): RegExp {
	const expression = template
		.split(/(\{[^}]+\})/g)
		.map(part => part.startsWith('{') && part.endsWith('}') ? '[^/]+' : escapedRegex(part))
		.join('');
	return new RegExp(`^${expression}$`);
}

function errorCode(error: unknown): string | undefined {
	return isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
}

function isRetryableConnectionError(error: unknown): boolean {
	return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(errorCode(error) ?? '');
}

function eventFromPayload(payload: unknown): OpenCodeEvent {
	if (!isRecord(payload) || typeof payload.type !== 'string' || !isRecord(payload.properties)) {
		throw new Error('OpenCode event has an invalid envelope.');
	}

	return { type: payload.type, properties: payload.properties };
}

/** HTTP/SSE adapter for the documented loopback OpenCode profile. */
export class OpenCodeHttpClient implements OpenCodeClient<OpenCodeRequest, OpenCodeEvent> {
	private readonly requestTimeoutMs: number;
	private readonly startupTimeoutMs: number;
	private readonly healthCheckIntervalMs: number;
	private readonly diagnostics: DiagnosticSink | undefined;
	private readonly sleep: (milliseconds: number) => Promise<void>;
	private readonly listeners = new Set<(event: OpenCodeEvent) => void>();
	private endpoint: URL | undefined;
	private process: OwnedProcessHandle | undefined;
	private eventRequest: ClientRequest | undefined;
	private eventResponse: IncomingMessage | undefined;
	private eventBuffer = '';
	private eventData: string[] = [];
	private reconnectTimer: NodeJS.Timeout | undefined;
	private reconnectAttempted = false;
	private disconnecting = false;
	private connected = false;
	private connectionResolve: (() => void) | undefined;
	private connectionReject: ((error: Error) => void) | undefined;
	private documentOperations: readonly DocumentOperation[] = [];
	private healthCheckTimer: NodeJS.Timeout | undefined;

	public constructor(options: OpenCodeHttpClientOptions = {}) {
		this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
		this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
		this.diagnostics = options.diagnostics;
		this.sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	}

	public async connect(process: OwnedProcessHandle): Promise<void> {
		if (this.connected && this.process?.id === process.id) {
			return;
		}

		if (this.endpoint || this.process || this.eventRequest || this.eventResponse) {
			await this.disconnect();
		}

		const endpoint = new URL(process.endpoint);
		if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password) {
			throw new Error('OpenCode endpoint must use HTTP on 127.0.0.1.');
		}

		this.endpoint = endpoint;
		this.process = process;
		this.disconnecting = false;
		this.reconnectAttempted = false;
		try {
			const deadline = Date.now() + this.startupTimeoutMs;
			await this.waitForHealthy(deadline);
			this.validateDocument(await this.requestJson('/doc'));
			this.validateWorkspacePath(await this.requestJson('/path'), process.workspaceUri);
			await this.waitForServerConnected(Math.max(1, deadline - Date.now()));
			this.connected = true;
			this.startHealthCheck();
		} catch (error) {
			await this.disconnect();
			throw error;
		}
	}

	public send(request: OpenCodeRequest): Promise<unknown> {
		if (!this.endpoint || !this.connected) {
			return Promise.reject(new Error('OpenCode client is not connected.'));
		}

		if (!this.documentOperations.some(operation => operation.method === request.method && operation.matcher.test(request.path))) {
			return Promise.reject(new Error(`OpenCode endpoint is outside the MVP profile: ${request.path}`));
		}

		return this.requestJson(request.path, request.method, request.body);
	}

	public onEvent(listener: (event: OpenCodeEvent) => void): DisposableLike {
		this.listeners.add(listener);
		return {
			dispose: () => this.listeners.delete(listener),
		};
	}

	public async disconnect(): Promise<void> {
		this.disconnecting = true;
		this.connected = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
		this.stopHealthCheck();

		this.connectionReject?.(new Error('OpenCode client disconnected.'));
		this.connectionResolve = undefined;
		this.connectionReject = undefined;
		this.eventRequest?.destroy();
		this.eventResponse?.destroy();
		this.eventRequest = undefined;
		this.eventResponse = undefined;
		this.endpoint = undefined;
		this.process = undefined;
		this.eventBuffer = '';
		this.eventData = [];
		this.documentOperations = [];
	}

	private async waitForHealthy(deadline: number): Promise<void> {
		let lastError: unknown;
		while (Date.now() < deadline) {
			try {
				const health = await this.requestJson('/global/health');
				if (!isRecord(health) || health.healthy !== true || typeof health.version !== 'string' || health.version.length === 0) {
					throw new Error('OpenCode health response is invalid.');
				}
				return;
			} catch (error) {
				lastError = error;
				if (!isRetryableConnectionError(error)) {
					throw error;
				}
				await this.sleep(Math.min(250, Math.max(1, deadline - Date.now())));
			}
		}

		throw new Error(`OpenCode health probe timed out: ${errorCode(lastError) ?? 'unavailable'}.`);
	}

	private validateDocument(document: unknown): void {
		if (!isRecord(document) || typeof document.openapi !== 'string' || !/^3\.1(?:\.\d+)?$/.test(document.openapi) || !isRecord(document.paths)) {
			throw new Error('OpenCode document is not an OpenAPI 3.1 document.');
		}

		const operations: DocumentOperation[] = [];
		for (const [rawPath, pathItem] of Object.entries(document.paths)) {
			if (!isRecord(pathItem)) {
				continue;
			}

			const template = normalizedDocumentPath(rawPath);
			for (const method of ['GET', 'POST'] as const) {
				if (isRecord(pathItem[method.toLowerCase()])) {
					operations.push({ method, template, matcher: documentPathMatcher(rawPath) });
				}
			}
		}

		const missing = REQUIRED_OPERATIONS.filter(required => !operations.some(operation => operation.method === required.method && operation.template === required.path));
		if (missing.length > 0) {
			throw new Error(`OpenCode document is missing a required operation: ${missing[0].method} ${missing[0].path}`);
		}

		this.documentOperations = operations.filter(operation => REQUIRED_OPERATIONS.some(required => required.method === operation.method && required.path === operation.template));
	}

	private validateWorkspacePath(response: unknown, workspaceUri: string): void {
		if (!isRecord(response)) {
			throw new Error('OpenCode path response is invalid.');
		}
		const directory = response.directory;
		const pathValue = response.path;
		const worktree = response.worktree;
		const authoritativePath = typeof directory === 'string' && directory.length > 0
			? directory
			: typeof pathValue === 'string' && pathValue.length > 0
				? pathValue
				: typeof worktree === 'string' && worktree.length > 0
					? worktree
					: undefined;
		if (!authoritativePath) {
			throw new Error('OpenCode path response is invalid.');
		}

		const expected = new URL(workspaceUri);
		if (expected.protocol !== 'file:') {
			throw new Error('Workspace reference is not a local file URI.');
		}

		const expectedPath = this.normalizeFilesystemPath(fileURLToPath(expected));
		if (this.normalizeFilesystemPath(authoritativePath) !== expectedPath) {
			throw new Error('OpenCode path does not match the authorized workspace.');
		}
	}

	private normalizeFilesystemPath(value: string): string {
		const normalized = path.normalize(value).replaceAll('\\', '/');
		const withoutTrailingSeparator = normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
		return process.platform === 'win32' ? withoutTrailingSeparator.toLowerCase() : withoutTrailingSeparator;
	}

	private waitForServerConnected(milliseconds: number): Promise<void> {
		const connected = new Promise<void>((resolve, reject) => {
			this.connectionResolve = resolve;
			this.connectionReject = reject;
		});
		this.openEventStream();
		return this.withTimeout(connected, milliseconds, 'OpenCode event stream did not send server.connected.').finally(() => {
			this.connectionResolve = undefined;
			this.connectionReject = undefined;
		});
	}

	private openEventStream(): void {
		if (!this.endpoint || this.disconnecting) {
			return;
		}

		const url = new URL('/event', this.endpoint);
		const request = httpRequest(url, {
			method: 'GET',
			headers: { accept: 'text/event-stream' },
		});
		this.eventRequest = request;
		request.once('error', error => {
			this.eventRequest = undefined;
			if (!this.disconnecting) {
				this.connected = false;
				this.rejectConnection(new Error(`OpenCode event stream failed: ${error.message}`));
				this.scheduleReconnect();
			}
		});
		request.once('response', response => {
			this.eventResponse = response;
			if (response.statusCode !== 200) {
				response.resume();
				this.eventRequest = undefined;
				this.eventResponse = undefined;
				this.connected = false;
				this.rejectConnection(new Error(`OpenCode event stream returned HTTP ${response.statusCode ?? 'unknown'}.`));
				return;
			}

			response.setEncoding('utf8');
			response.on('data', chunk => this.consumeSseChunk(chunk));
			response.once('end', () => {
				this.eventResponse = undefined;
				this.eventRequest = undefined;
				if (!this.disconnecting) {
					this.connected = false;
					this.scheduleReconnect();
				}
			});
			response.once('error', error => {
				if (!this.disconnecting) {
					this.connected = false;
					this.connectionReject?.(new Error(`OpenCode event stream failed: ${error.message}`));
					this.scheduleReconnect();
				}
			});
		});
		request.end();
	}

	private consumeSseChunk(chunk: string): void {
		this.eventBuffer += chunk;
		if (Buffer.byteLength(this.eventBuffer) > MAX_RESPONSE_BYTES) {
			this.failEventStream(new Error('OpenCode event is too large.'));
			return;
		}
		const lines = this.eventBuffer.split(/\r?\n/);
		this.eventBuffer = lines.pop() ?? '';
		for (const line of lines) {
			if (line.startsWith('data:')) {
				this.eventData.push(line.slice('data:'.length).trimStart());
			} else if (line === '') {
				this.consumeSseEvent();
			}
		}
	}

	private consumeSseEvent(): void {
		if (this.eventData.length === 0) {
			return;
		}

		const data = this.eventData.join('\n');
		this.eventData = [];
		let event: OpenCodeEvent;
		try {
			event = eventFromPayload(JSON.parse(data) as unknown);
		} catch (error) {
			this.diagnostics?.record({ level: 'error', code: 'opencode.event.invalid' });
			this.failEventStream(error instanceof Error ? error : new Error('OpenCode event is invalid.'));
			return;
		}

		if (!KNOWN_EVENT_TYPES.has(event.type)) {
			this.diagnostics?.record({ level: 'debug', code: 'opencode.event.unknown' });
			return;
		}

		if (event.type === 'server.connected') {
			this.connected = true;
			this.reconnectAttempted = false;
			const resolve = this.connectionResolve;
			this.connectionResolve = undefined;
			this.connectionReject = undefined;
			resolve?.();
		}

		for (const listener of this.listeners) {
			listener(event);
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer || this.disconnecting || this.reconnectAttempted) {
			return;
		}

		this.reconnectAttempted = true;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined;
			void this.reconnectEventStream();
		}, 0);
	}

	private async reconnectEventStream(): Promise<void> {
		try {
			this.connected = false;
			const sessions = await this.requestJson('/session');
			await this.requestJson('/session/status');
			for (const sessionId of sessionIds(sessions)) {
				await this.requestJson(`/session/${encodeURIComponent(sessionId)}/message`);
				await this.requestJson(`/session/${encodeURIComponent(sessionId)}/diff`);
			}
			await this.waitForServerConnected(this.startupTimeoutMs);
		} catch {
			this.connected = false;
			this.disconnecting = true;
			this.diagnostics?.record({ level: 'warn', code: 'opencode.event.reconnect.failed' });
		}
	}

	private rejectConnection(error: Error): void {
		const reject = this.connectionReject;
		this.connectionResolve = undefined;
		this.connectionReject = undefined;
		reject?.(error);
	}

	private failEventStream(error: Error): void {
		this.connected = false;
		this.disconnecting = true;
		this.eventRequest?.destroy();
		this.eventResponse?.destroy();
		this.eventRequest = undefined;
		this.eventResponse = undefined;
		this.rejectConnection(error);
	}

	private startHealthCheck(): void {
		this.stopHealthCheck();
		if (this.healthCheckIntervalMs <= 0 || !this.endpoint) {
			return;
		}
		this.healthCheckTimer = setInterval(() => {
			if (!this.connected || this.disconnecting || !this.endpoint) {
				return;
			}
			void this.performHealthCheck();
		}, this.healthCheckIntervalMs);
	}

	private stopHealthCheck(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = undefined;
		}
	}

	private async performHealthCheck(): Promise<void> {
		if (!this.endpoint || this.disconnecting) {
			return;
		}
		try {
			const health = await this.requestJson('/global/health');
			if (!isRecord(health) || health.healthy !== true) {
				this.diagnostics?.record({ level: 'warn', code: 'opencode.health.unhealthy' });
			}
		} catch (error) {
			if (this.disconnecting) {
				return;
			}
			if (isRetryableConnectionError(error)) {
				this.diagnostics?.record({ level: 'warn', code: 'opencode.health.connectionLost' });
				this.connected = false;
				this.stopHealthCheck();
				this.scheduleReconnect();
			} else {
				this.diagnostics?.record({ level: 'error', code: 'opencode.health.failed' });
			}
		}
	}

	private requestJson(path: string, method: OpenCodeHttpMethod = 'GET', body?: unknown): Promise<unknown> {
		if (!this.endpoint) {
			return Promise.reject(new Error('OpenCode endpoint is not configured.'));
		}

		const url = new URL(path, this.endpoint);
		return new Promise((resolve, reject) => {
			const request = httpRequest(url, {
				method,
				timeout: this.requestTimeoutMs,
				headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			}, response => this.readResponse(response, path, method, resolve, reject));

			request.once('timeout', () => {
				const timeout = Object.assign(new Error('OpenCode HTTP request timed out.'), { code: 'ETIMEDOUT' });
				request.destroy(timeout);
			});
			request.once('error', reject);
			if (body !== undefined) {
				request.write(JSON.stringify(body));
			}
			request.end();
		});
	}

	private readResponse(
		response: IncomingMessage,
		path: string,
		method: OpenCodeHttpMethod,
		resolve: (value: unknown) => void,
		reject: (reason?: unknown) => void,
	): void {
		let bytes = 0;
		const chunks: string[] = [];
		response.setEncoding('utf8');
		response.on('data', chunk => {
			bytes += Buffer.byteLength(chunk);
			if (bytes > MAX_RESPONSE_BYTES) {
				response.destroy(new Error('OpenCode response is too large.'));
				return;
			}
			chunks.push(chunk);
		});
		response.once('error', reject);
		response.once('end', () => {
			if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
				reject(new Error(`OpenCode request failed: ${method} ${path} (HTTP ${response.statusCode ?? 'unknown'}).`));
				return;
			}

			const text = chunks.join('');
			if (text.length === 0) {
				resolve(undefined);
				return;
			}

			try {
				resolve(JSON.parse(text) as unknown);
			} catch {
				reject(new Error(`OpenCode response was not valid JSON: ${method} ${path}.`));
			}
		});
	}

	private withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
			promise.then(value => {
				clearTimeout(timeout);
				resolve(value);
			}, error => {
				clearTimeout(timeout);
				reject(error);
			});
		});
	}
}

export function workspacePathReference(workspace: WorkspaceReference): string {
	const url = new URL(workspace.uri);
	if (url.protocol !== 'file:') {
		throw new Error('Workspace reference is not a local file URI.');
	}
	return fileURLToPath(url);
}

function sessionIds(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const ids = new Set<string>();
	for (const entry of value) {
		if (!isRecord(entry)) {
			continue;
		}

		const id = typeof entry.id === 'string' ? entry.id : typeof entry.sessionID === 'string' ? entry.sessionID : undefined;
		if (id) {
			ids.add(id);
		}
	}
	return [...ids];
}
