/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { pathToFileURL } from 'node:url';
import { AgentRuntimeApplication } from '../application/runtimeApplication';
import type { OpenCodeEvent, OpenCodeRequest, RuntimePorts } from '../application/runtimePorts';
import type { AgentRuntimeRpc, RuntimePromptCommand, RuntimeRpcEvent } from '../application/rpc';
import type { DiagnosticRecord, OwnedProcessHandle, SessionReference, WorkspaceReference } from '../domain/runtime';

const workspace: WorkspaceReference = {
	uri: pathToFileURL(process.platform === 'win32' ? 'C:\\unigma-workspace' : '/tmp/unigma-workspace').toString(),
};
const processHandle: OwnedProcessHandle = {
	owner: 'unigma-agent-runtime',
	id: 'fixture-process',
	pid: 1234,
	endpoint: 'http://127.0.0.1:43123',
	workspaceUri: workspace.uri,
};

function portsFor(options: {
	readonly connect?: () => Promise<void>;
	readonly order?: string[];
	readonly diagnostics?: DiagnosticRecord[];
	readonly onEvent?: (listener: (event: OpenCodeEvent) => void) => { dispose(): void };
	readonly trusted?: boolean;
} = {}): RuntimePorts {
	const order = options.order ?? [];
	const diagnostics = options.diagnostics ?? [];
	return {
		workspaceTrust: {
			isTrusted: () => options.trusted ?? true,
		},
		processManager: {
			ensureStarted: async () => {
				order.push('start');
				return processHandle;
			},
			stopOwned: async () => {
				order.push('stop');
			},
		},
		openCodeClient: {
			connect: options.connect ?? (async () => {
				order.push('connect');
			}),
			disconnect: async () => {
				order.push('disconnect');
			},
			send: async (_request: OpenCodeRequest) => undefined,
			onEvent: listener => options.onEvent?.(listener) ?? { dispose: () => undefined },
		},
		sessionReferenceStore: {
			read: async () => undefined,
			write: async (_reference: SessionReference) => undefined,
			remove: async (_workspace: WorkspaceReference) => undefined,
		},
		diagnostics: {
			record: record => diagnostics.push(record),
		},
	};
}

class FakeRpc implements AgentRuntimeRpc<RuntimePromptCommand, RuntimeRpcEvent> {
	private handler: ((command: RuntimePromptCommand) => void | Promise<void>) | undefined;
	public readonly events: RuntimeRpcEvent[] = [];

	public onCommand(handler: (command: RuntimePromptCommand) => void | Promise<void>): { dispose(): void } {
		this.handler = handler;
		return { dispose: () => this.handler = undefined };
	}

	public emitEvent(event: RuntimeRpcEvent): void {
		this.events.push(event);
	}

	public async command(command: RuntimePromptCommand): Promise<void> {
		await this.handler?.(command);
	}

	public dispose(): void {
		this.handler = undefined;
	}
}

function waitFor(condition: () => boolean): Promise<void> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + 1000;
		const check = () => {
			if (condition()) {
				resolve();
			} else if (Date.now() >= deadline) {
				reject(new Error('fixture condition was not reached'));
			} else {
				setTimeout(check, 5);
			}
		};
		check();
	});
}

