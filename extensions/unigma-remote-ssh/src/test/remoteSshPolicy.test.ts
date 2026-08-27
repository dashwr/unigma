/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRemoteSshConnection, type RemoteSshConnectionRequest } from '../remoteSshPolicy.js';

const allowedRequest: RemoteSshConnectionRequest = {
	clientPlatform: 'linux-x64',
	hostPlatform: 'linux-x64',
	workspaceTrusted: true,
	openSsh: 'available',
	target: 'valid',
	hostTrust: 'trusted',
	connectionState: 'ready',
	remoteServerCompatibility: 'compatible',
};

test('accepts the two controlled Linux remote matrix rows', () => {
	for (const clientPlatform of ['windows-x64', 'linux-x64'] as const) {
		assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, clientPlatform }), { accepted: true });
	}
});

test('refuses every known_hosts failure before authentication', () => {
	for (const hostTrust of ['unknown', 'mismatched', 'revoked'] as const) {
		assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, hostTrust }), { accepted: false, code: 'ssh.host-key-untrusted' });
	}
});

test('refuses platforms outside the remote matrix', () => {
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, hostPlatform: 'windows-x64' }), { accepted: false, code: 'ssh.remote-platform-unsupported' });
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, hostPlatform: 'other' }), { accepted: false, code: 'ssh.remote-platform-unsupported' });
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, clientPlatform: 'other' }), { accepted: false, code: 'ssh.remote-platform-unsupported' });
});

test('refuses each remaining unavailable connection gate', () => {
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, workspaceTrusted: false }), { accepted: false, code: 'ssh.workspace-blocked' });
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, openSsh: 'unavailable' }), { accepted: false, code: 'ssh.client-unavailable' });
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, target: 'invalid' }), { accepted: false, code: 'ssh.target-unresolved' });
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, connectionState: 'interrupted' }), { accepted: false, code: 'ssh.connection-lost' });
	assert.deepEqual(evaluateRemoteSshConnection({ ...allowedRequest, remoteServerCompatibility: 'incompatible' }), { accepted: false, code: 'ssh.remote-server-incompatible' });
});

test('fails closed when any required gate is absent', () => {
	const cases: readonly [keyof RemoteSshConnectionRequest, { readonly accepted: false; readonly code: string }][] = [
		['workspaceTrusted', { accepted: false, code: 'ssh.workspace-blocked' }],
		['clientPlatform', { accepted: false, code: 'ssh.remote-platform-unsupported' }],
		['hostPlatform', { accepted: false, code: 'ssh.remote-platform-unsupported' }],
		['openSsh', { accepted: false, code: 'ssh.client-unavailable' }],
		['target', { accepted: false, code: 'ssh.target-unresolved' }],
		['hostTrust', { accepted: false, code: 'ssh.host-key-untrusted' }],
		['connectionState', { accepted: false, code: 'ssh.connection-lost' }],
		['remoteServerCompatibility', { accepted: false, code: 'ssh.remote-server-incompatible' }],
	];

	for (const [gate, expected] of cases) {
		const request = { ...allowedRequest } as Record<string, unknown>;
		delete request[gate];
		assert.deepEqual(evaluateRemoteSshConnection(request as unknown as RemoteSshConnectionRequest), expected);
	}
});

test('returns a decision only, without a credential, fallback, or replay instruction', () => {
	assert.deepEqual(Object.keys(evaluateRemoteSshConnection(allowedRequest)), ['accepted']);
	assert.deepEqual(Object.keys(evaluateRemoteSshConnection({ ...allowedRequest, connectionState: 'interrupted' })), ['accepted', 'code']);
});
