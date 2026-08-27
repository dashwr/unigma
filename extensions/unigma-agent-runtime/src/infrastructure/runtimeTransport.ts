/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike, OwnedProcessHandle, WorkspaceReference } from '../domain/runtime';
import type { OpenCodeEvent, RuntimePorts } from '../application/runtimePorts';
import {
	TRANSPORT_PROTOCOL_VERSION,
	TransportCommandType,
	TransportErrorCode,
	TransportEventType,
	TransportSessionState,
	isTransportLocalIntegrationPreflight,
	validateTransportEvent,
	validateTransportCommand,
	type RuntimeTransport,
	type TransportCommand,
	type TransportDiffFile,
	type TransportEvent,
} from '../application/transport';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestIdFor(value: unknown): string | undefined {
	return isRecord(value) && typeof value.requestId === 'string' && value.requestId.length > 0 ? value.requestId : undefined;
}

/**
 * Bridges the workbench protocol to OpenCode HTTP calls via RuntimePorts.
 * Each command is translated to the appropriate HTTP request; SSE events
 * are translated to workbench events.
 */
export class RuntimeTransportBridge implements RuntimeTransport {
	private readonly ports: RuntimePorts;
	private readonly listeners = new Set<(event: TransportEvent) => void>();
	private readonly knownSessionWorkspaces = new Map<string, string>();
	private readonly knownRequestIds = new Set<string>();
	private readonly eventSubscription: DisposableLike | undefined;
	private process: OwnedProcessHandle | undefined;
	private disposed = false;
	private teardownPromise: Promise<void> | undefined;

	public constructor(ports: RuntimePorts) {
		this.ports = ports;
		this.eventSubscription = ports.openCodeClient.onEvent(event => this.handleOpenCodeEvent(event));
	}

	public onEvent(listener: (event: TransportEvent) => void): DisposableLike {
		this.listeners.add(listener);
		return { dispose: () => this.listeners.delete(listener) };
	}

	public async send(command: TransportCommand): Promise<void> {
		if (this.disposed) {
			return;
		}
		const validation = validateTransportCommand(command);
		if (!validation.valid) {
			this.emitError(requestIdFor(command), validation.error.code, validation.error.message, false);
			return;
		}
		const validCommand = validation.value;
		if (this.knownRequestIds.has(validCommand.requestId)) {
			this.emitError(validCommand.requestId, TransportErrorCode.DuplicateRequestId, 'This request was already handled.', false);
			return;
		}
		this.knownRequestIds.add(validCommand.requestId);

		switch (validCommand.type) {
			case TransportCommandType.StartSession:
				return this.handleStartSession(validCommand.requestId, validCommand.sessionId, validCommand.workspaceUri, validCommand.localIntegrationPreflight);
			case TransportCommandType.StopSession:
				return this.handleStopSession(validCommand.requestId, validCommand.sessionId);
			case TransportCommandType.SendInput:
				return this.handleSendInput(validCommand.requestId, validCommand.sessionId, validCommand.text);
			case TransportCommandType.RequestDiff:
				return this.handleRequestDiff(validCommand.requestId, validCommand.sessionId, validCommand.diffId);
			case TransportCommandType.Approve:
				return this.handleApprove(validCommand.requestId, validCommand.sessionId, validCommand.approvalId);
			case TransportCommandType.Reject:
				return this.handleReject(validCommand.requestId, validCommand.sessionId, validCommand.approvalId, validCommand.reason);
			case TransportCommandType.ListWorktrees:
				return this.handleListWorktrees(validCommand.requestId, validCommand.sessionId);
			case TransportCommandType.ApplyConfiguration:
				return this.emitError(validCommand.requestId, TransportErrorCode.Internal, 'Configuration is not yet supported.', false);
			default:
				this.emitError(requestIdFor(validCommand), TransportErrorCode.InvalidPayload, 'Unknown command type.', false);
		}
	}