suite('Unigma agent runtime application', () => {
	test('composes process startup and connection, then tears down in order', async () => {
		const order: string[] = [];
		const application = new AgentRuntimeApplication(portsFor({ order }));

		await application.connectWorkspace(workspace, 'request-1');
		application.dispose();
		await waitFor(() => order.includes('stop'));

		assert.deepStrictEqual(order, ['start', 'connect', 'disconnect', 'stop']);
	});

	test('redacts connection failures and still stops the owned process', async () => {
		const order: string[] = [];
		const diagnostics: DiagnosticRecord[] = [];
		const application = new AgentRuntimeApplication(portsFor({
			order,
			diagnostics,
			connect: async () => {
				throw new Error('secret prompt must not be recorded');
			},
		}));

		await assert.rejects(application.connectWorkspace(workspace, 'request-2'), /secret prompt/);
		assert.deepStrictEqual(order, ['start', 'disconnect', 'stop']);
		assert.deepStrictEqual(diagnostics, [{ level: 'error', code: 'runtime.connection.failed', requestId: 'request-2' }]);
		assert.ok(!JSON.stringify(diagnostics).includes('secret prompt'));
	});

	test('shares teardown when disposal races with connection', async () => {
		const order: string[] = [];
		let releaseConnection!: () => void;
		let connectCalls = 0;
		const connection = new Promise<void>(resolve => releaseConnection = resolve);
		const application = new AgentRuntimeApplication(portsFor({
			order,
			connect: async () => {
				connectCalls++;
				await connection;
			},
		}));

		const connecting = application.connectWorkspace(workspace);
		await waitFor(() => connectCalls === 1);
		application.dispose();
		await waitFor(() => order.filter(entry => entry === 'disconnect').length === 1 && order.filter(entry => entry === 'stop').length === 1);
		releaseConnection();
		await connecting;

		assert.deepStrictEqual(order, ['start', 'disconnect', 'stop']);
	});

	test('creates then reuses a stored session through the local RPC use case', async () => {
		const rpc = new FakeRpc();
		const order: string[] = [];
		const stored: SessionReference[] = [];
		const requests: OpenCodeRequest[] = [];
		let connected = false;
		let emitEvent!: (event: OpenCodeEvent) => void;
		const ports = portsFor({ order, onEvent: listener => {
			emitEvent = listener;
			return { dispose: () => undefined };
		} });
		ports.processManager.ensureStarted = async () => {
			order.push('start');
			return processHandle;
		};
		ports.openCodeClient.connect = async () => {
			if (!connected) {
				connected = true;
				order.push('connect');
			}
		};
		ports.openCodeClient.send = async request => {
			requests.push(request);
			return request.path === '/session' ? { id: 'session-one' } : { ok: true };
		};
		ports.sessionReferenceStore.read = async () => stored[0];
		ports.sessionReferenceStore.write = async reference => { stored[0] = reference; };
		const application = new AgentRuntimeApplication(ports, rpc);

		await rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-1' });
		emitEvent({ type: 'session.idle', properties: { sessionID: 'session-one' } });
		await rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-2' });
		assert.deepStrictEqual(application.lastDemand, { source: 'rpc', requestId: 'request-2' });
		application.dispose();
		await waitFor(() => order.includes('stop'));

		assert.deepStrictEqual(requests.map(request => request.path), ['/session', '/session/session-one/prompt_async', '/session/session-one/prompt_async']);
		assert.deepStrictEqual(stored, [{ sessionId: 'session-one', workspaceUri: workspace.uri }]);
		assert.deepStrictEqual(rpc.events.filter(event => event.type === 'session.ready'), [
			{ version: 1, type: 'session.ready', sessionId: 'session-one', requestId: 'request-1' },
			{ version: 1, type: 'session.ready', sessionId: 'session-one', requestId: 'request-2' },
		]);
		assert.deepStrictEqual(rpc.events.filter(event => event.type === 'session.event'), [
			{ version: 1, type: 'session.event', event: { type: 'session.idle', properties: { sessionID: 'session-one' } } },
		]);
		assert.deepStrictEqual(order, ['start', 'connect', 'start', 'disconnect', 'stop']);
	});

	test('publishes a redacted RPC error when session creation fails', async () => {
		const rpc = new FakeRpc();
		const diagnostics: DiagnosticRecord[] = [];
		const ports = portsFor({ diagnostics });
		ports.openCodeClient.send = async () => { throw new Error('secret prompt must not be emitted'); };
		const application = new AgentRuntimeApplication(ports, rpc);

		await rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-3' });

		assert.deepStrictEqual(rpc.events, [{ version: 1, type: 'session.error', requestId: 'request-3' }]);
		assert.deepStrictEqual(diagnostics, [{ level: 'error', code: 'runtime.session.failed', requestId: 'request-3' }]);
		assert.ok(!JSON.stringify([...rpc.events, diagnostics]).includes('secret prompt'));
		application.dispose();
	});

	test('serializes concurrent prompts in one workspace before creating a session', async () => {
		const rpc = new FakeRpc();
		const requests: OpenCodeRequest[] = [];
		const stored: SessionReference[] = [];
		let releaseCreation!: () => void;
		const creationStarted = new Promise<void>(resolve => releaseCreation = resolve);
		const ports = portsFor();
		ports.openCodeClient.send = async request => {
			requests.push(request);
			if (request.path === '/session') {
				await creationStarted;
				return { id: 'session-one' };
			}
			return { ok: true };
		};
		ports.sessionReferenceStore.read = async () => stored[0];
		ports.sessionReferenceStore.write = async reference => { stored[0] = reference; };
		const application = new AgentRuntimeApplication(ports, rpc);

		const first = rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-1' });
		await waitFor(() => requests.length === 1);
		const second = rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-2' });
		await new Promise(resolve => setTimeout(resolve, 10));
		assert.deepStrictEqual(requests.map(request => request.path), ['/session']);

		releaseCreation();
		await Promise.all([first, second]);

		assert.deepStrictEqual(requests.map(request => request.path), ['/session', '/session/session-one/prompt_async', '/session/session-one/prompt_async']);
		assert.deepStrictEqual(stored, [{ sessionId: 'session-one', workspaceUri: workspace.uri }]);
		application.dispose();
	});

	test('removes a newly persisted reference when the initial prompt fails', async () => {
		const rpc = new FakeRpc();
		const diagnostics: DiagnosticRecord[] = [];
		const stored: SessionReference[] = [];
		const ports = portsFor({ diagnostics });
		ports.openCodeClient.send = async request => request.path === '/session' ? { id: 'session-one' } : Promise.reject(new Error('secret prompt'));
		ports.sessionReferenceStore.read = async () => stored[0];
		ports.sessionReferenceStore.write = async reference => { stored[0] = reference; };
		ports.sessionReferenceStore.remove = async () => { stored.length = 0; };
		const application = new AgentRuntimeApplication(ports, rpc);

		await rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-4' });

		assert.deepStrictEqual(stored, []);
		assert.deepStrictEqual(diagnostics, [{ level: 'error', code: 'runtime.session.failed', requestId: 'request-4' }]);
		assert.ok(!JSON.stringify([...rpc.events, diagnostics]).includes('secret prompt'));
		application.dispose();
	});

	test('refuses prompts outside the trusted workspace boundary', async () => {
		const rpc = new FakeRpc();
		const diagnostics: DiagnosticRecord[] = [];
		const ports = portsFor({ diagnostics, trusted: false });
		const application = new AgentRuntimeApplication(ports, rpc);

		await rpc.command({ version: 1, type: 'session.prompt', workspace, prompt: { parts: [] }, requestId: 'request-5' });

		assert.deepStrictEqual(rpc.events, [{ version: 1, type: 'session.error', requestId: 'request-5' }]);
		assert.deepStrictEqual(diagnostics, [{ level: 'warn', code: 'runtime.workspace.untrusted', requestId: 'request-5' }]);
		application.dispose();
	});
});
