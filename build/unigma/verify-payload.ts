/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, openSync, readFileSync, readSync, closeSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Verifies an assembled unigma+opencode payload against its own manifest.
 *
 * The distribution auditor reads the desktop package and the server package,
 * each before it is combined. Nothing read the payload after assembly, so a
 * file that appeared between the two steps was never seen by anything.
 *
 * This reads the payload as a recipient would: the manifest is the claim, the
 * directory is the artifact, and a mismatch in either direction is a failure.
 * An undeclared file is a failure too, because a payload is only trustworthy
 * if what it contains is exactly what it says it contains.
 */

const sha1 = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;

/** Files that may sit in the payload root without being listed in the manifest. */
const UNDECLARED_ALLOWED = new Set(['manifest.json', 'LICENSE-opencode.txt']);

/** ELF magic. The OpenCode binary is executed on the remote host; a script or archive in its place is a defect. */
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

interface ManifestFile {
	readonly id: string;
	readonly relativePath: string;
	readonly sizeBytes: number;
	readonly sha256: string;
}

interface Manifest {
	readonly schemaVersion: number;
	readonly product: string;
	readonly clientCommit: string;
	readonly serverCommit: string;
	readonly target: { readonly os: string; readonly arch: string };
	readonly totalSizeBytes: number;
	readonly files: readonly ManifestFile[];
}

const failures: string[] = [];
function check(condition: boolean, message: string): boolean {
	if (!condition) { failures.push(message); }
	return condition;
}

function digest(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Lists every file under the payload, relative to its root, so undeclared content anywhere is visible. */
function filesUnder(root: string, prefix = ''): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			found.push(...filesUnder(root, relativePath));
		} else {
			found.push(relativePath);
		}
	}
	return found;
}

function startsWithMagic(path: string, magic: Buffer): boolean {
	const handle = openSync(path, 'r');
	try {
		const head = Buffer.alloc(magic.length);
		return readSync(handle, head, 0, magic.length, 0) === magic.length && head.equals(magic);
	} finally {
		closeSync(handle);
	}
}

function parseManifest(raw: string): Manifest | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		failures.push('manifest.json is not valid JSON');
		return undefined;
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		failures.push('manifest.json is not an object');
		return undefined;
	}
	const manifest = parsed as Manifest;
	if (!Array.isArray(manifest.files)) {
		failures.push('manifest declares no file list');
		return undefined;
	}
	for (const file of manifest.files) {
		if (typeof file?.relativePath !== 'string' || typeof file.sizeBytes !== 'number' || typeof file.sha256 !== 'string') {
			failures.push('manifest file entry is malformed');
			return undefined;
		}
		// A path that escapes the payload would make every later check read something outside it.
		if (file.relativePath.startsWith('/') || file.relativePath.split('/').includes('..')) {
			failures.push(`manifest path escapes the payload: ${file.relativePath}`);
			return undefined;
		}
	}
	return manifest;
}

function main(): void {
	const argv = process.argv.slice(2);
	if (argv.length !== 1 || argv[0].startsWith('-')) {
		console.error('usage: verify-payload.ts <payload-directory>');
		process.exitCode = 1;
		return;
	}
	const root = resolve(argv[0]);
	if (!existsSync(root) || !statSync(root).isDirectory()) {
		console.error(`payload directory not found: ${root}`);
		process.exitCode = 1;
		return;
	}
	const manifestPath = join(root, 'manifest.json');
	if (!existsSync(manifestPath)) {
		console.error('payload has no manifest.json');
		process.exitCode = 1;
		return;
	}
	const manifest = parseManifest(readFileSync(manifestPath, 'utf8'));
	if (!manifest) {
		for (const failure of failures) { console.error(failure); }
		process.exitCode = 1;
		return;
	}

	const lines: string[] = [];
	lines.push(`payload=${root}`);
	lines.push(`schema-version=${manifest.schemaVersion}`);
	lines.push(`product=${manifest.product}`);
	lines.push(`client-commit=${manifest.clientCommit}`);
	lines.push(`server-commit=${manifest.serverCommit}`);
	lines.push(`target=${manifest.target?.os}-${manifest.target?.arch}`);

	check(manifest.schemaVersion === 1, `unsupported schema version: ${manifest.schemaVersion}`);
	check(manifest.product === 'unigma', `unexpected product: ${manifest.product}`);
	check(sha1.test(manifest.clientCommit ?? ''), 'client commit is not a 40-character SHA-1');
	check(manifest.clientCommit === manifest.serverCommit, 'client and server commits differ');
	check(manifest.target?.os === 'linux' && manifest.target?.arch === 'x64', 'target is not linux-x64');

	let measuredTotal = 0;
	for (const file of manifest.files) {
		const path = join(root, file.relativePath);
		if (!check(existsSync(path), `declared file is missing: ${file.relativePath}`)) { continue; }
		if (!check(!lstatSync(path).isSymbolicLink(), `declared file is a symlink: ${file.relativePath}`)) { continue; }
		const size = statSync(path).size;
		measuredTotal += size;
		check(size === file.sizeBytes, `size mismatch for ${file.relativePath}: manifest ${file.sizeBytes}, actual ${size}`);
		check(sha256.test(file.sha256), `declared digest is not a SHA-256: ${file.relativePath}`);
		check(digest(path) === file.sha256, `digest mismatch for ${file.relativePath}`);
		lines.push(`file.${file.id}=${file.relativePath} ${size}`);
	}
	check(measuredTotal === manifest.totalSizeBytes, `total size mismatch: manifest ${manifest.totalSizeBytes}, actual ${measuredTotal}`);

	const declared = new Set(manifest.files.map(file => file.relativePath));
	const undeclared = filesUnder(root).filter(path => !declared.has(path) && !UNDECLARED_ALLOWED.has(path));
	check(undeclared.length === 0, `undeclared file in payload: ${undeclared.join(', ')}`);
	lines.push(`undeclared=${undeclared.length}`);

	const opencode = manifest.files.find(file => file.relativePath === 'bin/opencode');
	if (check(opencode !== undefined, 'payload declares no bin/opencode')) {
		const path = join(root, 'bin/opencode');
		if (existsSync(path)) {
			check(startsWithMagic(path, ELF_MAGIC), 'bin/opencode is not an ELF executable');
		}
	}
	const server = manifest.files.find(file => file.relativePath === 'server/unigma-server.tar.gz');
	check(server !== undefined, 'payload declares no server/unigma-server.tar.gz');

	for (const failure of failures) { lines.push(`failure=${failure}`); }
	lines.push(`payload=${failures.length === 0 ? 'pass' : 'fail'}`);
	console.log(lines.join('\n'));
	if (failures.length > 0) { process.exitCode = 1; }
}

main();
