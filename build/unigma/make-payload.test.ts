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
		const server = join(root, 'unigma-server');
		const opencode = join(root, 'opencode');
		const license = join(root, 'LICENSE');
		const output = join(root, 'payload');
		writeFileSync(server, 'server');
		writeFileSync(opencode, 'opencode');
		writeFileSync(license, 'MIT');

		const result = run(['--server', server, '--opencode', opencode, '--output', output, '--client-commit', commit, '--server-commit', commit, '--target', 'linux-x64', '--opencode-license', license]);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(readFileSync(join(output, 'bin', 'unigma-server'), 'utf8'), 'server');
		assert.equal(readFileSync(join(output, 'bin', 'opencode'), 'utf8'), 'opencode');
		assert.equal(readFileSync(join(output, 'LICENSE-opencode.txt'), 'utf8'), 'MIT');
		assert.deepEqual(JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8')), {
			schemaVersion: 1,
			product: 'unigma',
			clientCommit: commit,
			serverCommit: commit,
			target: { os: 'linux', arch: 'x64' },
			totalSizeBytes: 14,
			files: [
				{ id: 'unigma-server', relativePath: 'bin/unigma-server', sizeBytes: 6, sha256: 'b3eacd33433b31b5252351032c9b3e7a2e7aa7738d5decdf0dd6c62680853c06' },
				{ id: 'unigma+opencode', relativePath: 'bin/opencode', sizeBytes: 8, sha256: '62f8e1ec095e1857446d403d1431007de8813aea9553a56ccd4552a131b1f297' },
			],
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('fails closed for mismatched commits and a non-empty output', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-payload-'));
	try {
		const server = join(root, 'unigma-server');
		const opencode = join(root, 'opencode');
		const output = join(root, 'payload');
		writeFileSync(server, 'server');
		writeFileSync(opencode, 'opencode');
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
