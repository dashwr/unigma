/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
	buildSshForwardArguments,
	buildSshTransportArguments,
	openRemoteServer,
	type RemoteServerDiagnostic,
	type RemoteServerSession,
	type RemoteServerTransportInput,
	type RemoteServerTransportDependencies,
	type RemoteSshProcess
} from '../remoteServerTransport.js';

const input: RemoteServerTransportInput = {
	destination: 'build-vps',
	commit: '0123456789abcdef0123456789abcdef01234567'
};
const socketPath = '/home/remote-user/.unigma-server/0123456789ab.unigma-server.sock';

class FakeProcess extends EventEmitter implements RemoteSshProcess {
	readonly stdin = new PassThrough();
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	readonly killed: string[] = [];
	readonly scriptChunks: Buffer[] = [];

	constructor(private readonly afterStdin?: (process: FakeProcess) => void) {
		super();
		this.stdin.on('data', chunk => this.scriptChunks.push(Buffer.from(chunk)));
		this.stdin.on('finish', () => this.afterStdin?.(this));
	}

	kill(signal?: NodeJS.Signals): boolean {
		this.killed.push(signal ?? 'SIGTERM');
		queueMicrotask(() => this.emit('close', null, signal));
		return true;
	}

	/**
	 * Ends stderr and closes on a later turn, the way an operating system does.
	 *
	 * Emitting `close` in the same tick as the write made the outcome depend on
	 * whether readline happened to deliver the line first, which Linux did and
	 * Windows did not, so the same input classified two different ways.
	 */
	exitAfterStderr(text: string, code: number): void {
		this.stderr.end(text);
		setImmediate(() => this.emit('close', code, null));
	}
}

function deps(processes: readonly FakeProcess[], diagnostics: RemoteServerDiagnostic[] = []): RemoteServerTransportDependencies {
	let index = 0;
	return {
		allocateLocalPort: async () => 43123,
		spawn: arguments_ => {
			assert.ok(arguments_.includes('build-vps'));
			return processes[index++];
		},
		diagnose: diagnostic => diagnostics.push(diagnostic)
	};
}

test('builds the SSH ControlMaster command without a forward', () => {
	assert.deepEqual(buildSshTransportArguments({ destination: 'build-vps', controlPath: '/tmp/ug-control/c' }), [
		'-M',
		'-o', 'ControlPath=/tmp/ug-control/c',
		'-o', 'ControlPersist=no',
		'-o', 'BatchMode=yes',
		'-o', 'StrictHostKeyChecking=yes',
		'build-vps', '--', '/bin/sh', '-s'
	]);
});

test('builds the pure -O forward command', () => {
	assert.deepEqual(buildSshForwardArguments({ destination: 'build-vps', controlPath: '/tmp/ug-control/c', localPort: 43123, remoteSocketPath: socketPath }), [
		'-o', 'ControlPath=/tmp/ug-control/c',
		'-o', 'BatchMode=yes',
		'-o', 'StrictHostKeyChecking=yes',
		'-O', 'forward',
		'-L', `127.0.0.1:43123:${socketPath}`,
		'build-vps'
	]);
});

test('keeps the disposable known_hosts seam on both SSH operations', () => {
	const knownHostsFile = '/tmp/unigma-smoke-known-hosts';
	const master = buildSshTransportArguments({ destination: 'build-vps', controlPath: '/tmp/ug-control/c', knownHostsFile });
	const forward = buildSshForwardArguments({ destination: 'build-vps', controlPath: '/tmp/ug-control/c', localPort: 43123, remoteSocketPath: socketPath, knownHostsFile });
	for (const arguments_ of [master, forward]) {
		assert.ok(arguments_.includes(`UserKnownHostsFile=${knownHostsFile}`));
		assert.ok(arguments_.includes('GlobalKnownHostsFile=/dev/null'));
	}
});

