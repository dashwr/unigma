/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const script = resolve(import.meta.dirname, '../../unigma/audit-distribution.ts');

interface FixtureOptions {
	readonly extensionsGallery?: unknown;
	readonly extension?: { readonly name: string; readonly packageJson?: Record<string, unknown> };
	readonly omitNode?: boolean;
}

function createServerFixture(options: FixtureOptions = {}) {
	const root = mkdtempSync(join(tmpdir(), 'unigma-server-audit-'));
	mkdirSync(join(root, 'bin'));
	mkdirSync(join(root, 'out'));
	mkdirSync(join(root, 'extensions'));
	writeFileSync(join(root, 'bin', 'unigma-server'), '#!/bin/sh\n', { mode: 0o755 });
	writeFileSync(join(root, 'node'), '', { mode: 0o755 });
	writeFileSync(join(root, 'LICENSE'), 'MIT\n');
	writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'unigma', type: 'module' }));
	writeFileSync(join(root, 'product.json'), JSON.stringify({
		nameShort: 'unigma',
		nameLong: 'unigma',
		applicationName: 'unigma',
		serverApplicationName: 'unigma-server',
		serverDataFolderName: '.unigma-server',
		extensionsGallery: options.extensionsGallery ?? false,
		builtInExtensions: [],
		builtInExtensionsEnabledWithAutoUpdates: [],
		nodejsArtifactFeed: '',
		electronArtifactFeed: '',
		reportIssueUrl: '',
		voiceWsUrl: '',
	}));
	if (options.omitNode) {
		unlinkSync(join(root, 'node'));
	}
	if (options.extension) {
		const extensionDirectory = join(root, 'extensions', options.extension.name);
		mkdirSync(extensionDirectory);
		if (options.extension.packageJson) {
			writeFileSync(join(extensionDirectory, 'package.json'), JSON.stringify(options.extension.packageJson));
		}
	}
	return root;
}

function audit(root: string) {
	return spawnSync(process.execPath, ['--experimental-strip-types', script, '--server', root], { encoding: 'utf8' });
}

test('accepts a valid server package', () => {
	const root = createServerFixture({
		extension: { name: 'remote-capable', packageJson: { name: 'remote-capable', main: './out/extension.js' } },
	});
	try {
		const result = audit(root);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, /product\.extensionsGallery=pass/);
		assert.match(result.stdout, /extensions\.uiOnly=pass/);
		assert.match(result.stdout, /audit=pass/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('rejects a prohibited server extension', () => {
	const root = createServerFixture({ extension: { name: 'github' } });
	try {
		mkdirSync(join(root, 'extensions', 'copilot-helper'));
		const result = audit(root);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /extensions\.prohibited=fail/);
		assert.match(result.stdout, /extensions\.prohibited\.count=2/);
		assert.match(result.stdout, /audit=fail/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('rejects an extension declared exclusively for the UI', () => {
	const root = createServerFixture({
		extension: { name: 'ui-only', packageJson: { name: 'ui-only', extensionKind: ['ui'] } },
	});
	try {
		const result = audit(root);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /extensions\.uiOnly=fail/);
		assert.match(result.stdout, /audit=fail/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('rejects an enabled extension gallery in a server package', () => {
	const root = createServerFixture({ extensionsGallery: { serviceUrl: 'https://example.invalid' } });
	try {
		const result = audit(root);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /product\.extensionsGallery=fail/);
		assert.match(result.stdout, /audit=fail/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('rejects an incomplete server package layout', () => {
	const root = createServerFixture({ omitNode: true });
	try {
		const result = audit(root);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /package\.layout=fail/);
		assert.match(result.stdout, /server\.layout\.node=fail/);
		assert.match(result.stdout, /audit=fail/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
