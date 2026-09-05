/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { test } from 'node:test';
import { fileURLToPath } from 'url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'swap-opencode-bundle.ts');
const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from('opencode')]);
const commit = 'a'.repeat(40);
const other = 'b'.repeat(40);

function run(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
	const result = spawnSync(process.execPath, ['--experimental-strip-types', script, ...args], { encoding: 'utf8' });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Writes a bundle the way the build lays one out inside resources/app. */
function writeBundle(path: string, at: string, binary: Buffer | string = elf): void {
	mkdirSync(join(path, 'bin'), { recursive: true });
	writeFileSync(join(path, 'bin', 'opencode'), binary, { mode: 0o755 });
	writeFileSync(join(path, 'LICENSE-opencode.txt'), 'MIT');
	writeFileSync(join(path, 'PROVENANCE.txt'), `artifact=opencode\ncommit=${at}\nversion=1.18.23\n`);
}

function withInstall(body: (paths: { install: string; app: string; bundle: string; candidate: string; root: string }) => void): void {
	const root = mkdtempSync(join(tmpdir(), 'unigma-swap-'));
	try {
		const install = join(root, 'VSCode-linux-x64');
		const app = join(install, 'resources', 'app');
		const bundle = join(app, 'opencode');
		mkdirSync(app, { recursive: true });
		writeBundle(bundle, commit);
		const candidate = join(root, 'candidate');
		writeBundle(candidate, other);
		body({ install, app, bundle, candidate, root });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test('replaces the bundle and keeps the previous one until it is discarded', () => {
	withInstall(({ install, app, bundle, candidate }) => {
		const swapped = run(['--install', install, '--candidate', candidate]);
		assert.equal(swapped.status, 0, swapped.stdout + swapped.stderr);
		assert.match(swapped.stdout, /^swap=pass$/m);

		assert.match(readFileSync(join(bundle, 'PROVENANCE.txt'), 'utf8'), new RegExp(`commit=${other}`));
		assert.match(readFileSync(join(app, 'opencode.previous', 'PROVENANCE.txt'), 'utf8'), new RegExp(`commit=${commit}`));
		assert.ok(!existsSync(join(app, 'opencode.incoming')), 'staging directory must not survive a completed swap');

		const state = run(['--install', install, '--action', 'status']);
		assert.match(state.stdout, /^bundle=present$/m);
		assert.match(state.stdout, /^previous=held$/m);
		assert.match(state.stdout, new RegExp(`^commit=${other}$`, 'm'));

		const discarded = run(['--install', install, '--action', 'discard']);
		assert.equal(discarded.status, 0);
		assert.ok(!existsSync(join(app, 'opencode.previous')));
	});
});

test('refuses an invalid candidate without touching the installed bundle', () => {
	withInstall(({ install, app, bundle, root }) => {
		const before = readFileSync(join(bundle, 'PROVENANCE.txt'), 'utf8');

		const wrapper = join(root, 'wrapper');
		writeBundle(wrapper, other, '#!/bin/sh\nexec opencode "$@"\n');
		const notElf = run(['--install', install, '--candidate', wrapper]);
		assert.equal(notElf.status, 1);
		assert.match(notElf.stdout, /^failure=candidate bin\/opencode is not an ELF executable$/m);
		assert.match(notElf.stdout, /^swap=fail$/m);

		const incomplete = join(root, 'incomplete');
		writeBundle(incomplete, other);
		rmSync(join(incomplete, 'LICENSE-opencode.txt'));
		const missing = run(['--install', install, '--candidate', incomplete]);
		assert.equal(missing.status, 1);
		assert.match(missing.stdout, /^failure=candidate is missing LICENSE-opencode\.txt$/m);

		const unprovenanced = join(root, 'unprovenanced');
		writeBundle(unprovenanced, other);
		writeFileSync(join(unprovenanced, 'PROVENANCE.txt'), 'artifact=opencode\n');
		const anonymous = run(['--install', install, '--candidate', unprovenanced]);
		assert.equal(anonymous.status, 1);
		assert.match(anonymous.stdout, /^failure=candidate PROVENANCE\.txt declares no commit$/m);

		assert.equal(readFileSync(join(bundle, 'PROVENANCE.txt'), 'utf8'), before);
		assert.ok(!existsSync(join(app, 'opencode.previous')), 'a refused candidate must not move the current bundle');
		assert.ok(!existsSync(join(app, 'opencode.incoming')));
	});
});

test('restores the previous bundle on rollback', () => {
	withInstall(({ install, app, bundle, candidate }) => {
		assert.equal(run(['--install', install, '--candidate', candidate]).status, 0);
		assert.match(readFileSync(join(bundle, 'PROVENANCE.txt'), 'utf8'), new RegExp(`commit=${other}`));

		const rolled = run(['--install', install, '--action', 'rollback']);
		assert.equal(rolled.status, 0, rolled.stdout + rolled.stderr);
		assert.match(rolled.stdout, /^rollback=pass$/m);
		assert.match(readFileSync(join(bundle, 'PROVENANCE.txt'), 'utf8'), new RegExp(`commit=${commit}`));
		assert.ok(!existsSync(join(app, 'opencode.previous')));

		const again = run(['--install', install, '--action', 'rollback']);
		assert.equal(again.status, 1);
		assert.match(again.stdout, /^failure=no previous bundle to restore$/m);
	});
});

test('refuses to swap while a previous bundle is still held', () => {
	withInstall(({ install, candidate }) => {
		assert.equal(run(['--install', install, '--candidate', candidate]).status, 0);
		const second = run(['--install', install, '--candidate', candidate]);
		assert.equal(second.status, 1);
		assert.match(second.stdout, /^failure=a previous bundle is still held at opencode\.previous$/m);
	});
});

test('clears an interrupted staging directory instead of swapping it in', () => {
	withInstall(({ install, app, bundle, candidate }) => {
		// An earlier run that died between staging and the rename leaves this
		// behind. Its contents are unknown, so it is discarded, never promoted.
		const stale = join(app, 'opencode.incoming');
		writeBundle(stale, 'c'.repeat(40), Buffer.from('truncated'));

		const state = run(['--install', install, '--action', 'status']);
		assert.match(state.stdout, /^incoming=interrupted$/m);

		const swapped = run(['--install', install, '--candidate', candidate]);
		assert.equal(swapped.status, 0, swapped.stdout + swapped.stderr);
		assert.match(readFileSync(join(bundle, 'PROVENANCE.txt'), 'utf8'), new RegExp(`commit=${other}`));
		assert.ok(!existsSync(stale));
	});
});

test('leaves everything outside the bundle directory alone', () => {
	withInstall(({ install, app, candidate, root }) => {
		// Configuration, credentials, sessions and history live outside the
		// package. A swap that reached them would be a migration nobody asked
		// for, so the test plants files on both sides of the boundary.
		const data = join(root, 'user-data');
		mkdirSync(data, { recursive: true });
		writeFileSync(join(data, 'sessions.json'), 'sessions');
		const sibling = join(app, 'product.json');
		writeFileSync(sibling, '{"nameShort":"unigma"}');

		assert.equal(run(['--install', install, '--candidate', candidate]).status, 0);
		assert.equal(run(['--install', install, '--action', 'rollback']).status, 0);

		assert.equal(readFileSync(join(data, 'sessions.json'), 'utf8'), 'sessions');
		assert.equal(readFileSync(sibling, 'utf8'), '{"nameShort":"unigma"}');
	});
});

test('refuses malformed arguments and a directory that is not an installation', () => {
	withInstall(({ install, candidate, root }) => {
		assert.match(run([]).stderr, /^usage: /m);
		assert.match(run(['--install', install, '--action', 'sideload']).stderr, /^unknown action: sideload$/m);
		assert.match(run(['--install', install, '--candidate']).stderr, /^missing value for --candidate$/m);
		assert.match(run(['--install', install, '--force']).stderr, /^unexpected argument: --force$/m);
		assert.match(run(['--install', install]).stderr, /^swap requires --candidate$/m);
		assert.match(run(['--install', join(root, 'nowhere'), '--candidate', candidate]).stderr, /^not an installed unigma package: /m);
	});
});
