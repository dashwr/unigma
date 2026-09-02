/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { createServer, type Server, type ServerResponse } from 'node:http';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OpenCodeHttpClient, SUPPORTED_OPENCODE_VERSION, type OpenCodeEvent } from '../infrastructure/openCodeHttpClient';
import type { DiagnosticRecord, OwnedProcessHandle } from '../domain/runtime';

const workspacePath = process.platform === 'win32' ? 'C:\\unigma-workspace' : '/tmp/unigma-workspace';
const workspaceUri = pathToFileURL(workspacePath).toString();

const requiredOperations = [
	['GET', '/global/health'],
	['GET', '/path'],
	['GET', '/event'],
	['GET', '/session'],
	['POST', '/session'],
	['GET', '/session/status'],
	['GET', '/session/{sessionID}'],
	['GET', '/session/{sessionID}/message'],
	['POST', '/session/{sessionID}/prompt_async'],
	['POST', '/session/{sessionID}/abort'],
	['GET', '/session/{sessionID}/diff'],
	['POST', '/session/{sessionID}/permissions/{permissionID}'],
	['GET', '/provider'],
	['GET', '/config/providers'],
] as const;

function documentFor(missingOperation?: readonly [string, string]): Record<string, unknown> {
	const paths: Record<string, Record<string, unknown>> = {};
	for (const [method, path] of requiredOperations) {
		if (missingOperation?.[0] === method && missingOperation[1] === path) {
			continue;
		}

		const pathItem = paths[path] ?? {};
		pathItem[method.toLowerCase()] = {};
		paths[path] = pathItem;
	}

	return { openapi: '3.1.0', paths };
}

interface FixtureOptions {
	readonly document?: Record<string, unknown>;
	readonly healthVersion?: string;
	readonly workspacePath?: string;
	readonly workspaceResponse?: unknown;
	readonly providerPaddingBytes?: number;
	readonly onEvent?: (response: ServerResponse, index: number) => void;
}

interface Fixture {
	readonly server: Server;
	readonly endpoint: string;
	readonly requests: Array<{ method: string; path: string; headers: Record<string, string | string[] | undefined> }>;
	readonly eventResponses: ServerResponse[];
	readonly close: () => Promise<void>;
}

async function createFixture(options: FixtureOptions = {}): Promise<Fixture> {
	const requests: Fixture['requests'] = [];
	const eventResponses: ServerResponse[] = [];
	const server = createServer((request, response) => {
		const requestPath = request.url?.split('?')[0] ?? '/';
		requests.push({ method: request.method ?? 'GET', path: request.url ?? '/', headers: request.headers });
		request.resume();

		if (requestPath === '/global/health') {
			return json(response, { healthy: true, version: options.healthVersion ?? SUPPORTED_OPENCODE_VERSION });
		}
		if (requestPath === '/doc') {
			return json(response, options.document ?? documentFor());
		}
		if (requestPath === '/path') {
			return json(response, options.workspaceResponse ?? { path: options.workspacePath ?? workspacePath });
		}
		if (requestPath === '/event') {
			response.writeHead(200, { 'content-type': 'text/event-stream', connection: 'keep-alive' });
			eventResponses.push(response);
			response.write('data: {"type":"server.connected","properties":{}}\n\n');
			options.onEvent?.(response, eventResponses.length - 1);
			return;
		}
		if (requestPath === '/session' && request.method === 'GET') {
			return json(response, [{ id: 'session-one' }]);
		}
		if (requestPath === '/session/status' && request.method === 'GET') {
			return json(response, { 'session-one': { type: 'idle' } });
		}
		if (/^\/session\/[^/]+\/message$/.test(requestPath) && request.method === 'GET') {
			return json(response, []);
		}
		if (/^\/session\/[^/]+\/diff$/.test(requestPath) && request.method === 'GET') {
			return json(response, []);
		}
		if (request.method === 'POST' && (/^\/session\/[^/]+\/prompt_async$/.test(requestPath) || requestPath === '/session')) {
			return json(response, { ok: true });
		}
		if (requestPath === '/provider' && options.providerPaddingBytes) {
			return json(response, { providers: [], padding: 'x'.repeat(options.providerPaddingBytes) });
		}
		if (requestPath.startsWith('/session/') || requestPath === '/provider' || requestPath === '/config/providers') {
			return json(response, {});
		}

		response.writeHead(404);
		response.end();
	});

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('Fixture did not expose a TCP address.');
	}

	return {
		server,
		endpoint: `http://127.0.0.1:${address.port}`,
		requests,
		eventResponses,
		close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
	};
}

