/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
	REMOTE_HANDSHAKE_PREFIX,
	buildRemoteBootstrapScript,
	parseRemoteHandshake
} from '../remoteServerHandshake.js';
import { buildRemoteServerPathShellFragments } from '../remoteStagingPlan.js';

const commit = '0123456789abcdef0123456789abcdef01234567';

/**
 * Some tests run the generated script to prove the host-side behaviour, which
 * needs a POSIX shell. The script targets the remote host, and the remote host
 * is Linux by contract, so the client platform running the suite says nothing
 * about whether the script is correct. Skipping with a reason keeps a Windows
 * run honest instead of pretending the behaviour was verified there.
 */
const posixShell = { skip: existsSync('/bin/sh') ? false : 'requires a POSIX shell to run the host-side script' };

test('derives versioned server paths and emits a HOME-based POSIX bootstrap', () => {
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
		socketPath: `/home/remote user/.unigma-server/${commit.slice(0, 12)}.unigma-server.sock`
	});
	assert.match(result.script, /BASE=\$HOME/);
	assert.match(result.script, /SOCKET=\"\$BASE\/\.unigma-server\/\$COMMIT_PREFIX\.unigma-server\.sock\"/);
	assert.match(result.script, /SOCKET_BYTES=/);
	assert.match(result.script, /--socket-path \"\$SOCKET\"/);
	assert.match(result.script, /--without-connection-token/);
	assert.match(result.script, /"Extension host agent listening on "\*\)/);
	assert.equal(result.script.includes('ssh '), false);
});

test('reports readiness by prefix and reports the server status when it never arrives', () => {
	const result = buildRemoteBootstrapScript({ commit });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}
	// The server echoes the address it resolved. Comparing that against the
	// socket path made one round of normalisation on the far side look like a
	// server that never started, which is a different fault with a different fix.
	assert.equal(result.script.includes('[ "$line" = "Extension host agent listening on $SOCKET" ]'), false);
	// Readiness has to leave the subshell, and the exit status only exists
	// outside it, so the two meet through a file in the directory this session
	// already owns.
	assert.match(result.script, /: > "\$LOCK\/ready"/);
	assert.match(result.script, /if \[ ! -f "\$LOCK\/ready" \]; then/);
	assert.match(result.script, /"\{\\"status\\":\\"start-failed\\",\\"exit\\":\$server_status\}"/);
	assert.match(result.script, /rm -f "\$FIFO" "\$LOCK\/pid" "\$LOCK\/ready"/);
});

test('reuses the socket of the session that won the bootstrap race', () => {
	const result = buildRemoteBootstrapScript({ commit });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}
	const contended = result.script.slice(result.script.indexOf('if [ "$owned" -ne 1 ]; then'), result.script.indexOf('echo $$ > "$LOCK/pid"'));
	// The lock is scoped to one commit, so the holder is starting, or has
	// already started, the very server this session wanted. Reporting the lock
	// as a refusal denied four runner cycles a server that was healthy on the
	// host, with its own staging smoke passing in the same run.
	assert.match(contended, /if \[ -S "\$SOCKET" \]; then/);
	assert.match(contended, /\\"status\\":\\"ready\\"/);
	// Reuse is not ownership. Removing the socket, the pid or the lock here
	// would take the server away from the session that does own it, and a
	// cleanup trap on this path would do it on the way out.
	assert.equal(/\brm\b/.test(contended), false);
	assert.equal(/\brmdir\b/.test(contended), false);
	assert.equal(contended.includes('trap '), false);
	// The refusal survives for a lock nobody is serving behind.
	assert.match(contended, /'\{"status":"socket-occupied"\}'/);
});

