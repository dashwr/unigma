/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRemoteStagingScript, parseRemoteStagingHandshake } from '../remoteStagingScript.js';
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

test('generates a closed host-side staging script from the validated manifest', () => {
	const result = buildRemoteStagingScript({ commit, manifest });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}
	assert.match(result.script, /^#!\/bin\/sh\nset -eu/m);
	assert.match(result.script, /sha256sum/);
	assert.match(result.script, /tar --no-same-owner --no-same-permissions -xzf/);
	assert.match(result.script, /mv -T/);
	assert.match(result.script, /\$BASE\/\.unigma-server\/staging\/\$COMMIT/);
	assert.doesNotMatch(result.script, /status.*sha256|sha256.*status/);
	assert.match(result.manifestHash, /^[a-f0-9]{64}$/);
});

test('rejects invalid commits, targets, paths and incomplete payload pairs', () => {
	assert.deepEqual(buildRemoteStagingScript({ commit: 'short', manifest }), { valid: false, code: 'staging-invalid-commit' });
	assert.deepEqual(buildRemoteStagingScript({ commit, manifest: { ...manifest, target: { os: 'windows', arch: 'x64' } } }), { valid: false, code: 'staging-invalid-target' });
	assert.deepEqual(buildRemoteStagingScript({ commit, manifest: { ...manifest, files: [{ ...manifest.files[0], relativePath: '../archive' }, manifest.files[1]] } }), { valid: false, code: 'staging-invalid-manifest' });
	assert.deepEqual(buildRemoteStagingScript({ commit, manifest: { ...manifest, files: [manifest.files[0]] } }), { valid: false, code: 'staging-invalid-manifest' });
});

test('parses only the redacted staging handshake statuses', () => {
	assert.deepEqual(parseRemoteStagingHandshake('unigma-remote:{"status":"activated"}'), { kind: 'activated' });
	assert.deepEqual(parseRemoteStagingHandshake('unigma-remote:{"status":"already-activated"}'), { kind: 'already-activated' });
	assert.deepEqual(parseRemoteStagingHandshake('unigma-remote:{"status":"file-hash-mismatch"}'), { kind: 'file-hash-mismatch' });
	assert.equal(parseRemoteStagingHandshake('unigma-remote:{"status":"activated","hash":"secret"}'), undefined);
});

test('routes every recursive removal through the guard, with no path sentinel', () => {
	const result = buildRemoteStagingScript({ commit, manifest });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}

	// This script is expected to run as root on some hosts. A `/dev/null`
	// sentinel removed the device node when the trap fired before the real
	// assignment, and an unguarded recursive removal is the difference between
	// clearing a staging directory and destroying the host.
	assert.doesNotMatch(result.script, /STAGING=\/dev\/null/);
	assert.match(result.script, /^STAGING=$/m);

	const recursive = result.script.split('\n').filter(line => /\brm\s+-[a-z]*r/.test(line));
	assert.equal(recursive.length, 1, `expected one recursive removal, found ${recursive.length}`);
	assert.match(recursive[0], /rm -rf -- "\$target"/);

	// The guard must refuse an empty target, an unset root and anything outside
	// the directory the script owns, and must not be reachable by traversal.
	assert.match(result.script, /\[ -n "\$target" \] \|\| return 0/);
	assert.match(result.script, /\[ -n "\$\{DATA_DIRECTORY:-\}" \] \|\| return 0/);
	assert.match(result.script, /"\$DATA_DIRECTORY"\/\?\*\) ;;/);
	assert.match(result.script, /\*\/\.\.\|\*\/\.\.\/\*\) return 0 ;;/);

	// The guard refuses silently, so the caller has to assert the post-condition.
	assert.match(result.script, /if \[ -e "\$STAGING" \] \|\| \[ -L "\$STAGING" \]; then fail staging-failed/);
});

test('never lets an archive choose ownership or mode on the remote host', () => {
	const result = buildRemoteStagingScript({ commit, manifest });
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}

	// Running as root, tar restores the ownership and the permission bits recorded
	// in the archive, setuid included, and extraction happens before the manifest
	// is verified. Without these flags a payload decides what lands on disk and
	// with which privileges.
	const extractions = result.script.split('\n').filter(line => /\btar\b/.test(line) && /-x/.test(line));
	assert.equal(extractions.length, 2, `expected two extractions, found ${extractions.length}`);
	for (const extraction of extractions) {
		assert.match(extraction, /--no-same-owner/);
		assert.match(extraction, /--no-same-permissions/);
	}
});
