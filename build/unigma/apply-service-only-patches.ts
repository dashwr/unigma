/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The service-only profile is a patchset applied to a pinned upstream checkout,
// never a fork. D-023 requires the cut to be reviewable and reapplicable, so the
// patches live in the unigma repository and the OpenCode checkout stays clean.
const DEFAULT_PATCHES = join(dirname(fileURLToPath(import.meta.url)), 'opencode-service-only');
const SHA1 = /^[a-f0-9]{40}$/;
const ALLOWED = new Set(['--checkout', '--expect-commit', '--patches']);

function fail(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

function parseOptions(argv: readonly string[]): Map<string, string> {
	const values = new Map<string, string>();
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (!argument.startsWith('--')) { fail(`unexpected argument: ${argument}`); }
		const separator = argument.indexOf('=');
		const name = separator === -1 ? argument : argument.slice(0, separator);
		if (!ALLOWED.has(name)) { fail(`unknown option: ${name}`); }
		if (values.has(name)) { fail(`repeated option: ${name}`); }
		const value = separator === -1 ? argv[++index] : argument.slice(separator + 1);
		if (!value || value.startsWith('--')) { fail(`missing value for ${name}`); }
		values.set(name, value);
	}
	return values;
}

function git(checkout: string, ...args: readonly string[]): string {
	const result = spawnSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });
	if (result.error) { fail(`could not run git: ${result.error.message}`); }
	if (result.status !== 0) { fail(`git ${args[0]} failed in ${checkout}: ${result.stderr.trim()}`); }
	return result.stdout.trim();
}

function patchesIn(directory: string): readonly string[] {
	if (!existsSync(directory) || !statSync(directory).isDirectory()) { fail(`patch directory not found: ${directory}`); }
	// Lexicographic order is the apply order, which is why the files are numbered.
	const patches = readdirSync(directory).filter(name => name.endsWith('.patch')).sort();
	if (patches.length === 0) { fail(`no patches in ${directory}`); }
	return patches.map(name => join(directory, name));
}

function main(): void {
	const options = parseOptions(process.argv.slice(2));
	const checkout = options.get('--checkout');
	const expected = options.get('--expect-commit');
	if (!checkout || !expected) {
		fail('usage: apply-service-only-patches.ts --checkout <dir> --expect-commit <sha1> [--patches <dir>]');
	}
	if (!SHA1.test(expected)) { fail('--expect-commit must be a 40-character SHA-1'); }

	const target = resolve(checkout);
	if (!existsSync(join(target, '.git'))) { fail(`not a git checkout: ${target}`); }

	// A patch produced against one commit and applied to another can succeed and
	// still mean something else, so the base is verified rather than assumed.
	const head = git(target, 'rev-parse', 'HEAD');
	if (head !== expected) { fail(`checkout is at ${head}, expected ${expected}`); }

	// Applying onto local edits would silently mix them into the profile.
	if (git(target, 'status', '--porcelain') !== '') { fail(`checkout has uncommitted changes: ${target}`); }

	const patches = patchesIn(resolve(options.get('--patches') ?? DEFAULT_PATCHES));
	// Every patch is checked before any is applied, so a broken set leaves the
	// checkout untouched instead of half-cut.
	for (const patch of patches) { git(target, 'apply', '--check', patch); }
	for (const patch of patches) { git(target, 'apply', patch); }

	process.stdout.write(`base=${head}\n`);
	process.stdout.write(`patches=${patches.length}\n`);
	for (const patch of patches) { process.stdout.write(`applied=${patch.slice(patch.lastIndexOf('/') + 1)}\n`); }
}

main();
