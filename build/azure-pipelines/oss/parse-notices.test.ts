/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Focused unit checks for the header parsing in parse-notices.ts.
 *
 *  Run:  node --experimental-strip-types build/azure-pipelines/oss/parse-notices.test.ts
 *
 *  ThirdPartyNotices headers come in four shapes; the "name version" shape (no
 *  trailing " - <license>") used to fall through to name-only, which glued the
 *  version into the package name and broke every name-based cross-reference.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPackageHeader, parseHeaderLine, parseNoticeFile } from './parse-notices.ts';

// -- "name version - license" -------------------------------------------------
assert.deepEqual(parseHeaderLine('@fig/autocomplete-shared 1.1.2 - MIT'), { name: '@fig/autocomplete-shared', version: '1.1.2', license: 'MIT' });
assert.deepEqual(parseHeaderLine('zsh 5.9 - Zsh'), { name: 'zsh', version: '5.9', license: 'Zsh' });

// -- "name - license" ---------------------------------------------------------
assert.deepEqual(parseHeaderLine('codex - Apache-2.0'), { name: 'codex', version: '', license: 'Apache-2.0' });

// -- "name version" (no license in the header) --------------------------------
assert.deepEqual(parseHeaderLine('@fig/autocomplete-shared 1.1.2'), { name: '@fig/autocomplete-shared', version: '1.1.2', license: '' });
assert.deepEqual(parseHeaderLine('fish-shell 3.7.1'), { name: 'fish-shell', version: '3.7.1', license: '' });
assert.deepEqual(parseHeaderLine('seti-ui 0.1.0'), { name: 'seti-ui', version: '0.1.0', license: '' });
assert.deepEqual(parseHeaderLine('zsh 5.9'), { name: 'zsh', version: '5.9', license: '' });
// Git SHA "versions" (CG git registrations)
assert.deepEqual(parseHeaderLine('amazon-q-developer-cli f66e0b0e917ab185eef528dc36eca56b78ca8b5d'), {
	name: 'amazon-q-developer-cli',
	version: 'f66e0b0e917ab185eef528dc36eca56b78ca8b5d',
	license: '',
});

// -- "name" only: never invent a version --------------------------------------
assert.deepEqual(parseHeaderLine('codex'), { name: 'codex', version: '', license: '' });
assert.deepEqual(parseHeaderLine('vscode-win32-app-container-tokens'), { name: 'vscode-win32-app-container-tokens', version: '', license: '' });
// A trailing word that is not a version token stays part of the name.
assert.deepEqual(parseHeaderLine('some-package beta'), { name: 'some-package beta', version: '', license: '' });
// A short hex string is not a git SHA.
assert.deepEqual(parseHeaderLine('some-package abcdef'), { name: 'some-package abcdef', version: '', license: '' });

// -- License prose is still rejected before parsing ---------------------------
assert.equal(isPackageHeader('END OF TERMS AND CONDITIONS'), false);
assert.equal(isPackageHeader('The MIT License (MIT)'), false);
assert.equal(isPackageHeader('Copyright (c) 2020 Author'), false);
assert.equal(isPackageHeader('PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2'), false);
assert.equal(isPackageHeader('zsh 5.9'), true);

// -- End-to-end over a fixture NOTICE file ------------------------------------
const sep = '-'.repeat(60);
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-notices-'));
const fixture = path.join(fixtureDir, 'ThirdPartyNotices.txt');
fs.writeFileSync(fixture, [
	'NOTICES AND INFORMATION',
	'Do Not Translate or Localize',
	'',
	sep,
	'@fig/autocomplete-shared 1.1.2',
	'',
	'https://example.invalid/fig',
	'',
	'MIT License',
	'',
	'Permission is hereby granted, free of charge, to any person obtaining a copy',
	'',
	sep,
	'vscode-win32-app-container-tokens',
	'',
	'MIT License text goes here.',
	'',
	sep,
	'zsh 5.9 - Zsh',
	'',
	'Zsh license text goes here.',
	'',
	sep,
	'',
].join('\n'));

try {
	const entries = parseNoticeFile(fixture);
	assert.equal(entries.length, 3);
	assert.deepEqual(entries.map(e => [e.name, e.version, e.license]), [
		['@fig/autocomplete-shared', '1.1.2', ''],
		['vscode-win32-app-container-tokens', '', ''],
		['zsh', '5.9', 'Zsh'],
	]);
	// The body is still captured (leading URL line stripped), so entries whose
	// header carries no license expression are not empty-bodied.
	assert.match(entries[0].licenseText ?? '', /^MIT License/);
	assert.ok(entries[0].licenseTextLength > 0);
} finally {
	fs.rmSync(fixtureDir, { recursive: true, force: true });
}

console.log('parse-notices header checks: passed');
