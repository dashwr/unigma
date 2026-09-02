/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBootstrapManifest } from '../bootstrapManifest.js';

const commit = '0123456789abcdef0123456789abcdef01234567';
const valid = {
	schemaVersion: 1, product: 'unigma', clientCommit: commit, serverCommit: commit,
	target: { os: 'linux', arch: 'x64' }, totalSizeBytes: 3,
	files: [
		{ id: 'unigma-server', relativePath: 'payload/server', sizeBytes: 1, sha256: 'a'.repeat(64) },
		{ id: 'unigma+opencode', relativePath: 'payload/opencode', sizeBytes: 2, sha256: 'b'.repeat(64) },
	],
};

test('accepts the strict v1 bootstrap manifest', () => {
	assert.equal(validateBootstrapManifest(valid).valid, true);
});

test('rejects extra fields, unsafe paths, duplicate ids and invalid target', () => {
	for (const value of [
		{ ...valid, extra: true },
		{ ...valid, files: [{ ...valid.files[0], relativePath: '../server' }, valid.files[1]] },
		{ ...valid, files: [valid.files[0], { ...valid.files[1], id: 'unigma-server' }] },
		{ ...valid, files: [valid.files[0], { ...valid.files[1], relativePath: valid.files[0].relativePath }] },
		{ ...valid, target: { os: 'windows', arch: 'x64' } },
	]) {
		assert.equal(validateBootstrapManifest(value).valid, false);
	}
});

test('rejects commit, hash, size and total mismatches', () => {
	for (const value of [
		{ ...valid, serverCommit: 'f'.repeat(40) },
		{ ...valid, files: [{ ...valid.files[0], sha256: 'bad' }, valid.files[1]] },
		{ ...valid, files: [{ ...valid.files[0], sizeBytes: 0 }, valid.files[1]] },
		{ ...valid, totalSizeBytes: 4 },
	]) {
		assert.equal(validateBootstrapManifest(value).valid, false);
	}
});
