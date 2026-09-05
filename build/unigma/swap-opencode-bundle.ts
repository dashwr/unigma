/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFileSync } from 'child_process';
import { closeSync, existsSync, lstatSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, renameSync, rmSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Replaces the OpenCode bundle inside an installed unigma package.
 *
 * The bundle lives at resources/app/opencode and is produced by the build, so
 * swapping it is the only supported way to move an installation from one
 * OpenCode to another without reinstalling the product. The candidate is
 * validated before the current bundle is touched, the exchange itself is two
 * renames inside one directory, and the previous bundle stays on disk until it
 * is explicitly discarded.
 *
 * This never migrates user data. Configuration, credentials, sessions and
 * history live under the user's data directories, outside the package, and a
 * swap that reached them would be an upgrade path nobody asked for.
 */

const BUNDLE = 'opencode';
const INCOMING = 'opencode.incoming';
const PREVIOUS = 'opencode.previous';
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
const ALLOWED = new Set(['--install', '--candidate', '--action']);
const ACTIONS = new Set(['swap', 'rollback', 'discard', 'status']);

/** Files a bundle must carry. A candidate missing any of them is not a bundle. */
const REQUIRED = ['bin/opencode', 'LICENSE-opencode.txt', 'PROVENANCE.txt'];

function fail(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

function parseOptions(argv: readonly string[]): Map<string, string> {
	const values = new Map<string, string>();
	for (let index = 0; index < argv.length; index += 1) {
		const entry = argv[index];
		const split = entry.indexOf('=');
		const key = split === -1 ? entry : entry.slice(0, split);
		if (!ALLOWED.has(key)) {
			fail(`unexpected argument: ${entry}`);
		}
		if (split !== -1) {
			values.set(key, entry.slice(split + 1));
			continue;
		}
		const value = argv[index + 1];
		if (value === undefined || value.startsWith('--')) {
			fail(`missing value for ${key}`);
		}
		values.set(key, value);
		index += 1;
	}
	return values;
}

function startsWithMagic(path: string): boolean {
	const handle = openSync(path, 'r');
	try {
		const head = Buffer.alloc(ELF_MAGIC.length);
		const bytes = readSync(handle, head, 0, head.length, 0);
		return bytes === head.length && head.equals(ELF_MAGIC);
	} finally {
		closeSync(handle);
	}
}

/**
 * Refuses a candidate before anything is moved.
 *
 * A validated candidate is the whole guarantee here: once the exchange starts,
 * the only recovery is the previous bundle, and restoring it is a worse outcome
 * than never having started.
 */
function validateCandidate(candidate: string): readonly string[] {
	const failures: string[] = [];
	if (!existsSync(candidate) || !lstatSync(candidate).isDirectory()) {
		return [`candidate is not a directory: ${candidate}`];
	}
	for (const relative of REQUIRED) {
		const path = join(candidate, relative);
		if (!existsSync(path)) {
			failures.push(`candidate is missing ${relative}`);
			continue;
		}
		const stat = lstatSync(path);
		if (stat.isSymbolicLink()) {
			failures.push(`candidate ${relative} is a symbolic link`);
			continue;
		}
		if (!stat.isFile()) {
			failures.push(`candidate ${relative} is not a regular file`);
		}
	}
	const binary = join(candidate, 'bin/opencode');
	if (existsSync(binary) && lstatSync(binary).isFile()) {
		if (!startsWithMagic(binary)) {
			failures.push('candidate bin/opencode is not an ELF executable');
		}
		if ((lstatSync(binary).mode & 0o111) === 0) {
			failures.push('candidate bin/opencode is not executable');
		}
	}
	const provenance = join(candidate, 'PROVENANCE.txt');
	if (existsSync(provenance) && lstatSync(provenance).isFile()) {
		const text = readFileSync(provenance, 'utf8');
		if (!/^commit=[0-9a-f]{40}$/m.test(text)) {
			failures.push('candidate PROVENANCE.txt declares no commit');
		}
	}
	return failures;
}

/**
 * Reports processes running the bundle's own binary.
 *
 * Replacing a running executable leaves the live process reading pages from a
 * file that no longer exists at that path, which fails later and somewhere
 * else. /proc is read directly because fuser and lsof are optional packages,
 * and a check that is skipped when a package is missing is not a check.
 */
function runningFromBundle(binary: string): readonly number[] {
	const running: number[] = [];
	if (!existsSync('/proc')) {
		return running;
	}
	for (const entry of readdirSync('/proc')) {
		if (!/^\d+$/.test(entry)) {
			continue;
		}
		try {
			if (readlinkSync(join('/proc', entry, 'exe')) === binary) {
				running.push(Number(entry));
			}
		} catch {
			// A process that exited between listing and reading is not running.
		}
	}
	return running;
}

function bundleRoot(install: string): string {
	return join(install, 'resources', 'app');
}

function report(lines: readonly string[]): void {
	process.stdout.write(`${lines.join('\n')}\n`);
}

function swap(root: string, candidate: string): void {
	const current = join(root, BUNDLE);
	const incoming = join(root, INCOMING);
	const previous = join(root, PREVIOUS);

	const failures = validateCandidate(candidate);
	if (failures.length > 0) {
		report([...failures.map(failure => `failure=${failure}`), 'swap=fail']);
		process.exit(1);
	}
	if (existsSync(previous)) {
		report([`failure=a previous bundle is still held at ${PREVIOUS}`, 'swap=fail']);
		process.exit(1);
	}
	const active = existsSync(current) ? runningFromBundle(join(current, 'bin', 'opencode')) : [];
	if (active.length > 0) {
		report([`failure=the bundled opencode is running (pid ${active.join(' ')})`, 'swap=fail']);
		process.exit(1);
	}

	// Stage beside the target so both renames stay inside one directory, which
	// is what makes them atomic. Copying across a filesystem boundary first
	// would put a partial bundle where the product looks for a whole one.
	rmSync(incoming, { recursive: true, force: true });
	const staged = mkdtempSync(join(root, '.opencode-staging-'));
	try {
		execFileSync('cp', ['-a', `${candidate}/.`, staged], { stdio: 'ignore' });
		renameSync(staged, incoming);
	} catch (error) {
		rmSync(staged, { recursive: true, force: true });
		throw error;
	}

	if (existsSync(current)) {
		renameSync(current, previous);
	}
	renameSync(incoming, current);
	report(['swap=pass', `bundle=${current}`, `previous=${existsSync(previous) ? previous : 'none'}`]);
}

function rollback(root: string): void {
	const current = join(root, BUNDLE);
	const previous = join(root, PREVIOUS);
	const incoming = join(root, INCOMING);
	if (!existsSync(previous)) {
		report(['failure=no previous bundle to restore', 'rollback=fail']);
		process.exit(1);
	}
	const active = existsSync(current) ? runningFromBundle(join(current, 'bin', 'opencode')) : [];
	if (active.length > 0) {
		report([`failure=the bundled opencode is running (pid ${active.join(' ')})`, 'rollback=fail']);
		process.exit(1);
	}
	// The failed candidate is discarded rather than kept: it has already been
	// rejected, and keeping it would make the next swap refuse on a stale hold.
	rmSync(incoming, { recursive: true, force: true });
	rmSync(current, { recursive: true, force: true });
	renameSync(previous, current);
	report(['rollback=pass', `bundle=${current}`]);
}

function discard(root: string): void {
	const previous = join(root, PREVIOUS);
	if (!existsSync(previous)) {
		report(['discard=pass', 'previous=none']);
		return;
	}
	rmSync(previous, { recursive: true, force: true });
	report(['discard=pass', `previous=removed`]);
}

function status(root: string): void {
	const current = join(root, BUNDLE);
	const lines = [
		`bundle=${existsSync(current) ? 'present' : 'absent'}`,
		`previous=${existsSync(join(root, PREVIOUS)) ? 'held' : 'none'}`,
		`incoming=${existsSync(join(root, INCOMING)) ? 'interrupted' : 'none'}`
	];
	if (existsSync(join(current, 'PROVENANCE.txt'))) {
		const commit = /^commit=([0-9a-f]{40})$/m.exec(readFileSync(join(current, 'PROVENANCE.txt'), 'utf8'));
		lines.push(`commit=${commit ? commit[1] : 'unknown'}`);
	}
	report(lines);
}

function main(): void {
	const values = parseOptions(process.argv.slice(2));
	const install = values.get('--install');
	if (install === undefined) {
		fail('usage: swap-opencode-bundle.ts --install <package> [--candidate <bundle>] [--action swap|rollback|discard|status]');
	}
	const action = values.get('--action') ?? 'swap';
	if (!ACTIONS.has(action)) {
		fail(`unknown action: ${action}`);
	}
	const root = bundleRoot(resolve(install));
	if (!existsSync(root)) {
		fail(`not an installed unigma package: ${resolve(install)}`);
	}

	if (action === 'status') {
		status(root);
		return;
	}
	if (action === 'rollback') {
		rollback(root);
		return;
	}
	if (action === 'discard') {
		discard(root);
		return;
	}
	const candidate = values.get('--candidate');
	if (candidate === undefined) {
		fail('swap requires --candidate');
	}
	swap(root, resolve(candidate));
}

main();
