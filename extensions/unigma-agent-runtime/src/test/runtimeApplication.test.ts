/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { pathToFileURL } from 'node:url';
import { AgentRuntimeApplication } from '../application/runtimeApplication';
import type { RuntimePorts } from '../application/runtimePorts';
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
} = {}): RuntimePorts {
	const order = options.order ?? [];
	const diagnostics = options.diagnostics ?? [];
	return {
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
});