function json(response: ServerResponse, value: unknown): void {
	response.writeHead(200, { 'content-type': 'application/json' });
	response.end(JSON.stringify(value));
}

function processFor(endpoint: string): OwnedProcessHandle {
	return {
		owner: 'unigma-agent-runtime',
		id: 'fixture-process',
		pid: 1234,
		endpoint,
		workspaceUri,
	};
}

function diagnostics(): { records: DiagnosticRecord[]; sink: { record(record: DiagnosticRecord): void } } {
	const records: DiagnosticRecord[] = [];
	return { records, sink: { record: record => records.push(record) } };
}

async function waitFor(condition: () => boolean): Promise<void> {
	const deadline = Date.now() + 1000;
	while (!condition() && Date.now() < deadline) {
		await new Promise(resolve => setTimeout(resolve, 5));
	}
	assert.ok(condition(), 'fixture condition was not reached');
}

suite('Unigma OpenCode HTTP/SSE client', () => {
	test('probes the documented profile, emits events, and blocks other endpoints', async () => {
		const fixture = await createFixture();
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });
		const events: OpenCodeEvent[] = [];
		client.onEvent(event => events.push(event));

		try {
			await client.connect(processFor(fixture.endpoint));
			assert.strictEqual(events[0].type, 'server.connected');
			await client.send({ method: 'POST', path: '/session/session-one/prompt_async', body: { parts: [] } });
			await assert.rejects(client.send({ method: 'GET', path: '/not-in-profile' }), /outside the MVP profile/);
			assert.deepStrictEqual(
				fixture.requests.slice(0, 4).map(request => `${request.method} ${request.path}`),
				['GET /global/health', 'GET /doc', 'GET /path', 'GET /event'],
			);
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('fails closed for an unsupported OpenCode version', async () => {
		const fixture = await createFixture({ healthVersion: '1.18.24' });
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });

		try {
			await assert.rejects(client.connect(processFor(fixture.endpoint)), /Unsupported OpenCode version: 1\.18\.24/);
			assert.ok(!fixture.requests.some(request => request.path === '/doc'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('diagnoses unknown events and stops on malformed envelopes without payload logging', async () => {
		const captured = diagnostics();
		const fixture = await createFixture();
		const client = new OpenCodeHttpClient({ diagnostics: captured.sink, requestTimeoutMs: 500, startupTimeoutMs: 1000 });
		const events: OpenCodeEvent[] = [];
		client.onEvent(event => events.push(event));

		try {
			await client.connect(processFor(fixture.endpoint));
			fixture.eventResponses[0].write('data: {"type":"future.event","properties":{"secret":"hidden"}}\n\n');
			fixture.eventResponses[0].write('data: {"type":"session.status","properties":[]}\n\n');
			await waitFor(() => captured.records.some(record => record.code === 'opencode.event.unknown') && captured.records.some(record => record.code === 'opencode.event.invalid'));
			assert.ok(captured.records.every(record => !JSON.stringify(record).includes('hidden')));
			assert.strictEqual(events.filter(event => event.type === 'session.status').length, 0);
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('preserves case when validating workspace paths on case-sensitive platforms', async () => {
		if (process.platform === 'win32') {
			return;
		}

		const fixture = await createFixture({ workspacePath: '/tmp/Unigma-workspace' });
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });

		try {
			await assert.rejects(client.connect(processFor(fixture.endpoint)), /does not match the authorized workspace/);
			assert.ok(!fixture.requests.some(request => request.path === '/event'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('accepts OpenCode directory and worktree path fields', async () => {
		const fixture = await createFixture({ workspaceResponse: { directory: workspacePath, worktree: workspacePath } });
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });

		try {
			await client.connect(processFor(fixture.endpoint));
			assert.ok(fixture.requests.some(request => request.path === '/path'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('uses directory as the workspace authority when worktree is a parent directory', async () => {
		const fixture = await createFixture({ workspaceResponse: { directory: workspacePath, worktree: path.parse(workspacePath).root } });
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });

		try {
			await client.connect(processFor(fixture.endpoint));
			assert.ok(fixture.requests.some(request => request.path === '/event'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('requires every documented operation, including methods', async () => {
		const fixture = await createFixture({ document: documentFor(['POST', '/session']) });
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });

		try {
			await assert.rejects(client.connect(processFor(fixture.endpoint)), /missing a required operation: POST \/session/);
			assert.ok(!fixture.requests.some(request => request.path === '/event'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('accepts a required response larger than the SSE event guard', async function () {
		/*
		 * OpenCode 1.18.23 answers `GET /provider` with more than 5 MiB on a bare
		 * workspace, so the HTTP guard must not reject a required operation.
		 */
		this.timeout(20_000);
		const fixture = await createFixture({ providerPaddingBytes: 6 * 1024 * 1024 });
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 15_000, startupTimeoutMs: 1000 });

		try {
			await client.connect(processFor(fixture.endpoint));
			const providers = await client.send({ method: 'GET', path: '/provider' });
			assert.ok(providers && typeof providers === 'object');
			await client.send({ method: 'GET', path: '/provider?directory=%2Ftmp%2Funigma-workspace' });
			assert.ok(fixture.requests.some(request => request.path === '/provider?directory=%2Ftmp%2Funigma-workspace'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('reconnects once and reloads session state without Last-Event-ID', async () => {
		const fixture = await createFixture();
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 500, startupTimeoutMs: 1000 });

		try {
			await client.connect(processFor(fixture.endpoint));
			fixture.eventResponses[0].end();
			await waitFor(() => fixture.eventResponses.length === 2 && fixture.requests.some(request => request.path === '/session/session-one/message'));
			assert.ok(fixture.requests.filter(request => request.path === '/event').every(request => request.headers['last-event-id'] === undefined));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('performs periodic health checks after connection', async () => {
		const fixture = await createFixture();
		const captured = diagnostics();
		const client = new OpenCodeHttpClient({
			diagnostics: captured.sink,
			requestTimeoutMs: 500,
			startupTimeoutMs: 1000,
			healthCheckIntervalMs: 20,
		});

		try {
			await client.connect(processFor(fixture.endpoint));
			// Wait for at least one health check
			await waitFor(() => fixture.requests.filter(request => request.path === '/global/health').length >= 2);
			const healthRequests = fixture.requests.filter(request => request.path === '/global/health');
			assert.ok(healthRequests.length >= 2, `Expected at least 2 health requests, got ${healthRequests.length}`);
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});

	test('diagnoses unhealthy server during periodic health check', async () => {
		const fixture = await createFixture();
		const captured = diagnostics();
		const client = new OpenCodeHttpClient({
			diagnostics: captured.sink,
			requestTimeoutMs: 500,
			startupTimeoutMs: 1000,
			healthCheckIntervalMs: 20,
		});

		try {
			await client.connect(processFor(fixture.endpoint));
			// Override health response to return unhealthy
			const originalHandler = fixture.server.listeners('request')[0];
			fixture.server.removeAllListeners('request');
			fixture.server.on('request', (request, response) => {
				if (request.url?.split('?')[0] === '/global/health') {
					return json(response, { healthy: false, version: 'fixture-0.1' });
				}
				originalHandler.call(fixture.server, request, response);
			});

			await waitFor(() => captured.records.some(record => record.code === 'opencode.health.unhealthy'));
			assert.ok(captured.records.some(record => record.code === 'opencode.health.unhealthy'));
		} finally {
			await client.disconnect();
			await fixture.close();
		}
	});
});
