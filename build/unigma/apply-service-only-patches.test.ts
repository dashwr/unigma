/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'apply-service-only-patches.ts');

function run(...args: readonly string[]) {
	return spawnSync(process.execPath, ['--experimental-strip-types', script, ...args], { encoding: 'utf8' });
}

function git(cwd: string, ...args: readonly string[]) {
	const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
	assert.strictEqual(result.status, 0, `git ${args[0]} failed: ${result.stderr}`);
	return result.stdout.trim();
}

/**
 * A checkout with one committed file, plus a patch directory holding a patch
 * that edits it. This mirrors the real shape — pinned upstream, patches kept
 * outside it — without depending on an OpenCode tree being present.
 */
function withCheckout(body: (checkout: string, patches: string, head: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), 'unigma-service-only-'));
	try {
		const checkout = join(root, 'checkout');
		const patches = join(root, 'patches');
		mkdirSync(checkout);
		mkdirSync(patches);
		git(checkout, 'init', '--quiet');
		git(checkout, 'config', 'user.email', 'test@example.com');
		git(checkout, 'config', 'user.name', 'test');
		writeFileSync(join(checkout, 'serve.ts'), 'export const ui = true\n');
		git(checkout, 'add', 'serve.ts');
		git(checkout, 'commit', '--quiet', '-m', 'base');
		writeFileSync(join(patches, '0001-cut.patch'), [
			'diff --git a/serve.ts b/serve.ts',
			'--- a/serve.ts',
			'+++ b/serve.ts',
			'@@ -1 +1 @@',
			'-export const ui = true',
			'+export const ui = false',
			''
		].join('\n'));
		body(checkout, patches, git(checkout, 'rev-parse', 'HEAD'));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test('applies the patchset onto the pinned base', () => {
	withCheckout((checkout, patches, head) => {
		const result = run('--checkout', checkout, '--expect-commit', head, '--patches', patches);
		assert.strictEqual(result.status, 0, result.stderr);
		assert.match(result.stdout, /^base=/m);
		assert.match(result.stdout, /^patches=1$/m);
		assert.match(result.stdout, /^applied=0001-cut\.patch$/m);
		assert.strictEqual(readFileSync(join(checkout, 'serve.ts'), 'utf8'), 'export const ui = false\n');
	});
});

test('refuses a checkout that is not on the pinned commit', () => {
	withCheckout((checkout, patches) => {
		const other = 'a'.repeat(40);
		const result = run('--checkout', checkout, '--expect-commit', other, '--patches', patches);
		assert.strictEqual(result.status, 1);
		assert.match(result.stderr, /expected a{40}/);
		// The cut must not have happened.
		assert.strictEqual(readFileSync(join(checkout, 'serve.ts'), 'utf8'), 'export const ui = true\n');
	});
});

test('refuses a checkout carrying uncommitted work', () => {
	withCheckout((checkout, patches, head) => {
		writeFileSync(join(checkout, 'serve.ts'), 'export const ui = true // local\n');
		const result = run('--checkout', checkout, '--expect-commit', head, '--patches', patches);
		assert.strictEqual(result.status, 1);
		assert.match(result.stderr, /uncommitted changes/);
	});
});

test('leaves the checkout untouched when any patch in the set does not apply', () => {
	withCheckout((checkout, patches, head) => {
		// Sorts after the good one, so a naive apply-as-you-go would already have
		// written the first cut before reaching it.
		writeFileSync(join(patches, '0002-broken.patch'), [
			'diff --git a/missing.ts b/missing.ts',
			'--- a/missing.ts',
			'+++ b/missing.ts',
			'@@ -1 +1 @@',
			'-gone',
			'+changed',
			''
		].join('\n'));
		const result = run('--checkout', checkout, '--expect-commit', head, '--patches', patches);
		assert.strictEqual(result.status, 1);
		assert.strictEqual(readFileSync(join(checkout, 'serve.ts'), 'utf8'), 'export const ui = true\n');
		assert.strictEqual(git(checkout, 'status', '--porcelain'), '');
	});
});

test('refuses an empty or missing patch directory', () => {
	withCheckout((checkout, _patches, head) => {
		const empty = mkdtempSync(join(tmpdir(), 'unigma-empty-'));
		try {
			assert.match(run('--checkout', checkout, '--expect-commit', head, '--patches', empty).stderr, /no patches in/);
			assert.match(run('--checkout', checkout, '--expect-commit', head, '--patches', join(empty, 'nope')).stderr, /patch directory not found/);
		} finally {
			rmSync(empty, { recursive: true, force: true });
		}
	});
});

test('refuses malformed arguments instead of guessing', () => {
	assert.match(run().stderr, /usage:/);
	assert.match(run('--checkout').stderr, /missing value for --checkout/);
	assert.match(run('--checkout', 'x', '--expect-commit', 'short').stderr, /40-character SHA-1/);
	assert.match(run('--unknown', 'x').stderr, /unknown option: --unknown/);
	assert.match(run('positional').stderr, /unexpected argument: positional/);
	assert.match(run('--checkout=a', '--checkout=b').stderr, /repeated option: --checkout/);
});

test('refuses a directory that is not a git checkout', () => {
	const plain = mkdtempSync(join(tmpdir(), 'unigma-plain-'));
	try {
		assert.match(run('--checkout', plain, '--expect-commit', 'b'.repeat(40)).stderr, /not a git checkout/);
	} finally {
		rmSync(plain, { recursive: true, force: true });
	}
});
