/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { RuntimeTransportBridge } from '../infrastructure/runtimeTransport';
import type { RuntimePorts, OpenCodeRequest, OpenCodeEvent } from '../application/runtimePorts';
import type { OwnedProcessHandle, SessionReference, WorkspaceReference } from '../domain/runtime';
import {
	TRANSPORT_PROTOCOL_VERSION,
	TransportCommandType,
	TransportErrorCode,
	TransportEventType,
	TransportSessionState,
	type TransportCommand,
	type TransportEvent,
} from '../application/transport';

const workspacePath = process.platform === 'win32' ? 'C:\\unigma-workspace' : '/tmp/unigma-workspace';
const workspace: WorkspaceReference = { uri: pathToFileURL(workspacePath).toString() };
const otherWorkspace: WorkspaceReference = { uri: pathToFileURL(process.platform === 'win32' ? 'C:\\other-workspace' : '/tmp/other-workspace').toString() };
const processHandle: OwnedProcessHandle = {
	owner: 'unigma-agent-runtime',
	id: 'fixture-process',
	pid: 1234,
	endpoint: 'http://127.0.0.1:43123',
	workspaceUri: workspace.uri,
};

class FakeEventEmitter extends EventEmitter {
	public dispose(): void {
		this.removeAllListeners();
	}
}

function portsFor(options: {
	readonly connect?: () => Promise<void>;
	readonly send?: (request: OpenCodeRequest) => Promise<unknown>;
	readonly onEvent?: (listener: (event: OpenCodeEvent) => void) => { dispose(): void };
	readonly trusted?: boolean;
	readonly ensureStarted?: (workspace: WorkspaceReference) => Promise<OwnedProcessHandle>;
	readonly preflight?: RuntimePorts['localIntegrationPreflight'];
} = {}): RuntimePorts & { eventEmitter: FakeEventEmitter } {
	const eventEmitter = new FakeEventEmitter();
	return {
		workspaceTrust: {
			isTrusted: () => options.trusted ?? true,
		},
		processManager: {
			ensureStarted: async workspace => options.ensureStarted?.(workspace) ?? processHandle,
			stopOwned: async () => {},
		},
		localIntegrationPreflight: options.preflight ?? ((_workspace, requested) => requested ?? ({ accepted: true })),
		openCodeClient: {
			connect: options.connect ?? (async () => {}),
			disconnect: async () => {},
			send: options.send ?? (async request => request.path === '/session' ? { id: 'session-new' } : {}),
			onEvent: options.onEvent ?? (listener => {
				eventEmitter.on('event', listener);
				return { dispose: () => eventEmitter.off('event', listener) };
			}),
		},
		sessionReferenceStore: {
			read: async () => undefined,
			write: async (_reference: SessionReference) => {},
			remove: async (_workspace: WorkspaceReference) => {},
		},
		diagnostics: {
			record: () => {},
		},
		eventEmitter,
	};
}