	public dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.eventSubscription?.dispose();
		this.listeners.clear();
		this.process = undefined;
		this.knownSessionWorkspaces.clear();
		this.knownRequestIds.clear();
		this.teardownPromise ??= (async () => {
			try {
				await this.ports.openCodeClient.disconnect();
			} finally {
				await this.ports.processManager.stopOwned();
			}
		})();
		void this.teardownPromise.catch(() => undefined);
	}

	private async ensureConnected(): Promise<void> {
		if (!this.process) {
			throw new Error('The runtime is not connected.');
		}
	}

	private normalizeWorkspaceUri(value: string): string {
		try {
			return new URL(value).href;
		} catch {
			return value;
		}
	}

	private workspaceFromUri(value: unknown): WorkspaceReference | undefined {
		if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
			return undefined;
		}
		try {
			const parsed = new URL(value);
			return parsed.protocol === 'file:' && parsed.pathname.length > 0 ? { uri: value } : undefined;
		} catch {
			return undefined;
		}
	}

	private isKnownSession(sessionId: string, workspaceUri?: string): boolean {
		const knownWorkspaceUri = this.knownSessionWorkspaces.get(sessionId);
		return knownWorkspaceUri !== undefined
			&& (workspaceUri === undefined || this.normalizeWorkspaceUri(knownWorkspaceUri) === this.normalizeWorkspaceUri(workspaceUri));
	}

	private rememberSession(sessionId: string, workspaceUri = this.process?.workspaceUri): void {
		if (workspaceUri !== undefined) {
			this.knownSessionWorkspaces.set(sessionId, workspaceUri);
		}
	}

	private async ensureStarted(workspace: WorkspaceReference): Promise<void> {
		if (this.process) {
			if (this.normalizeWorkspaceUri(this.process.workspaceUri) !== this.normalizeWorkspaceUri(workspace.uri)) {
				throw new Error('The runtime is connected to another workspace.');
			}
			return;
		}
		const handle = await this.ports.processManager.ensureStarted(workspace);
		if (this.disposed) {
			throw new Error('The runtime transport was disposed during startup.');
		}
		await this.ports.openCodeClient.connect(handle);
		this.process = handle;
	}

	private async handleStartSession(requestId: string, sessionId: string | undefined, workspaceUri: unknown, preflight: unknown): Promise<void> {
		const workspace = this.workspaceFromUri(workspaceUri);
		if (!workspace || !isTransportLocalIntegrationPreflight(preflight)) {
			this.emitError(requestId, TransportErrorCode.InvalidPayload, 'Start command requires a workspace and local integration preflight.', false);
			return;
		}
		if (sessionId && !this.isKnownSession(sessionId, workspace.uri)) {
			this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
			return;
		}
		if (!this.ports.workspaceTrust.isTrusted(workspace)) {
			this.emitError(requestId, TransportErrorCode.WorkspaceUntrusted, 'The workspace is not trusted.', false);
			return;
		}
		if (!preflight.accepted) {
			this.ports.diagnostics.record({ level: 'warn', code: `runtime.integration.refused.${preflight.code}`, requestId });
			this.emitError(
				requestId,
				preflight.code === 'permissionDenied' ? TransportErrorCode.PermissionDenied : TransportErrorCode.ConfigurationInvalid,
				'Local integration preflight refused.',
				false,
			);
			return;
		}

		try {
			const verifiedPreflight = this.ports.localIntegrationPreflight(workspace, preflight);
			if (!verifiedPreflight.accepted) {
				this.ports.diagnostics.record({ level: 'warn', code: `runtime.integration.refused.${verifiedPreflight.code}`, requestId });
				this.emitError(requestId, this.errorCodeForPreflight(verifiedPreflight.code), 'Local integration preflight refused.', false);
				return;
			}

			await this.ensureStarted(workspace);
			if (sessionId) {
				this.emitEvent({
					version: TRANSPORT_PROTOCOL_VERSION,
					type: TransportEventType.State,
					sessionId,
					state: TransportSessionState.Running,
					requestId,
				});
				return;
			}

			const created = await this.ports.openCodeClient.send({ method: 'POST', path: '/session', body: {} });
			if (!isRecord(created) || typeof (created as { id?: unknown }).id !== 'string') {
				this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not create a session.', false);
				return;
			}
			const newSessionId = (created as { id: string }).id;
			this.rememberSession(newSessionId, workspace.uri);
			this.emitEvent({
				version: TRANSPORT_PROTOCOL_VERSION,
				type: TransportEventType.State,
				sessionId: newSessionId,
				state: TransportSessionState.Starting,
				requestId,
			});
		} catch {
			this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not create a session.', false);
		}
	}

	private async handleStopSession(requestId: string, sessionId: string): Promise<void> {
		try {
			await this.ensureConnected();
			if (!this.isKnownSession(sessionId)) {
				this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
				return;
			}
			await this.ports.openCodeClient.send({ method: 'POST', path: `/session/${encodeURIComponent(sessionId)}/abort`, body: {} });
			this.knownSessionWorkspaces.delete(sessionId);
			this.emitEvent({
				version: TRANSPORT_PROTOCOL_VERSION,
				type: TransportEventType.State,
				sessionId,
				state: TransportSessionState.Stopped,
				requestId,
			});
		} catch {
			this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not stop the session.', false);
		}
	}

	private async handleSendInput(requestId: string, sessionId: string, text: string): Promise<void> {
		try {
			await this.ensureConnected();
			if (!this.isKnownSession(sessionId)) {
				this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
				return;
			}
			await this.ports.openCodeClient.send({
				method: 'POST',
				path: `/session/${encodeURIComponent(sessionId)}/prompt_async`,
				body: { parts: [{ type: 'text', text }] },
			});
			this.emitEvent({
				version: TRANSPORT_PROTOCOL_VERSION,
				type: TransportEventType.State,
				sessionId,
				state: TransportSessionState.Running,
				requestId,
			});
		} catch {
			this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not send the input.', false);
		}
	}

	private async handleRequestDiff(requestId: string, sessionId: string, diffId?: string): Promise<void> {
		try {
			await this.ensureConnected();
			if (!this.isKnownSession(sessionId)) {
				this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
				return;
			}
			const path = diffId
				? `/session/${encodeURIComponent(sessionId)}/diff?diffId=${encodeURIComponent(diffId)}`
				: `/session/${encodeURIComponent(sessionId)}/diff`;
			const response = await this.ports.openCodeClient.send({ method: 'GET', path });
			if (Array.isArray(response)) {
				for (const item of response) {
					if (isRecord(item)) {
						this.emitEvent({
							version: TRANSPORT_PROTOCOL_VERSION,
							type: TransportEventType.Diff,
							sessionId,
							diff: {
								diffId: typeof item.diffId === 'string' ? item.diffId : `diff-${Date.now()}`,
								files: Array.isArray(item.files) ? item.files.filter((f: unknown) => isRecord(f)).map((f: Record<string, unknown>) => ({
									path: typeof f.path === 'string' ? f.path : '',
									original: typeof f.original === 'string' ? f.original : '',
									modified: typeof f.modified === 'string' ? f.modified : '',
								})) : [],
							},
							requestId,
						});
					}
				}
			}
		} catch {
			this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not retrieve the diff.', false);
		}
	}

	private async handleApprove(requestId: string, sessionId: string, approvalId: string): Promise<void> {
		try {
			await this.ensureConnected();
			if (!this.isKnownSession(sessionId)) {
				this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
				return;
			}
			await this.ports.openCodeClient.send({
				method: 'POST',
				path: `/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(approvalId)}`,
				body: { response: 'once' },
			});
		} catch {
			this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not approve the request.', false);
		}
	}

	private async handleReject(requestId: string, sessionId: string, approvalId: string, _reason?: string): Promise<void> {
		try {
			await this.ensureConnected();
			if (!this.isKnownSession(sessionId)) {
				this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
				return;
			}
			await this.ports.openCodeClient.send({
				method: 'POST',
				path: `/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(approvalId)}`,
				body: { response: 'reject' },
			});
		} catch {
			this.emitError(requestId, TransportErrorCode.Internal, 'The runtime could not reject the request.', false);
		}
	}

	private async handleListWorktrees(requestId: string, sessionId: string): Promise<void> {
		if (!this.isKnownSession(sessionId)) {
			this.emitError(requestId, TransportErrorCode.SessionNotFound, 'The requested session is not available.', false);
			return;
		}
		this.emitError(requestId, TransportErrorCode.Internal, 'Worktrees are managed by Git, not the OpenCode transport.', false);
	}

	private handleOpenCodeEvent(event: OpenCodeEvent): void {
		switch (event.type) {
			case 'session.created':
			case 'session.updated': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				if (sessionId) {
					this.rememberSession(sessionId);
				}
				break;
			}
			case 'session.deleted': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				if (sessionId) {
					this.knownSessionWorkspaces.delete(sessionId);
				}
				break;
			}
			case 'session.status': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				const status = typeof event.properties.status === 'string' ? event.properties.status : undefined;
				if (sessionId && status) {
					const state = this.mapSessionState(status);
					if (state) {
						this.emitEvent({
							version: TRANSPORT_PROTOCOL_VERSION,
							type: TransportEventType.State,
							sessionId,
							state,
						});
					}
				}
				break;
			}
			case 'session.idle': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				if (sessionId) {
					this.emitEvent({
						version: TRANSPORT_PROTOCOL_VERSION,
						type: TransportEventType.State,
						sessionId,
						state: TransportSessionState.Running,
					});
				}
				break;
			}
			case 'session.error': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				const message = 'The session encountered an error.';
				if (sessionId) {
					this.emitEvent({
						version: TRANSPORT_PROTOCOL_VERSION,
						type: TransportEventType.Error,
						sessionId,
						error: {
							code: TransportErrorCode.Internal,
							message,
							retryable: false,
						},
					});
				}
				break;
			}
			case 'message.part.updated': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				const content = typeof event.properties.content === 'string' ? event.properties.content : '';
				const role = typeof event.properties.role === 'string' ? event.properties.role : 'assistant';
				if (sessionId && (content || typeof event.properties.delta === 'boolean')) {
					this.emitEvent({
						version: TRANSPORT_PROTOCOL_VERSION,
						type: TransportEventType.Content,
						sessionId,
						role: role as 'user' | 'assistant' | 'system',
						content,
						delta: typeof event.properties.delta === 'boolean' ? event.properties.delta : false,
					});
				}
				break;
			}
			case 'session.diff': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				if (sessionId) {
					const files: TransportDiffFile[] = [];
					if (Array.isArray(event.properties.files)) {
						for (const f of event.properties.files) {
							if (isRecord(f)) {
								files.push({
									path: typeof f.path === 'string' ? f.path : '',
									original: typeof f.original === 'string' ? f.original : '',
									modified: typeof f.modified === 'string' ? f.modified : '',
								});
							}
						}
					}
					this.emitEvent({
						version: TRANSPORT_PROTOCOL_VERSION,
						type: TransportEventType.Diff,
						sessionId,
						diff: {
							diffId: typeof event.properties.diffId === 'string' ? event.properties.diffId : `diff-${Date.now()}`,
							files,
						},
					});
				}
				break;
			}
			case 'permission.updated': {
				const sessionId = typeof event.properties.sessionID === 'string' ? event.properties.sessionID : typeof event.properties.sessionId === 'string' ? event.properties.sessionId : undefined;
				const approvalId = typeof event.properties.permissionID === 'string' ? event.properties.permissionID : typeof event.properties.id === 'string' ? event.properties.id : undefined;
				if (sessionId && approvalId) {
					this.emitEvent({
						version: TRANSPORT_PROTOCOL_VERSION,
						type: TransportEventType.Permission,
						sessionId,
						permission: {
							approvalId,
							kind: typeof event.properties.type === 'string' && (event.properties.type === 'edit' || event.properties.type === 'command' || event.properties.type === 'tool') ? event.properties.type : 'tool',
							title: typeof event.properties.description === 'string' ? event.properties.description : 'Agent action requires approval',
						},
					});
				}
				break;
			}
		}
	}

	private mapSessionState(status: string): TransportSessionState | undefined {
		switch (status) {
			case 'idle':
			case 'running':
				return TransportSessionState.Running;
			case 'busy':
				return TransportSessionState.Running;
			case 'error':
				return TransportSessionState.Error;
			default:
				return undefined;
		}
	}

	private errorCodeForPreflight(code: string): TransportErrorCode {
		if (code === 'permissionDenied') {
			return TransportErrorCode.PermissionDenied;
		}
		if (code === 'workspaceUntrusted') {
			return TransportErrorCode.WorkspaceUntrusted;
		}
		return TransportErrorCode.ConfigurationInvalid;
	}

	private emitEvent(event: TransportEvent): void {
		const validation = validateTransportEvent(event);
		if (!validation.valid) {
			this.emitError(event.requestId, TransportErrorCode.InvalidPayload, 'The runtime produced an invalid event.', false);
			return;
		}
		this.emitRawEvent(validation.value);
	}

	private emitRawEvent(event: TransportEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	private emitError(requestId: string | undefined, code: TransportErrorCode, message: string, retryable: boolean): void {
		const error = { code, message, retryable };
		if (requestId === undefined) {
			this.emitEvent({
				version: TRANSPORT_PROTOCOL_VERSION,
				type: TransportEventType.Error,
				error,
			});
			return;
		}
		this.emitEvent({
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId,
			error,
		});
	}
}

/** Creates a transport bridge and connects it to the given runtime ports. */
export function createRuntimeTransport(ports: RuntimePorts): RuntimeTransport {
	return new RuntimeTransportBridge(ports);
}
