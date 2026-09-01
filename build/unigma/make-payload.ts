/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const sha1 = /^[a-f0-9]{40}$/i;
const argumentsAllowed = new Set(['--server', '--opencode', '--output', '--client-commit', '--server-commit', '--target', '--opencode-license']);

function argumentsByName(): ReadonlyMap<string, string> {
	const values = new Map<string, string>();
	for (let index = 2; index < process.argv.length; index += 2) {
		const name = process.argv[index];
		const value = process.argv[index + 1];
		if (!name || !argumentsAllowed.has(name) || !value || value.startsWith('-') || values.has(name)) {
			throw new Error('invalid payload arguments');
		}
		values.set(name, value);
	}
	return values;
}
function argument(values: ReadonlyMap<string, string>, name: string): string {
	const value = values.get(name);
	if (!value) { throw new Error(`missing ${name}`); }
	return value;
}
function regularFile(path: string): void {
	if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !statSync(path).isFile()) { throw new Error(`not a regular file: ${path}`); }
}
function digest(path: string): string { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function main(): void {
	const values = argumentsByName();
	const server = resolve(argument(values, '--server'));
	const opencode = resolve(argument(values, '--opencode'));
	const output = resolve(argument(values, '--output'));
	const clientCommit = argument(values, '--client-commit');
	const serverCommit = argument(values, '--server-commit');
	if (clientCommit !== serverCommit || !sha1.test(clientCommit) || !sha1.test(serverCommit)) { throw new Error('commits must be equal 40-character SHA-1 values'); }
	if (argument(values, '--target') !== 'linux-x64') { throw new Error('target must be linux-x64'); }
	regularFile(server); regularFile(opencode);
	if (server === opencode || server === output || opencode === output) { throw new Error('payload sources and output must be distinct'); }
	if (existsSync(output) && (lstatSync(output).isSymbolicLink() || !lstatSync(output).isDirectory() || readdirSync(output).length > 0)) { throw new Error('output must be new or empty'); }
	const bin = join(output, 'bin'); mkdirSync(bin, { recursive: true });
	const files = [{ id: 'unigma-server', source: server, relativePath: 'bin/unigma-server' }, { id: 'unigma+opencode', source: opencode, relativePath: 'bin/opencode' }];
	for (const item of files) { cpSync(item.source, join(output, item.relativePath)); }
	const manifestFiles = files.map(item => { const path = join(output, item.relativePath); return { id: item.id, relativePath: item.relativePath, sizeBytes: statSync(path).size, sha256: digest(path) }; });
	const license = values.get('--opencode-license');
	if (license) { const source = resolve(license); regularFile(source); cpSync(source, join(output, 'LICENSE-opencode.txt')); }
	writeFileSync(join(output, 'manifest.json'), JSON.stringify({ schemaVersion: 1, product: 'unigma', clientCommit, serverCommit, target: { os: 'linux', arch: 'x64' }, totalSizeBytes: manifestFiles.reduce((n, item) => n + item.sizeBytes, 0), files: manifestFiles }, undefined, 2) + '\n');
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : 'payload creation failed'); process.exitCode = 1; }
