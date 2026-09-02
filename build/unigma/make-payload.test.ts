/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve(import.meta.dirname, 'make-payload.ts');
const commit = '0123456789abcdef0123456789abcdef01234567';

function run(arguments_: readonly string[]) {
	return spawnSync(process.execPath, ['--experimental-strip-types', script, ...arguments_], { encoding: 'utf8' });
}

test('creates a deterministic Linux payload manifest from explicit inputs', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-payload-'));
	try {
		const server = join(root, 'unigma-server.tar.gz');
		const opencode = join(root, 'opencode');
		const license = join(root, 'LICENSE');
		const output = join(root, 'payload');
		writeFileSync(server, 'server archive');
		writeFileSync(opencode, 'opencode');
		writeFileSync(license, 'MIT');

		const result = run(['--server', server, '--opencode', opencode, '--output', output, '--client-commit', commit, '--server-commit', commit, '--target', 'linux-x64', '--opencode-license', license]);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(readFileSync(join(output, 'server', 'unigma-server.tar.gz'), 'utf8'), 'server archive');
		assert.equal(readFileSync(join(output, 'bin', 'opencode'), 'utf8'), 'opencode');
		assert.equal(readFileSync(join(output, 'LICENSE-opencode.txt'), 'utf8'), 'MIT');
		const manifest = JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8'));
		assert.deepEqual({ ...manifest, files: manifest.files.map((file: { sha256: string }) => ({ ...file, sha256: '<sha256>' })) }, {
			schemaVersion: 1,
			product: 'unigma',
			clientCommit: commit,
			serverCommit: commit,
			target: { os: 'linux', arch: 'x64' },
			totalSizeBytes: 22,
			files: [
				{ id: 'unigma-server', relativePath: 'server/unigma-server.tar.gz', sizeBytes: 14, sha256: '<sha256>' },
				{ id: 'unigma+opencode', relativePath: 'bin/opencode', sizeBytes: 8, sha256: '<sha256>' },
			],
		});
		assert.match(manifest.files[0].sha256, /^[a-f0-9]{64}$/);
		assert.match(manifest.files[1].sha256, /^[a-f0-9]{64}$/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('fails closed for mismatched commits and a non-empty output', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-payload-'));
	try {
		const server = join(root, 'unigma-server.tar.gz');
		const nonArchiveServer = join(root, 'unigma-server');
		const opencode = join(root, 'opencode');
		const output = join(root, 'payload');
		writeFileSync(server, 'server archive');
		writeFileSync(nonArchiveServer, 'server wrapper');
		writeFileSync(opencode, 'opencode');
		const nonArchive = run(['--server', nonArchiveServer, '--opencode', opencode, '--output', output, '--client-commit', commit, '--server-commit', commit, '--target', 'linux-x64']);
		assert.equal(nonArchive.status, 1);
		assert.match(nonArchive.stderr, /server must be a .tar.gz archive/);
		mkdirSync(output);
		writeFileSync(join(output, 'existing'), 'no overwrite');

		const mismatched = run(['--server', server, '--opencode', opencode, '--output', output, '--client-commit', commit, '--server-commit', 'fedcba9876543210fedcba9876543210fedcba98', '--target', 'linux-x64']);
		assert.equal(mismatched.status, 1);
		assert.match(mismatched.stderr, /commits must be equal/);
		const nonEmpty = run(['--server', server, '--opencode', opencode, '--output', output, '--client-commit', commit, '--server-commit', commit, '--target', 'linux-x64']);
		assert.equal(nonEmpty.status, 1);
		assert.match(nonEmpty.stderr, /output must be new or empty/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