test('accepts a bounded server exit status and refuses anything else in its place', () => {
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"start-failed","exit":137}`), { kind: 'start-failed', serverExitCode: 137 });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"start-failed"}`), { kind: 'start-failed' });
	// A status is a small number. Anything wider is a channel, so it is dropped
	// rather than forwarded into a log.
	for (const payload of ['{"status":"start-failed","exit":256}', '{"status":"start-failed","exit":-1}', '{"status":"start-failed","exit":1.5}', '{"status":"start-failed","exit":"137"}', '{"status":"start-failed","exit":137,"note":"x"}']) {
		assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}${payload}`), { kind: 'unrecognized' }, payload);
	}
});

test('generates shell fragments from the same path convention as TypeScript', () => {
	assert.deepEqual(buildRemoteServerPathShellFragments(), {
		dataDirectory: '"$BASE/.unigma-server"',
		versionedDirectory: '"$BASE/.unigma-server/bin/$COMMIT"',
		executablePath: '"$BASE/.unigma-server/bin/$COMMIT/bin/unigma-server"',
		serverDataDirectory: '"$BASE/.unigma-server/bin/$COMMIT/data"',
		socketPath: '"$BASE/.unigma-server/$COMMIT_PREFIX.unigma-server.sock"'
	});
	const result = buildRemoteBootstrapScript({ commit });
	assert.equal(result.valid, true);
	if (result.valid) {
		assert.equal(result.paths, undefined);
		assert.match(result.script, /COMMIT_PREFIX=\$\{COMMIT%\?{28}\}/);
	}
});

test('can hold the owned SSH master for an explicit staging action', () => {
	const result = buildRemoteBootstrapScript({ commit, retainControlMasterOnServerUnavailable: true });
	assert.equal(result.valid, true);
	if (result.valid) {
		assert.match(result.script, /while :; do sleep 3600; done/);
	}
});

test('refuses unsafe bootstrap input without generating a script', () => {
	for (const value of ['short', 'A'.repeat(40), '0'.repeat(39), '0'.repeat(41), '0'.repeat(39) + 'g']) {
		assert.deepEqual(buildRemoteBootstrapScript({ commit: value, remoteUserBaseDirectory: '/home/user' }), { valid: false, code: 'invalid-commit' });
	}
	for (const base of ['', ' /home/user', '/home/user\'s', '/home/user"s', '/home/$user', '/home/`user`', '/home/user\nname', 'home/user', '/home/../user']) {
		assert.deepEqual(buildRemoteBootstrapScript({ commit, remoteUserBaseDirectory: base }), { valid: false, code: 'invalid-base-directory' });
	}
});

test('fails closed when the remote HOME is invalid', posixShell, () => {
	const result = buildRemoteBootstrapScript({ commit });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}
	for (const home of ['', 'relative-home', join(tmpdir(), 'does-not-exist-unigma-home')]) {
		assert.throws(() => execFileSync('/bin/sh', ['-s'], { input: result.script, env: { HOME: home }, stdio: ['pipe', 'pipe', 'ignore'] }), error => {
			return (error as { status?: number }).status === 44;
		});
	}
});

test('detects an overlong socket path on the remote host', posixShell, () => {
	const root = mkdtempSync(join(tmpdir(), 'ug-'));
	const home = join(root, 'nested/'.repeat(20), 'home');
	mkdirSync(home, { recursive: true });
	const result = buildRemoteBootstrapScript({ commit });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}
	try {
		const status = (() => {
			try {
				execFileSync('/bin/sh', ['-s'], { input: result.script, env: { HOME: home }, stdio: ['pipe', 'pipe', 'ignore'] });
				return 0;
			} catch (error) {
				return (error as { status?: number }).status;
			}
		})();
		assert.equal(status, 45);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('parses stable handshake variants and rejects invalid socket paths', () => {
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","socketPath":"/tmp/server.sock"}`), { kind: 'ready', socketPath: '/tmp/server.sock' });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable"}`), { kind: 'server-unavailable' });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"home-invalid"}`), { kind: 'home-invalid' });
	assert.deepEqual(parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"socket-path-too-long"}`), { kind: 'socket-path-too-long' });
	for (const line of [
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","socketPath":"relative.sock"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","socketPath":"/tmp/../server.sock"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","socketPath":"/tmp/server\\nsock"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","socketPath":"/${'x'.repeat(101)}"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"ready","socketPath":"/tmp/server.sock","target":"secret"}`,
		`${REMOTE_HANDSHAKE_PREFIX}{"status":"other"}`,
		`${REMOTE_HANDSHAKE_PREFIX}not-json`
	]) {
		assert.deepEqual(parseRemoteHandshake(line), { kind: 'unrecognized' }, line);
	}
});

test('refuses an explicit base directory that pushes the socket past the address limit', () => {
	const deep = `/home/remote user/${'nested/'.repeat(12)}workspace`;
	const result = buildRemoteBootstrapScript({ commit, remoteUserBaseDirectory: deep });
	assert.deepEqual(result, { valid: false, code: 'socket-path-too-long' });
});

test('accepts the server-unavailable reason and refuses anything else in that envelope', () => {
	// The envelope rule is one key per status, and this is the single status that
	// carries a second field. Adding the field without teaching the parser turned
	// every server-unavailable into unrecognized, which is how a staging session
	// that had been passing started to fail.
	assert.deepEqual(
		parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable","reason":"missing-version"}`),
		{ kind: 'server-unavailable', reason: 'missing-version' }
	);
	assert.deepEqual(
		parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable","reason":"entry-point-not-executable"}`),
		{ kind: 'server-unavailable', reason: 'entry-point-not-executable' }
	);
	assert.deepEqual(
		parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable"}`),
		{ kind: 'server-unavailable' }
	);
	// A reason the script never emits would be host data travelling into a log.
	assert.deepEqual(
		parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable","reason":"/root/anything"}`),
		{ kind: 'unrecognized' }
	);
	assert.deepEqual(
		parseRemoteHandshake(`${REMOTE_HANDSHAKE_PREFIX}{"status":"server-unavailable","reason":"missing-version","extra":1}`),
		{ kind: 'unrecognized' }
	);
});
