/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	REMOTE_HANDSHAKE_PREFIX,
	buildRemoteBootstrapScript,
	parseRemoteHandshake
} from '../remoteServerHandshake.js';

const commit = '0123456789abcdef0123456789abcdef01234567';

test('derives versioned server paths and emits a POSIX bootstrap', () => {
	const result = buildRemoteBootstrapScript({ commit, remoteUserBaseDirectory: '/home/remote user' });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}

	assert.deepEqual(result.paths, {
		dataDirectory: '/home/remote user/.unigma-server',
		versionedDirectory: `/home/remote user/.unigma-server/bin/${commit}`,
		executablePath: `/home/remote user/.unigma-server/bin/${commit}/bin/unigma-server`,
		serverDataDirectory: `/home/remote user/.unigma-server/bin/${commit}/data`,
		socketPath: `/home/remote user/.unigma-server/bin/${commit}/.unigma-server.sock`
	});
	assert.ok(result.script.startsWith('#!/bin/sh\nset -eu\n'));
	assert.match(result.script, /VERSIONED='\/home\/remote user\/\.unigma-server\/bin\//);
	assert.match(result.script, /--socket-path \"\$SOCKET\"/);
	assert.match(result.script, /--without-connection-token/);
	assert.match(result.script, /--accept-server-license-terms/);
	assert.match(result.script, /--telemetry-level off/);
	assert.match(result.script, /--server-data-dir \"\$SERVER_DATA\"/);
	assert.match(result.script, /Extension host agent listening on \$SOCKET/);
	assert.equal(result.script.includes('ssh '), false);
});

test('refuses unsafe bootstrap input without generating a script', () => {
	for (const value of ['short', 'A'.repeat(40), '0'.repeat(39), '0'.repeat(41), '0'.repeat(39) + 'g']) {
		assert.deepEqual(buildRemoteBootstrapScript({ commit: value, remoteUserBaseDirectory: '/home/user' }), { valid: false, code: 'invalid-commit' });
	}
	for (const base of ['', ' /home/user', '/home/user\'s', '/home/user"s', '/home/$user', '/home/`user`', '/home/user\nname', 'home/user', '/home/../user']) {
		assert.deepEqual(buildRemoteBootstrapScript({ commit, remoteUserBaseDirectory: base }), { valid: false, code: 'invalid-base-directory' });
	}
});

test('parses every stable handshake variant and rejects unknown payloads', () => {
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready"}`), { kind: 'ready' });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable"}`), { kind: 'server-unavailable' });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"socket-occupied"}`), { kind: 'socket-occupied' });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"start-failed"}`), { kind: 'start-failed' });
	for (const line of [
		'',
		'Extension host agent listening on /tmp/socket',
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"other"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","target":"secret"}`,
		`${REMOTE_HANDSHAKE_PREFIX}not-json`
	]) {
		assert.deepEqual(parseRemoteHandshake(line), { kind: 'unrecognized' }, line);
	}
});