test('opens the master, adds one forward after the ready handshake, and cleans ControlPath on dispose', async () => {
	const master = new FakeProcess(child => child.stdout.end(`unigma-remote:{"status":"ready","socketPath":"${socketPath}"}\n`));
	const forward = new FakeProcess(child => child.emit('close', 0, null));
	let masterArguments: readonly string[] = [];
	const session = await openRemoteServer(input, {
		...deps([master, forward]),
		spawn: (arguments_: readonly string[]) => {
			if (arguments_.includes('-M')) {
				masterArguments = arguments_;
				return master;
			}
			return forward;
		}
	});
	const successfulSession = session as RemoteServerSession;
	assert.deepEqual(successfulSession.endpoint, { host: '127.0.0.1', port: 43123 });
	assert.equal(Buffer.concat(master.scriptChunks).toString().includes('--without-connection-token'), true);
	const controlPath = masterArguments.find(argument => argument.startsWith('ControlPath='))!.slice('ControlPath='.length);
	const controlDirectory = controlPath.slice(0, controlPath.lastIndexOf('/'));
	assert.equal(existsSync(controlPath), false);
	assert.equal(existsSync(controlDirectory), true);
	await successfulSession.dispose();
	await successfulSession.dispose();
	assert.deepEqual(master.killed, ['SIGTERM']);
	assert.equal(existsSync(controlDirectory), false);
});

test('fails with its own code when adding the forward fails', async () => {
	const master = new FakeProcess(child => child.stdout.end(`unigma-remote:{"status":"ready","socketPath":"${socketPath}"}\n`));
	const forward = new FakeProcess(child => child.emit('close', 255, null));
	const result = await openRemoteServer(input, deps([master, forward]));
	assert.deepEqual(result, { ok: false, code: 'ssh.forward-failed', phase: 'forward', exitCode: 255 });
	assert.deepEqual(master.killed, ['SIGTERM']);
});

test('maps remote HOME and socket validation statuses to observable failures', async () => {
	for (const [status, code] of [['home-invalid', 'ssh.remote-home-invalid'], ['socket-path-too-long', 'ssh.remote-socket-path-too-long']] as const) {
		const master = new FakeProcess(child => child.stdout.end(`unigma-remote:{"status":"${status}"}\n`));
		const result = await openRemoteServer(input, deps([master]));
		assert.deepEqual(result, { ok: false, code, phase: 'handshake' });
	}
});

test('retains an owned control master for explicit staging when the server is absent', async () => {
	const master = new FakeProcess(child => child.stdout.end('unigma-remote:{"status":"server-unavailable"}\n'));
	const result = await openRemoteServer({ ...input, retainControlMasterOnServerUnavailable: true }, deps([master]));
	const failure = result as { readonly ok: false; readonly stagingSession?: { readonly controlPath: string; dispose(): Promise<void> } };
	assert.equal(failure.ok, false);
	assert.equal(failure.stagingSession?.controlPath !== undefined, true);
	await failure.stagingSession?.dispose();
	assert.deepEqual(master.killed, ['SIGTERM']);
});

test('times out a silent master in the connect phase and terminates it', async () => {
	const process = new FakeProcess();
	const diagnostics: RemoteServerDiagnostic[] = [];
	const result = await openRemoteServer({ ...input, timeoutMs: 5 }, deps([process], diagnostics));
	assert.deepEqual(result, { ok: false, code: 'ssh.transport-failed', phase: 'connect' });
	assert.deepEqual(process.killed, ['SIGTERM']);
	assert.equal(diagnostics.some(diagnostic => diagnostic.category === 'ssh.transport-failed' && diagnostic.phase === 'connect'), true);
});

test('categorizes SSH stderr without forwarding its contents', async () => {
	const process = new FakeProcess(child => {
		child.exitAfterStderr('Host key verification failed for build-vps\n', 255);
	});
	const diagnostics: RemoteServerDiagnostic[] = [];
	const result = await openRemoteServer(input, deps([process], diagnostics));
	assert.deepEqual(result, { ok: false, code: 'ssh.host-key-untrusted', phase: 'connect', exitCode: 255 });
	assert.equal(diagnostics.every(diagnostic => !JSON.stringify(diagnostic).includes('build-vps')), true);
});


test('keeps the specific stderr diagnosis when unrelated output follows it', async () => {
	// OpenSSH states its reason and then keeps talking. The category used to be
	// overwritten on every line, so a trailing line replaced `host key untrusted`
	// with the generic fallback. The same input therefore classified differently on
	// Windows, where one extra line arrived, and the transport reported a transport
	// failure for something only a person can fix.
	const process = new FakeProcess(child => {
		child.exitAfterStderr('Host key verification failed for build-vps\nTransferred: sent 1234, received 5678 bytes\n', 255);
	});
	const result = await openRemoteServer(input, deps([process], []));
	assert.deepEqual(result, { ok: false, code: 'ssh.host-key-untrusted', phase: 'connect', exitCode: 255 });
});