suite('RuntimeTransportBridge', () => {
	test('creates a session via start command', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				if (request.path === '/session') {
					return { id: 'session-new' };
				}
				return { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-1',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		assert.deepStrictEqual(requests, [{ method: 'POST', path: '/session', body: {} }]);
		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.State,
			sessionId: 'session-new',
			state: TransportSessionState.Starting,
			requestId: 'req-1',
		}]);
		bridge.dispose();
	});

	test('rejects a known session requested from a different workspace', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-other-workspace',
			type: TransportCommandType.StartSession,
			sessionId: 'session-new',
			workspaceUri: otherWorkspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-other-workspace',
			error: {
				code: TransportErrorCode.SessionNotFound,
				message: 'The requested session is not available.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('sends input to an existing session', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		// First create a session
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		// Then send input
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-2',
			type: TransportCommandType.SendInput,
			sessionId: 'session-new',
			text: 'Hello world',
		});

		assert.deepStrictEqual(requests[1], {
			method: 'POST',
			path: '/session/session-new/prompt_async',
			body: { parts: [{ type: 'text', text: 'Hello world' }] },
		});
		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.State,
			sessionId: 'session-new',
			state: TransportSessionState.Running,
			requestId: 'req-2',
		});
		bridge.dispose();
	});

	test('rejects input for unknown session', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-1',
			type: TransportCommandType.SendInput,
			sessionId: 'unknown-session',
			text: 'Hello',
		});

		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-1',
			error: {
				code: TransportErrorCode.SessionNotFound,
				message: 'The requested session is not available.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('rejects duplicate request IDs without repeating the operation', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-input',
			type: TransportCommandType.SendInput,
			sessionId: 'session-new',
			text: 'once',
		});
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-input',
			type: TransportCommandType.SendInput,
			sessionId: 'session-new',
			text: 'must not repeat',
		});

		assert.strictEqual(requests.filter(request => request.path.endsWith('/prompt_async')).length, 1);
		assert.deepStrictEqual(events[2], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-input',
			error: {
				code: TransportErrorCode.DuplicateRequestId,
				message: 'This request was already handled.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('stops a session via stop command', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		// Create session
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		// Stop session
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-2',
			type: TransportCommandType.StopSession,
			sessionId: 'session-new',
		});

		assert.deepStrictEqual(requests[1], {
			method: 'POST',
			path: '/session/session-new/abort',
			body: {},
		});
		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.State,
			sessionId: 'session-new',
			state: TransportSessionState.Stopped,
			requestId: 'req-2',
		});
		bridge.dispose();
	});

	test('translates the documented snapshot diff response', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				if (request.path === '/session') {
					return { id: 'session-new' };
				}
				if (request.path === '/session/session-new/diff') {
					return [{ file: 'src/file.ts', patch: '@@ -1 +1 @@\n-old\n+new', additions: 1, deletions: 1, status: 'modified' }];
				}
				return {};
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));
		await bridge.send({ version: TRANSPORT_PROTOCOL_VERSION, requestId: 'start-diff', type: TransportCommandType.StartSession, workspaceUri: workspace.uri, localIntegrationPreflight: { accepted: true } });
		await bridge.send({ version: TRANSPORT_PROTOCOL_VERSION, requestId: 'request-diff', type: TransportCommandType.RequestDiff, sessionId: 'session-new' });

		assert.strictEqual(requests.some(request => request.path.includes('diffId=')), false);
		assert.deepStrictEqual(events[events.length - 1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Diff,
			sessionId: 'session-new',
			requestId: 'request-diff',
			diff: { diffId: 'diff-session-new', files: [{ path: 'src/file.ts', patch: '@@ -1 +1 @@\n-old\n+new' }] },
		});
		bridge.dispose();
	});

	test('approves a permission request', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		// Create session
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		// Approve permission
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-2',
			type: TransportCommandType.Approve,
			sessionId: 'session-new',
			approvalId: 'approval-1',
		});

		assert.deepStrictEqual(requests[1], {
			method: 'POST',
			path: '/session/session-new/permissions/approval-1',
		body: { response: 'once' },
		});
		assert.strictEqual(events.length, 1); // Only the start event, no approve event
		bridge.dispose();
	});

	test('rejects a permission request', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);

		// Create session
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		// Reject permission
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-2',
			type: TransportCommandType.Reject,
			sessionId: 'session-new',
			approvalId: 'approval-1',
			reason: 'Not now',
		});

		assert.deepStrictEqual(requests[1], {
			method: 'POST',
			path: '/session/session-new/permissions/approval-1',
		body: { response: 'reject' },
		});
		bridge.dispose();
	});

	test('rejects permission changes for an unknown session', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-approve',
			type: TransportCommandType.Approve,
			sessionId: 'unknown-session',
			approvalId: 'approval-1',
		});

		assert.strictEqual(requests.some(request => request.path.includes('/permissions/')), false);
		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-approve',
			error: {
				code: TransportErrorCode.SessionNotFound,
				message: 'The requested session is not available.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('does not use the provider endpoint for worktrees', async () => {
		const requests: OpenCodeRequest[] = [];
		const ports = portsFor({
			send: async request => {
				requests.push(request);
				return request.path === '/session' ? { id: 'session-new' } : { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-worktrees',
			type: TransportCommandType.ListWorktrees,
			sessionId: 'session-new',
		});

		assert.deepStrictEqual(requests, [{ method: 'POST', path: '/session', body: {} }]);
		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-worktrees',
			error: {
				code: TransportErrorCode.Internal,
				message: 'Worktrees are managed by Git, not the OpenCode transport.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('translates OpenCode session.status events', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		// Simulate OpenCode event
		ports.eventEmitter.emit('event', {
			type: 'session.status',
			properties: { sessionID: 'session-1', status: 'idle' },
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.State,
			sessionId: 'session-1',
			state: TransportSessionState.Running,
		}]);
		bridge.dispose();
	});

	test('translates OpenCode message.part.updated events', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		ports.eventEmitter.emit('event', {
			type: 'message.part.updated',
			properties: {
				sessionID: 'session-1',
				role: 'assistant',
				content: 'Hello',
				delta: true,
			},
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Content,
			sessionId: 'session-1',
			role: 'assistant',
			content: 'Hello',
			delta: true,
		}]);
		bridge.dispose();
	});

	test('translates OpenCode permission.updated events', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		ports.eventEmitter.emit('event', {
			type: 'permission.updated',
			properties: {
				sessionID: 'session-1',
				permissionID: 'perm-1',
				type: 'edit',
				description: 'Apply change to file.ts',
			},
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Permission,
			sessionId: 'session-1',
			permission: {
				approvalId: 'perm-1',
				kind: 'edit',
				title: 'Apply change to file.ts',
			},
		}]);
		bridge.dispose();
	});

	test('translates documented permission.asked events', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));
		ports.eventEmitter.emit('event', {
			type: 'permission.asked',
			properties: { id: 'per-1', sessionID: 'session-1', type: 'edit', title: 'Edit file', metadata: {} },
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Permission,
			sessionId: 'session-1',
			permission: { approvalId: 'per-1', kind: 'edit', title: 'Edit file' },
		}]);
		bridge.dispose();
	});

	test('translates OpenCode session.error events', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		ports.eventEmitter.emit('event', {
			type: 'session.error',
			properties: {
				sessionID: 'session-1',
				error: 'secret prompt must not be emitted',
			},
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			sessionId: 'session-1',
			error: {
				code: TransportErrorCode.Internal,
				message: 'The session encountered an error.',
				retryable: false,
			},
		}]);
		bridge.dispose();
	});

	test('does not forward malformed OpenCode events', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		ports.eventEmitter.emit('event', {
			type: 'session.diff',
			properties: {
				sessionID: 'session-1',
				files: [{ path: '', original: '', modified: '' }],
			},
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			error: {
				code: TransportErrorCode.InvalidPayload,
				message: 'The runtime produced an invalid event.',
				retryable: false,
			},
		}]);
		bridge.dispose();
	});

	test('rejects a start command without workspace or preflight', async () => {
		let starts = 0;
		const ports = portsFor({ ensureStarted: async () => { starts++; return processHandle; } });
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-missing-start-data',
			type: TransportCommandType.StartSession,
		} as unknown as TransportCommand);

		assert.strictEqual(starts, 0);
		assert.deepStrictEqual(events[0], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-missing-start-data',
			error: {
				code: TransportErrorCode.InvalidPayload,
				message: 'Start command requires a workspace and local integration preflight.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('refuses local integration before starting the process', async () => {
		let starts = 0;
		const ports = portsFor({ ensureStarted: async () => { starts++; return processHandle; } });
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-refused-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: false, code: 'permissionDenied' },
		});

		assert.strictEqual(starts, 0);
		assert.deepStrictEqual(events[0], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-refused-start',
			error: {
				code: TransportErrorCode.PermissionDenied,
				message: 'Local integration preflight refused.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('revalidates an accepted workbench decision before starting the process', async () => {
		let starts = 0;
		const ports = portsFor({
			ensureStarted: async () => { starts++; return processHandle; },
			preflight: () => ({ accepted: false, code: 'unknownOrigin' }),
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-runtime-refused-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		assert.strictEqual(starts, 0);
		assert.deepStrictEqual(events[0], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-runtime-refused-start',
			error: {
				code: TransportErrorCode.ConfigurationInvalid,
				message: 'Local integration preflight refused.',
				retryable: false,
			},
		});
		bridge.dispose();
	});

	test('rejects post-start commands without an existing runtime', async () => {
		let starts = 0;
		const ports = portsFor({ ensureStarted: async () => { starts++; return processHandle; } });
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-no-runtime',
			type: TransportCommandType.SendInput,
			sessionId: 'session-1',
			text: 'must not start',
		});

		assert.strictEqual(starts, 0);
		assert.strictEqual(events[0].type, TransportEventType.Error);
		bridge.dispose();
	});

	test('rejects unsupported protocol version', async () => {
		const ports = portsFor();
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: 2 as unknown as typeof TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-1',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-1',
			error: {
				code: TransportErrorCode.UnsupportedVersion,
				message: 'Unsupported transport protocol version.',
				retryable: false,
			},
		}]);
		bridge.dispose();
	});

	test('emits error when send fails', async () => {
		const ports = portsFor({
			send: async () => { throw new Error('connection lost'); },
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-1',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		assert.deepStrictEqual(events, [{
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.Error,
			requestId: 'req-1',
			error: {
				code: TransportErrorCode.Internal,
				message: 'The runtime could not create a session.',
				retryable: false,
			},
		}]);
		bridge.dispose();
	});

	test('translates OpenCode session.created events to track session IDs', async () => {
		const ports = portsFor({
			send: async request => {
				if (request.path === '/session') {
					return { id: 'session-created' };
				}
				return { ok: true };
			},
		});
		const bridge = new RuntimeTransportBridge(ports);
		const events: TransportEvent[] = [];
		bridge.onEvent(event => events.push(event));

		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-start',
			type: TransportCommandType.StartSession,
			workspaceUri: workspace.uri,
			localIntegrationPreflight: { accepted: true },
		});

		// Emit session.created event
		ports.eventEmitter.emit('event', {
			type: 'session.created',
			properties: { sessionID: 'session-created' },
		});

		// Now input to that session should succeed
		await bridge.send({
			version: TRANSPORT_PROTOCOL_VERSION,
			requestId: 'req-1',
			type: TransportCommandType.SendInput,
			sessionId: 'session-created',
			text: 'Hello',
		});

		assert.strictEqual(events.length, 2);
		assert.deepStrictEqual(events[1], {
			version: TRANSPORT_PROTOCOL_VERSION,
			type: TransportEventType.State,
			sessionId: 'session-created',
			state: TransportSessionState.Running,
			requestId: 'req-1',
		});
		bridge.dispose();
	});
});
