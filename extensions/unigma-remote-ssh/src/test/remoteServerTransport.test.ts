/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
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
	commit: '0123456789abcdef0123456789abcdef01234567',
	remoteUserBaseDirectory: '/home/remote user'
};

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
}

function deps(process: FakeProcess, diagnostics: RemoteServerDiagnostic[] = []): RemoteServerTransportDependencies {
	return {
		allocateLocalPort: async () => 43123,
		spawn: arguments_ => {
			assert.ok(arguments_.includes('build-vps'));
			return process;
		},
		diagnose: diagnostic => diagnostics.push(diagnostic)
	};
}

test('builds the single SSH command with verification-only host key handling', () => {
	assert.deepEqual(buildSshTransportArguments({
		destination: 'build-vps',
		localPort: 43123,
		remoteSocketPath: '/home/remote user/.unigma-server/bin/0123456789abcdef0123456789abcdef01234567/.unigma-server.sock'
	}), [
		'-o', 'BatchMode=yes',
		'-o', 'ExitOnForwardFailure=yes',
		'-o', 'StrictHostKeyChecking=yes',
		'-L', '127.0.0.1:43123:/home/remote user/.unigma-server/bin/0123456789abcdef0123456789abcdef01234567/.unigma-server.sock',
		'build-vps', '--', '/bin/sh', '-s'
	]);
});

test('uses a disposable known_hosts file without changing global trust', () => {
	const arguments_ = buildSshTransportArguments({
		destination: 'build-vps',
		localPort: 43123,
		remoteSocketPath: '/tmp/server.sock',
		knownHostsFile: '/tmp/unigma-smoke-known-hosts'
	});
	assert.deepEqual(arguments_.slice(0, 10), [
		'-o', 'BatchMode=yes',
		'-o', 'ExitOnForwardFailure=yes',
		'-o', 'StrictHostKeyChecking=yes',
		'-o', 'UserKnownHostsFile=/tmp/unigma-smoke-known-hosts',
		'-o', 'GlobalKnownHostsFile=/dev/null'
	]);
});

test('does not add known_hosts overrides when no disposable file is supplied', () => {
	const arguments_ = buildSshTransportArguments({
		destination: 'build-vps',
		localPort: 43123,
		remoteSocketPath: '/tmp/server.sock'
	});
	assert.equal(arguments_.some(argument => argument.startsWith('UserKnownHostsFile=')), false);
	assert.equal(arguments_.some(argument => argument.startsWith('GlobalKnownHostsFile=')), false);
});

test('opens the tunnel after one ready handshake and disposes its owned process', async () => {
	const process = new FakeProcess(child => {
		child.stdout.write('server startup noise\n');
		child.stdout.end('unigma-remote:{"status":"ready"}\n');
	});
	const session = await openRemoteServer(input, deps(process));
	const successfulSession = session as RemoteServerSession;
	assert.deepEqual(successfulSession.endpoint, { host: '127.0.0.1', port: 43123 });
	assert.equal(Buffer.concat(process.scriptChunks).toString().includes('--without-connection-token'), true);
	await successfulSession.dispose();
	await successfulSession.dispose();
	assert.deepEqual(process.killed, ['SIGTERM']);
});

test('forwards the disposable known_hosts seam to the SSH command', async () => {
	const process = new FakeProcess(child => child.stdout.end('unigma-remote:{"status":"ready"}\n'));
	let arguments_: readonly string[] = [];
	const result = await openRemoteServer({ ...input, knownHostsFile: '/tmp/smoke-known-hosts' }, {
		...deps(process),
		spawn: values => {
			arguments_ = values;
			return process;
		}
	});
	assert.equal((result as { readonly ok?: boolean }).ok, undefined);
	assert.ok(arguments_.includes('-o'));
	assert.ok(arguments_.includes('UserKnownHostsFile=/tmp/smoke-known-hosts'));
	assert.ok(arguments_.includes('GlobalKnownHostsFile=/dev/null'));
	await (result as RemoteServerSession).dispose();
});

test('maps a bootstrap failure handshake to an observable remote-server failure', async () => {
	const process = new FakeProcess(child => child.stdout.end('unigma-remote:{"status":"server-unavailable"}\n'));
	const result = await openRemoteServer(input, deps(process));
	assert.deepEqual(result, { ok: false, code: 'ssh.remote-server-unavailable', phase: 'handshake' });
	assert.deepEqual(process.killed, ['SIGTERM']);
});

test('times out a silent SSH process and terminates it', async () => {
	const process = new FakeProcess();
	const diagnostics: RemoteServerDiagnostic[] = [];
	const result = await openRemoteServer({ ...input, timeoutMs: 5 }, deps(process, diagnostics));
	assert.deepEqual(result, { ok: false, code: 'ssh.transport-failed', phase: 'handshake' });
	assert.deepEqual(process.killed, ['SIGTERM']);
	assert.equal(diagnostics.some(diagnostic => diagnostic.category === 'ssh.transport-failed' && diagnostic.phase === 'handshake'), true);
});

test('categorizes SSH stderr without forwarding its contents', async () => {
	const process = new FakeProcess(child => {
		child.stderr.end('Host key verification failed for build-vps\n');
		child.emit('close', 255, null);
	});
	const diagnostics: RemoteServerDiagnostic[] = [];
	const result = await openRemoteServer(input, deps(process, diagnostics));
	assert.deepEqual(result, { ok: false, code: 'ssh.host-key-untrusted', phase: 'connect', exitCode: 255 });
	assert.equal(diagnostics.every(diagnostic => !JSON.stringify(diagnostic).includes('build-vps')), true);
});
