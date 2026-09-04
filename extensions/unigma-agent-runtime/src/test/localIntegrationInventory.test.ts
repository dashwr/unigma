/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { enumerateLocalIntegrations } from '../infrastructure/localIntegrationInventory';
import { evaluateRuntimeLocalIntegrationPreflight } from '../infrastructure/localIntegrationPreflight';

suite('Local integration inventory', () => {
	test('enumerates documented plugins and rules without approving them', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'unigma-inventory-'));
		const home = await mkdtemp(path.join(os.tmpdir(), 'unigma-home-'));
		try {
			await mkdir(path.join(root, '.opencode', 'plugins'), { recursive: true });
			await writeFile(path.join(root, '.opencode', 'plugins', 'local.ts'), 'export default {}');
			await writeFile(path.join(root, 'AGENTS.md'), 'Use the project context.');
			const inventory = await enumerateLocalIntegrations({ uri: pathToFileURL(root).toString() }, { homeDirectory: home });
			assert.strictEqual(inventory.complete, true);
			assert.deepStrictEqual(inventory.sources.map(source => ({ kind: source.kind, name: source.name, origin: source.origin, path: source.path, approved: source.approved })), [
				{ kind: 'plugin', name: 'local', origin: 'workspacePluginDirectory', path: 'insideWorkspace', approved: false },
				{ kind: 'rule', name: 'AGENTS.md', origin: 'workspaceRule', path: 'insideWorkspace', approved: false },
			]);
			assert.deepStrictEqual(evaluateRuntimeLocalIntegrationPreflight(inventory), { accepted: false, code: 'permissionDenied' });
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(home, { recursive: true, force: true });
		}
	});

	test('classifies a plugin symlink that escapes the workspace as external', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'unigma-inventory-'));
		const outside = await mkdtemp(path.join(os.tmpdir(), 'unigma-outside-'));
		const home = await mkdtemp(path.join(os.tmpdir(), 'unigma-home-'));
		try {
			await mkdir(path.join(root, '.opencode', 'plugins'), { recursive: true });
			await writeFile(path.join(outside, 'unsafe.ts'), 'export default {}');
			await symlink(path.join(outside, 'unsafe.ts'), path.join(root, '.opencode', 'plugins', 'unsafe.ts'));
			const inventory = await enumerateLocalIntegrations({ uri: pathToFileURL(root).toString() }, { homeDirectory: home, isApproved: () => true });
			assert.strictEqual(inventory.complete, true);
			assert.deepStrictEqual(inventory.sources[0], {
				kind: 'plugin',
				name: 'unsafe',
				origin: 'workspacePluginDirectory',
				path: 'externalSymlink',
				schema: 'valid',
				command: 'none',
				dependency: 'none',
				url: 'notApplicable',
				oauth: 'notApplicable',
				approved: true,
			});
			assert.deepStrictEqual(evaluateRuntimeLocalIntegrationPreflight(inventory), { accepted: false, code: 'externalSymlink' });
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(outside, { recursive: true, force: true });
			await rm(home, { recursive: true, force: true });
		}
	});

	test('marks malformed instruction configuration incomplete', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'unigma-inventory-'));
		const home = await mkdtemp(path.join(os.tmpdir(), 'unigma-home-'));
		try {
			await writeFile(path.join(root, 'opencode.jsonc'), '{ instructions: 42 }');
			const inventory = await enumerateLocalIntegrations({ uri: pathToFileURL(root).toString() }, { homeDirectory: home });
			assert.strictEqual(inventory.complete, false);
			assert.deepStrictEqual(evaluateRuntimeLocalIntegrationPreflight(inventory), { accepted: false, code: 'unknownOrigin' });
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(home, { recursive: true, force: true });
		}
	});

	test('keeps every preflight classification fail-closed', () => {
		const source = {
			kind: 'plugin' as const,
			name: 'local',
			origin: 'workspacePluginDirectory' as const,
			path: 'insideWorkspace' as const,
			schema: 'valid' as const,
			command: 'none' as const,
			dependency: 'none' as const,
			url: 'notApplicable' as const,
			oauth: 'notApplicable' as const,
			approved: true,
		};
		const cases = [
			[source, true],
			[{ ...source, origin: 'unknown' as const }, 'unknownOrigin'],
			[{ ...source, approved: false }, 'permissionDenied'],
			[{ ...source, path: 'externalSymlink' as const }, 'externalSymlink'],
			[{ ...source, path: 'outsideApprovedScope' as const }, 'pathOutsideApprovedScope'],
		] as const;
		for (const [entry, expected] of cases) {
			const inventory = { complete: true, sources: [entry] };
			assert.deepStrictEqual(evaluateRuntimeLocalIntegrationPreflight(inventory), expected === true ? { accepted: true } : { accepted: false, code: expected });
		}
		assert.deepStrictEqual(evaluateRuntimeLocalIntegrationPreflight({ complete: false, sources: [] }), { accepted: false, code: 'unknownOrigin' });
	});
});
