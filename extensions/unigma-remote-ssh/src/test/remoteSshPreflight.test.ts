/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	describeRemoteSshFailure,
	detectClientPlatform,
	evaluateRemoteSshPreflight,
	type RemoteSshFailureCode,
	type RemoteSshHostObservation,
	type RemoteSshLocalObservation
} from '../remoteSshPreflight.js';

const local: RemoteSshLocalObservation = {
	authority: 'ssh-remote+build-vps',
	workspaceTrusted: true,
	clientPlatform: 'linux-x64',
	openSsh: { available: true, version: { major: 10, minor: 5, portable: 'p1', banner: 'OpenSSH_10.5p1' } }
};

const host: RemoteSshHostObservation = {
	hostPlatform: 'linux-x64',
	hostTrust: 'trusted',
	connectionState: 'ready',
	remoteServerCompatibility: 'compatible'
};

test('maps the running process to a contract platform row', () => {
	assert.equal(detectClientPlatform('linux', 'x64'), 'linux-x64');
	assert.equal(detectClientPlatform('win32', 'x64'), 'windows-x64');
	assert.equal(detectClientPlatform('linux', 'arm64'), 'other');
	assert.equal(detectClientPlatform('win32', 'arm64'), 'other');
	assert.equal(detectClientPlatform('darwin', 'x64'), 'other');
	assert.equal(detectClientPlatform('freebsd', 'x64'), 'other');
});

test('refuses without a host observation, because no session was established', () => {
	assert.deepEqual(evaluateRemoteSshPreflight(local), {
		accepted: false,
		code: 'ssh.remote-server-unavailable',
		phase: 'host'
	});
});

test('accepts only when every local gate and every host gate is satisfied', () => {
	for (const clientPlatform of ['windows-x64', 'linux-x64'] as const) {
		assert.deepEqual(evaluateRemoteSshPreflight({ ...local, clientPlatform }, host), {
			accepted: true,
			target: { kind: 'alias', alias: 'build-vps' }
		});
	}
});

test('evaluates the local gates in contract order', () => {
	// An untrusted workspace wins over every other broken gate below it.
	assert.deepEqual(
		evaluateRemoteSshPreflight({
			authority: 'ssh-remote+-oProxyCommand',
			workspaceTrusted: false,
			clientPlatform: 'other',
			openSsh: { available: false, reason: 'not-found' }
		}),
		{ accepted: false, code: 'ssh.workspace-blocked', phase: 'workspace' }
	);

	// Platform precedes the client probe.
	assert.deepEqual(
		evaluateRemoteSshPreflight({ ...local, clientPlatform: 'other', openSsh: { available: false, reason: 'not-found' } }),
		{ accepted: false, code: 'ssh.remote-platform-unsupported', phase: 'platform' }
	);

	// The client probe precedes target parsing.
	assert.deepEqual(
		evaluateRemoteSshPreflight({ ...local, authority: 'ssh-remote+', openSsh: { available: false, reason: 'not-found' } }),
		{ accepted: false, code: 'ssh.client-unavailable', phase: 'client' }
	);
});

test('maps every OpenSSH unavailability to ssh.client-unavailable', () => {
	for (const reason of ['not-found', 'not-executable', 'timed-out', 'unrecognized-implementation'] as const) {
		assert.deepEqual(evaluateRemoteSshPreflight({ ...local, openSsh: { available: false, reason } }, host), {
			accepted: false,
			code: 'ssh.client-unavailable',
			phase: 'client'
		});
	}
});

test('maps an invalid authority to ssh.target-unresolved and keeps the rejection reason', () => {
	assert.deepEqual(evaluateRemoteSshPreflight({ ...local, authority: 'ssh-remote+-oProxyCommand' }, host), {
		accepted: false,
		code: 'ssh.target-unresolved',
		phase: 'authority',
		rejection: 'target-option-like'
	});
	assert.deepEqual(evaluateRemoteSshPreflight({ ...local, authority: 'vscode-remote+host' }, host), {
		accepted: false,
		code: 'ssh.target-unresolved',
		phase: 'authority',
		rejection: 'authority-prefix-mismatch'
	});
});

test('delegates every host gate to the frozen T-013 policy', () => {
	assert.deepEqual(evaluateRemoteSshPreflight(local, { ...host, hostPlatform: 'windows-x64' }), {
		accepted: false,
		code: 'ssh.remote-platform-unsupported',
		phase: 'host'
	});
	for (const hostTrust of ['unknown', 'mismatched', 'revoked'] as const) {
		assert.deepEqual(evaluateRemoteSshPreflight(local, { ...host, hostTrust }), {
			accepted: false,
			code: 'ssh.host-key-untrusted',
			phase: 'host'
		});
	}
	assert.deepEqual(evaluateRemoteSshPreflight(local, { ...host, connectionState: 'interrupted' }), {
		accepted: false,
		code: 'ssh.connection-lost',
		phase: 'host'
	});
	assert.deepEqual(evaluateRemoteSshPreflight(local, { ...host, remoteServerCompatibility: 'incompatible' }), {
		accepted: false,
		code: 'ssh.remote-server-incompatible',
		phase: 'host'
	});
});

test('fails closed when a local gate is absent instead of false', () => {
	const absent = { authority: 'ssh-remote+build-vps' } as unknown as RemoteSshLocalObservation;
	assert.deepEqual(evaluateRemoteSshPreflight(absent), {
		accepted: false,
		code: 'ssh.workspace-blocked',
		phase: 'workspace'
	});

	const noProbe = { ...local, openSsh: undefined } as unknown as RemoteSshLocalObservation;
	assert.deepEqual(evaluateRemoteSshPreflight(noProbe), {
		accepted: false,
		code: 'ssh.client-unavailable',
		phase: 'client'
	});
});

test('every failure has a message and none of them leaks target or credential material', () => {
	const codes: readonly RemoteSshFailureCode[] = [
		'ssh.workspace-blocked',
		'ssh.remote-platform-unsupported',
		'ssh.client-unavailable',
		'ssh.target-unresolved',
		'ssh.host-key-untrusted',
		'ssh.connection-lost',
		'ssh.remote-server-incompatible',
		'ssh.remote-server-unavailable',
		'ssh.remote-server-busy',
		'ssh.remote-server-start-failed'
	];

	for (const code of codes) {
		const message = describeRemoteSshFailure(code);
		assert.ok(message.startsWith(`${code}: `), code);
		assert.ok(message.length > code.length + 2, code);
		for (const forbidden of ['build-vps', 'build.example.com', 'deploy@', 'known_hosts', 'IdentityFile', 'password', 'passphrase', 'token']) {
			assert.equal(message.includes(forbidden), false, `${code} must not mention ${forbidden}`);
		}
	}
});

test('the blocked remote-server message names the open work instead of promising support', () => {
	const message = describeRemoteSshFailure('ssh.remote-server-unavailable');
	assert.equal(message, 'ssh.remote-server-unavailable: the matching unigma-server is not staged for this client commit. Run "Stage Remote Server" (unigma.remoteSsh.stageRemoteServer), then retry.');
});

test('only the missing server sends the reader to the staging command', () => {
	// The point of separating these codes is the instruction each one gives.
	// If a present-but-unusable server still told the reader to stage, the
	// separation would exist in the type system and nowhere a user can see.
	for (const code of ['ssh.remote-server-busy', 'ssh.remote-server-start-failed'] as const) {
		const message = describeRemoteSshFailure(code);
		assert.equal(message.includes('stageRemoteServer'), false, code);
		assert.ok(message.includes('would not help'), code);
	}
});
