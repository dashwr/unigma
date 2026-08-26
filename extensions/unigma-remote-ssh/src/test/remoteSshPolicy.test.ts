/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRemoteSshConnection } from '../remoteSshPolicy.js';

test('accepts the two controlled Linux remote matrix rows', () => {
	for (const clientPlatform of ['windows-x64', 'linux-x64'] as const) {
		assert.deepEqual(evaluateRemoteSshConnection({ clientPlatform, hostPlatform: 'linux-x64', workspaceTrusted: true, hostTrust: 'trusted' }), { accepted: true });
	}
});

test('refuses an untrusted host before transport', () => {
	assert.deepEqual(evaluateRemoteSshConnection({ clientPlatform: 'linux-x64', hostPlatform: 'linux-x64', workspaceTrusted: true, hostTrust: 'unknown' }), { accepted: false, code: 'ssh.host-key-untrusted' });
});

test('refuses Windows remote hosts and untrusted workspaces', () => {
	assert.deepEqual(evaluateRemoteSshConnection({ clientPlatform: 'windows-x64', hostPlatform: 'windows-x64', workspaceTrusted: true, hostTrust: 'trusted' }), { accepted: false, code: 'ssh.remote-platform-unsupported' });
	assert.deepEqual(evaluateRemoteSshConnection({ clientPlatform: 'linux-x64', hostPlatform: 'linux-x64', workspaceTrusted: false, hostTrust: 'trusted' }), { accepted: false, code: 'ssh.workspace-blocked' });
});
