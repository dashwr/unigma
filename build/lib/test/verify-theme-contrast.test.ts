/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('unigma themes meet the WCAG contrast guard', () => {
	const repositoryRoot = resolve(import.meta.dirname, '../../..');
	const script = resolve(repositoryRoot, 'build/unigma/verify-theme-contrast.ts');
	const result = spawnSync(process.execPath, ['--experimental-strip-types', script], {
		cwd: repositoryRoot,
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /themeContrast=pass/);
});
