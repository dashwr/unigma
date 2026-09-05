/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { isTransientRemoteSshFailure, isRemoteStagingConfirmed, resolveClientCommitFromProduct, mapRemoteServerFailure, resolveRemoteSsh, CLIENT_COMMIT_UNAVAILABLE } from '../remoteSshResolver.js';
import type { RemoteServerSession } from '../remoteServerTransport.js';
import type { RemoteSshLocalObservation } from '../remoteSshPreflight.js';

const commit = '0123456789abcdef0123456789abcdef01234567';
const local: RemoteSshLocalObservation = {
	authority: 'ssh-remote+build-vps',
	workspaceTrusted: true,
	clientPlatform: 'linux-x64',
	openSsh: { available: true, version: { major: 10, minor: 5, banner: 'OpenSSH_10.5' } }
};
const session = { endpoint: { host: '127.0.0.1', port: 43123 }, controlPath: '/tmp/ug-control/c', dispose: async () => undefined } satisfies RemoteServerSession;

test('accepts only a full product SHA-1 and normalizes its case', () => {
	assert.deepEqual(resolveClientCommitFromProduct({ commit: commit.toUpperCase() }), { ok: true, commit });
	for (const product of [{}, { commit: 'HEAD' }, { commit: 'short' }, { commit: 'g'.repeat(40) }]) {
		assert.deepEqual(resolveClientCommitFromProduct(product), { ok: false, code: CLIENT_COMMIT_UNAVAILABLE });
	}
});

test('requires the explicit staging confirmation action', () => {
	assert.equal(isRemoteStagingConfirmed('Stage Remote Server'), true);
	assert.equal(isRemoteStagingConfirmed(undefined), false);
	assert.equal(isRemoteStagingConfirmed('Cancel'), false);
});

test('maps every transport failure to a contract category and phase', () => {
	assert.deepEqual(mapRemoteServerFailure({ ok: false, code: 'ssh.forward-failed', phase: 'forward' }), { code: 'ssh.transport-failed', phase: 'forward' });
	assert.deepEqual(mapRemoteServerFailure({ ok: false, code: 'ssh.remote-home-invalid', phase: 'handshake' }), { code: 'ssh.workspace-blocked', phase: 'handshake' });
	assert.deepEqual(mapRemoteServerFailure({ ok: false, code: 'ssh.host-key-untrusted', phase: 'connect' }), { code: 'ssh.host-key-untrusted', phase: 'connect' });
});

test('runs gates, commit resolution and transport in order, failing closed', async () => {
	const calls: string[] = [];
	const result = await resolveRemoteSsh(local, {
		resolveClientCommit: () => { calls.push('commit'); return { ok: true, commit }; },
		openRemoteServer: async input => { calls.push(`${input.destination}:${input.commit}`); return session; }
	});
	assert.equal(result.ok, true);
	assert.deepEqual(calls, ['commit', `build-vps:${commit}`]);

	const unavailable = await resolveRemoteSsh(local, {
		resolveClientCommit: () => ({ ok: false, code: CLIENT_COMMIT_UNAVAILABLE }),
		openRemoteServer: async () => { throw new Error('must not open'); }
	});
	assert.deepEqual(unavailable, { ok: false, code: CLIENT_COMMIT_UNAVAILABLE, phase: 'commit' });
});

test('carries the exit status out of a transport failure', async () => {
	// `ssh.remote-server-unavailable` is both the explicit refusal and the verdict
	// for a session that died without saying anything, so the code alone cannot
	// tell them apart. A smoke run reported it with no reason and the evidence
	// could not explain it; the exit status is what separates the two.
	const failed = await resolveRemoteSsh(local, {
		resolveClientCommit: () => ({ ok: true, commit }),
		openRemoteServer: async () => ({ ok: false, code: 'ssh.remote-server-unavailable', phase: 'handshake', exitCode: 255 })
	});
	assert.equal(failed.ok, false);
	assert.equal(failed.ok === false && failed.exitCode, 255);

	// A failure that never closed a process must not invent one.
	const noExit = await resolveRemoteSsh(local, {
		resolveClientCommit: () => ({ ok: true, commit }),
		openRemoteServer: async () => ({ ok: false, code: 'ssh.remote-server-unavailable', phase: 'handshake', reason: 'missing-version' })
	});
	assert.equal(noExit.ok === false && noExit.exitCode, undefined);
	assert.equal(noExit.ok === false && noExit.reason, 'missing-version');
});

test('classifies only recoverable failures as transient', () => {
	// During reconnection the workbench treats NotAvailable as final, so a dropped
	// channel reported that way ends the window instead of coming back.
	assert.equal(isTransientRemoteSshFailure('ssh.connection-lost'), true);
	assert.equal(isTransientRemoteSshFailure('ssh.transport-failed'), true);

	// A busy bootstrap lock is the one server-side refusal that clears itself:
	// the session holding it finishes and the next attempt wins the lock.
	assert.equal(isTransientRemoteSshFailure('ssh.remote-server-busy'), true);

	// These need a person. Retrying them only hides the message that says so.
	for (const code of [
		'ssh.remote-server-unavailable',
		// The server already failed to come up; retrying repeats the failure.
		'ssh.remote-server-start-failed',
		'ssh.remote-server-incompatible',
		'ssh.host-key-untrusted',
		'ssh.authentication-unavailable',
		'ssh.client-unavailable',
		'ssh.target-unresolved',
		'ssh.workspace-blocked',
		'ssh.remote-platform-unsupported',
		'ssh.provisioning-denied',
		'ssh.client-commit-unavailable'
	] as const) {
		assert.equal(isTransientRemoteSshFailure(code), false, code);
	}
});
