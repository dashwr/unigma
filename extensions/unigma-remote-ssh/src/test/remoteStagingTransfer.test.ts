/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
	buildRemoteStagingExecutionArguments,
	buildRemoteStagingScriptDeliveryArguments,
	stageRemotePayload,
	type RemotePayloadTarProcess,
	type RemoteStagingSshProcess,
	type RemoteStagingTransferDependencies,
	type RemoteStagingTransferInput
} from '../remoteStagingTransfer.js';
import type { BootstrapManifest } from '../bootstrapManifest.js';

const commit = '0123456789abcdef0123456789abcdef01234567';
const manifest: BootstrapManifest = {
	schemaVersion: 1,
	product: 'unigma',
	clientCommit: commit,
	serverCommit: commit,
	target: { os: 'linux', arch: 'x64' },
	totalSizeBytes: 3,
	files: [
		{ id: 'unigma-server', relativePath: 'server/unigma-server.tar.gz', sizeBytes: 1, sha256: 'a'.repeat(64) },
		{ id: 'unigma+opencode', relativePath: 'bin/opencode', sizeBytes: 2, sha256: 'b'.repeat(64) }
	]
};

class FakeSshProcess extends EventEmitter implements RemoteStagingSshProcess {
	readonly stdin = new PassThrough();
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	readonly killed: string[] = [];

	constructor(private readonly onInput?: (process_: FakeSshProcess) => void) {
		super();
		this.stdin.on('finish', () => this.onInput?.(this));
	}

	kill(signal?: NodeJS.Signals): boolean {
		this.killed.push(signal ?? 'SIGTERM');
		queueMicrotask(() => this.emit('close', null, signal));
		return true;
	}
}

class FakeTarProcess extends EventEmitter implements RemotePayloadTarProcess {
	readonly stdout = new PassThrough();

	constructor(private readonly status: number | null = 0) {
		super();
		queueMicrotask(() => {
			this.stdout.end('synthetic-tar-stream');
			this.emit('close', this.status, null);
		});
	}

	kill(): boolean {
		return true;
	}
}

function input(confirm: RemoteStagingTransferInput['confirm'] = () => true): RemoteStagingTransferInput {
	return {
		destination: 'build-vps',
		controlPath: '/tmp/ug-control/c',
		payloadDirectory: '/tmp/payload with spaces',
		commit,
		manifest,
		confirm
	};
}

function dependencies(master: FakeSshProcess, execution: FakeSshProcess, tar = new FakeTarProcess()): RemoteStagingTransferDependencies {
	let index = 0;
	return {
		spawn: arguments_ => {
			assert.ok(arguments_.includes('build-vps'));
			return index++ === 0 ? master : execution;
		},
		spawnPayloadTar: () => tar,
		diagnose: diagnostic => {
			assert.ok(diagnostic.phase.length > 0);
		},
	};
}

function successfulMaster(): FakeSshProcess {
	return new FakeSshProcess(process_ => process_.emit('close', 0, null));
}

function executionWithStatus(status: string): FakeSshProcess {
	return new FakeSshProcess(process_ => {
		if (status !== 'silent') {
			process_.stdout.end(`unigma-remote:{"status":"${status}"}\n`);
		}
		process_.emit('close', status === 'silent' ? 1 : 0, null);
	});
}

test('does not put the script body in argv and sends the payload as one stdin stream', async () => {
	const master = successfulMaster();
	const execution = executionWithStatus('activated');
	const confirmation: unknown[] = [];
	const result = await stageRemotePayload(input(summary => {
		confirmation.push(summary);
		return true;
	}), dependencies(master, execution));
	assert.deepEqual(result, { ok: true, status: 'activated', version: commit });
	assert.equal(confirmation.length, 1);
	assert.equal((confirmation[0] as { host: string }).host, 'build-vps');
	assert.equal(Buffer.concat([]).length, 0);
	const deliveryArguments = buildRemoteStagingScriptDeliveryArguments(input());
	assert.equal(deliveryArguments.some(argument => argument.includes('#!/bin/sh')), false);
	assert.deepEqual(buildRemoteStagingExecutionArguments(input()).slice(-2), ['/bin/sh', '"$HOME/.unigma-staging-0123456789abcdef0123456789abcdef01234567.sh"']);
});

test('refuses before spawning when confirmation is absent or negative', async () => {
	let spawned = 0;
	const deps = dependencies(successfulMaster(), executionWithStatus('activated'));
	const noConfirmation = await stageRemotePayload({ ...input(), confirm: undefined as unknown as RemoteStagingTransferInput['confirm'] }, { ...deps, spawn: () => { spawned++; throw new Error('must not spawn'); } });
	assert.deepEqual(noConfirmation, { ok: false, code: 'invalid-input', phase: 'validation' });
	const negative = await stageRemotePayload(input(() => false), { ...deps, spawn: () => { spawned++; throw new Error('must not spawn'); } });
	assert.deepEqual(negative, { ok: false, code: 'ssh.provisioning-denied', phase: 'confirmation' });
	assert.equal(spawned, 0);
});

test('maps remote manifest, missing-file and extra-file refusals', async () => {
	for (const status of ['manifest-invalid', 'file-missing', 'payload-extra-file']) {
		const result = await stageRemotePayload(input(), dependencies(successfulMaster(), executionWithStatus(status)));
		assert.deepEqual(result, { ok: false, code: 'ssh.provisioning-denied', phase: 'remote-execution', remoteStatus: status });
	}
});

test('returns already-activated without rewriting the version', async () => {
	const result = await stageRemotePayload(input(), dependencies(successfulMaster(), executionWithStatus('already-activated')));
	assert.deepEqual(result, { ok: true, status: 'already-activated', version: commit });
});

test('accepts already-activated when the remote closes stdin before consuming the tar', async () => {
	const execution = new FakeSshProcess(process_ => {
		process_.stdin.emit('error', Object.assign(new Error('closed'), { code: 'EPIPE' }));
		process_.stdout.end('unigma-remote:{"status":"already-activated"}\n');
		process_.emit('close', 0, null);
	});
	const result = await stageRemotePayload(input(), dependencies(successfulMaster(), execution));
	assert.deepEqual(result, { ok: true, status: 'already-activated', version: commit });
});

test('times out a delivery stage and terminates the SSH child', async () => {
	const master = new FakeSshProcess();
	const result = await stageRemotePayload({ ...input(), scriptDeliveryTimeoutMs: 5 }, dependencies(master, executionWithStatus('activated')));
	assert.deepEqual(result, { ok: false, code: 'ssh.transport-failed', phase: 'script-delivery' });
	assert.deepEqual(master.killed, ['SIGTERM']);
});

test('fails closed for an invalid local manifest before confirmation', async () => {
	let confirmed = false;
	const result = await stageRemotePayload({ ...input(() => { confirmed = true; return true; }), manifest: { ...manifest, totalSizeBytes: 4 } }, dependencies(successfulMaster(), executionWithStatus('activated')));
	assert.deepEqual(result, { ok: false, code: 'invalid-input', phase: 'validation' });
	assert.equal(confirmed, false);
});
