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

function createDesktopFixture() {
	const root = mkdtempSync(join(tmpdir(), 'unigma-desktop-audit-'));
	const app = join(root, 'resources', 'app');
	mkdirSync(join(app, 'extensions', 'theme-unigma', 'themes'), { recursive: true });
	writeFileSync(join(app, 'package.json'), JSON.stringify({
		name: 'unigma',
		author: { name: 'Unigma contributors' },
		repository: { type: 'git', url: 'https://github.com/dashwr/unigma.git' },
		bugs: { url: 'https://github.com/dashwr/unigma/issues' },
	}));
	writeFileSync(join(app, 'product.json'), JSON.stringify({
		nameShort: 'unigma', nameLong: 'unigma', applicationName: 'unigma', licenseName: 'MIT', licenseFileName: 'LICENSE.txt',
		licenseUrl: 'https://github.com/dashwr/unigma/blob/main/LICENSE.txt',
		onboardingThemes: [{ themeId: 'unigma Dark', type: 'dark' }, { themeId: 'unigma Light', type: 'light' }],
		builtInExtensions: [], builtInExtensionsEnabledWithAutoUpdates: [],
		nodejsArtifactFeed: '', electronArtifactFeed: '', reportIssueUrl: '', voiceWsUrl: '',
	}));
	writeFileSync(join(app, 'extensions', 'theme-unigma', 'package.json'), JSON.stringify({
		name: 'theme-unigma', publisher: 'unigma', contributes: {
			themes: [
				{ id: 'unigma Dark', path: './themes/unigma-dark.json' },
				{ id: 'unigma Light', path: './themes/unigma-light.json' },
			]
		},
	}));
	writeFileSync(join(app, 'extensions', 'theme-unigma', 'themes', 'unigma-dark.json'), '{}');
	writeFileSync(join(app, 'extensions', 'theme-unigma', 'themes', 'unigma-light.json'), '{}');
	return root;
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

function auditDesktop(root: string) {
	return spawnSync(process.execPath, ['--experimental-strip-types', script, root], { encoding: 'utf8' });
}

test('requires the unigma theme extension and defaults in a desktop package', () => {
	const root = createDesktopFixture();
	try {
		const result = auditDesktop(root);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, /themeUnigma\.present=pass/);
		assert.match(result.stdout, /themeUnigma\.defaults=pass/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

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
