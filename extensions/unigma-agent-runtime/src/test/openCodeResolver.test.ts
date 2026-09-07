/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { resolveEmbeddedOpenCodeCandidate, resolveOpenCodeCommand } from '../infrastructure/openCodeResolver';

const candidate = (command: string, exists = true, executable = true) => ({ command, exists, executable });

suite('OpenCode command resolver', () => {
	test('prefers the embedded executable over configured and PATH candidates', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			embedded: candidate('/app/opencode/bin/opencode'),
			configured: candidate('/home/user/opencode'),
			path: candidate('/usr/bin/opencode'),
		}), { kind: 'embedded', command: '/app/opencode/bin/opencode' });
	});

	test('uses the explicit configured candidate when the bundle is absent', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			configured: candidate('/home/user/opencode'),
			path: candidate('/usr/bin/opencode'),
		}), { kind: 'configured', command: '/home/user/opencode' });
	});

	test('uses PATH only when higher-precedence candidates are absent', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({ path: candidate('/usr/bin/opencode') }), { kind: 'path', command: '/usr/bin/opencode' });
	});

	test('does not hide a broken embedded executable with PATH', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			embedded: candidate('/app/opencode/bin/opencode', true, false),
			path: candidate('/usr/bin/opencode'),
		}), { kind: 'unavailable', code: 'embedded-not-executable' });
	});

	test('fails closed when no candidate is executable', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			embedded: candidate('/app/opencode/bin/opencode', false),
			path: candidate('/usr/bin/opencode', true, false),
		}), { kind: 'unavailable', code: 'no-executable-candidate' });
	});
});

/*
 * The desktop package and the payload staged on a remote host place the bundle
 * in different directories, and the remote extension host only ever sees the
 * second one. These tests pin both layouts against a fake filesystem so the
 * decision does not depend on which machine runs the suite.
 */
suite('Embedded OpenCode layouts', () => {
	const join = (...segments: string[]) => segments.join('/');
	const probe = (files: readonly string[], directories: readonly string[] = [], executable = true) => ({
		join,
		inspect: (command: string) => ({ command, exists: files.includes(command), executable: files.includes(command) && executable }),
		directoryExists: (directory: string) => directories.includes(directory),
	});

	test('resolves the desktop package layout', () => {
		const resolved = resolveEmbeddedOpenCodeCandidate('/app', probe(['/app/opencode/bin/opencode'], ['/app/opencode']));
		assert.deepStrictEqual(resolved, { command: '/app/opencode/bin/opencode', exists: true, executable: true });
	});

	test('resolves the layout staged on a remote host, beside the server executable', () => {
		// This is the layout `mv -T` activates on the host: appRoot is the
		// version directory, and the payload wrote bin/opencode inside it.
		const resolved = resolveEmbeddedOpenCodeCandidate('/home/user/.unigma-server/bin/abc', probe(['/home/user/.unigma-server/bin/abc/bin/opencode']));
		assert.deepStrictEqual(resolved, { command: '/home/user/.unigma-server/bin/abc/bin/opencode', exists: true, executable: true });
	});

	test('prefers the desktop layout when both are present', () => {
		const resolved = resolveEmbeddedOpenCodeCandidate('/app', probe(['/app/opencode/bin/opencode', '/app/bin/opencode'], ['/app/opencode']));
		assert.strictEqual(resolved.command, '/app/opencode/bin/opencode');
	});

	test('reports a broken desktop bundle as present instead of falling through to PATH', () => {
		const resolved = resolveEmbeddedOpenCodeCandidate('/app', probe([], ['/app/opencode']));
		assert.deepStrictEqual(resolved, { command: '/app/opencode/bin/opencode', exists: true, executable: false });
		assert.deepStrictEqual(resolveOpenCodeCommand({ embedded: resolved }), { kind: 'unavailable', code: 'embedded-not-executable' });
	});

	test('leaves PATH reachable when no bundle directory exists at all', () => {
		const resolved = resolveEmbeddedOpenCodeCandidate('/app', probe([]));
		assert.strictEqual(resolved.exists, false);
		assert.deepStrictEqual(
			resolveOpenCodeCommand({ embedded: resolved, path: candidate('/usr/bin/opencode') }),
			{ kind: 'path', command: '/usr/bin/opencode' },
		);
	});

	test('does not hide a staged binary that lost its executable bit', () => {
		const resolved = resolveEmbeddedOpenCodeCandidate('/srv/abc', probe(['/srv/abc/bin/opencode'], [], false));
		assert.deepStrictEqual(resolved, { command: '/srv/abc/bin/opencode', exists: true, executable: false });
		assert.deepStrictEqual(resolveOpenCodeCommand({ embedded: resolved }), { kind: 'unavailable', code: 'embedded-not-executable' });
	});
});
