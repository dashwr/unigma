/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const verifier = resolve(import.meta.dirname, 'verify-payload.ts');
const maker = resolve(import.meta.dirname, 'make-payload.ts');
const commit = '0123456789abcdef0123456789abcdef01234567';

/** An ELF header is what the remote host will try to execute; a payload that ships anything else is broken. */
const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from('opencode')]);

function runScript(script: string, arguments_: readonly string[]) {
	return spawnSync(process.execPath, ['--experimental-strip-types', script, ...arguments_], { encoding: 'utf8' });
}

/**
 * Builds a real payload with the real maker, so the verifier is tested against
 * the artifact the pipeline actually produces rather than a hand-written copy
 * that could drift from it.
 */
function withPayload(body: (payload: string, root: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), 'unigma-verify-'));
	try {
		const server = join(root, 'unigma-server.tar.gz');
		const opencode = join(root, 'opencode');
		const payload = join(root, 'payload');
		writeFileSync(server, 'server archive');
		writeFileSync(opencode, elf);
		const made = runScript(maker, ['--server', server, '--opencode', opencode, '--output', payload, '--client-commit', commit, '--server-commit', commit, '--target', 'linux-x64']);
		assert.equal(made.status, 0, made.stderr);
		body(payload, root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

function rewriteManifest(payload: string, edit: (manifest: Record<string, unknown>) => void): void {
	const path = join(payload, 'manifest.json');
	const manifest = JSON.parse(readFileSync(path, 'utf8'));
	edit(manifest);
	writeFileSync(path, JSON.stringify(manifest, undefined, 2) + '\n');
}

test('accepts the payload the maker produces', () => {
	withPayload(payload => {
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /^payload=pass$/m);
		assert.match(result.stdout, /^client-commit=0123456789abcdef0123456789abcdef01234567$/m);
		assert.match(result.stdout, /^target=linux-x64$/m);
		assert.match(result.stdout, /^undeclared=0$/m);
		assert.doesNotMatch(result.stdout, /^failure=/m);
	});
});

test('rejects content that appeared after the manifest was written', () => {
	withPayload(payload => {
		mkdirSync(join(payload, 'extra'));
		writeFileSync(join(payload, 'extra', 'tool.sh'), '#!/bin/sh\n');
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /^failure=undeclared file in payload: extra\/tool\.sh$/m);
		assert.match(result.stdout, /^payload=fail$/m);
	});
});

test('rejects a file whose bytes no longer match its digest', () => {
	withPayload(payload => {
		// Same length, different content: a size-only check would pass this.
		writeFileSync(join(payload, 'server', 'unigma-server.tar.gz'), 'SERVER ARCHIVE');
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /^failure=digest mismatch for server\/unigma-server\.tar\.gz$/m);
		assert.doesNotMatch(result.stdout, /^failure=size mismatch/m);
	});
});

test('rejects a file that grew after being declared', () => {
	withPayload(payload => {
		appendFileSync(join(payload, 'bin', 'opencode'), 'appended');
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /^failure=size mismatch for bin\/opencode/m);
		assert.match(result.stdout, /^failure=total size mismatch/m);
	});
});

test('rejects a manifest that claims a digest it did not compute', () => {
	withPayload(payload => {
		rewriteManifest(payload, manifest => {
			const files = manifest.files as { relativePath: string; sha256: string }[];
			files[0].sha256 = 'f'.repeat(64);
		});
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /^failure=digest mismatch for server\/unigma-server\.tar\.gz$/m);
	});
});

test('refuses a manifest path that points outside the payload', () => {
	withPayload(payload => {
		rewriteManifest(payload, manifest => {
			const files = manifest.files as { relativePath: string }[];
			files[0].relativePath = '../outside';
		});
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /manifest path escapes the payload/);
	});
});

test('refuses a payload whose halves came from different commits', () => {
	withPayload(payload => {
		rewriteManifest(payload, manifest => {
			manifest.serverCommit = 'fedcba9876543210fedcba9876543210fedcba98';
		});
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /^failure=client and server commits differ$/m);
	});
});

test('refuses an opencode that is not an executable', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-verify-'));
	try {
		const server = join(root, 'unigma-server.tar.gz');
		const opencode = join(root, 'opencode');
		const payload = join(root, 'payload');
		writeFileSync(server, 'server archive');
		// A shell wrapper reads as a plausible binary to anything that only checks the name.
		writeFileSync(opencode, '#!/bin/sh\nexec opencode "$@"\n');
		const made = runScript(maker, ['--server', server, '--opencode', opencode, '--output', payload, '--client-commit', commit, '--server-commit', commit, '--target', 'linux-x64']);
		assert.equal(made.status, 0, made.stderr);
		const result = runScript(verifier, [payload]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /^failure=bin\/opencode is not an ELF executable$/m);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('refuses arguments and directories it cannot read as a payload', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-verify-'));
	try {
		assert.equal(runScript(verifier, []).status, 1);
		assert.match(runScript(verifier, []).stderr, /usage: verify-payload/);
		assert.equal(runScript(verifier, [root, root]).status, 1);
		assert.match(runScript(verifier, [join(root, 'missing')]).stderr, /payload directory not found/);
		assert.match(runScript(verifier, [root]).stderr, /payload has no manifest\.json/);
		writeFileSync(join(root, 'manifest.json'), 'not json');
		assert.match(runScript(verifier, [root]).stderr, /manifest\.json is not valid JSON/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
