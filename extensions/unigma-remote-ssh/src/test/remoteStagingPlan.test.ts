/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { planRemoteStaging, type RemoteStagingPlanInput } from '../remoteStagingPlan.js';
import type { BootstrapManifest } from '../bootstrapManifest.js';

const commit = '0123456789abcdef0123456789abcdef01234567';

function input(overrides: Partial<RemoteStagingPlanInput> = {}): RemoteStagingPlanInput {
	return {
		remoteUserBaseDirectory: '/home/remote-user',
		serverDataFolderName: '.unigma-server',
		manifest: {
			schemaVersion: 1,
			product: 'unigma',
			clientCommit: commit,
			serverCommit: commit,
			target: { os: 'linux', arch: 'x64' },
			totalSizeBytes: 3,
			files: [
				{ id: 'unigma-server', relativePath: 'server/unigma-server.tar.gz', sizeBytes: 1, sha256: 'a'.repeat(64) },
				{ id: 'unigma+opencode', relativePath: 'bin/opencode', sizeBytes: 2, sha256: 'b'.repeat(64) },
			]
		},
		...overrides
	};
}

test('creates the complete versioned staging and activation plan', () => {
	const result = planRemoteStaging(input());
	assert.equal(result.valid, true);
	if (!result.valid) {
		return;
	}

	assert.equal(result.plan.stagingDirectory, `/home/remote-user/.unigma-server/staging/${commit}`);
	assert.equal(result.plan.activationPath, `/home/remote-user/.unigma-server/bin/${commit}`);
	assert.deepEqual(result.plan.steps, [
		{ type: 'create-staging-directory', path: result.plan.stagingDirectory },
		{ type: 'receive-file', id: 'unigma-server', relativePath: 'server/unigma-server.tar.gz', path: `${result.plan.stagingDirectory}/server/unigma-server.tar.gz` },
		{ type: 'receive-file', id: 'unigma+opencode', relativePath: 'bin/opencode', path: `${result.plan.stagingDirectory}/bin/opencode` },
		{ type: 'verify-file', id: 'unigma-server', path: `${result.plan.stagingDirectory}/server/unigma-server.tar.gz`, sizeBytes: 1, sha256: 'a'.repeat(64) },
		{ type: 'verify-file', id: 'unigma+opencode', path: `${result.plan.stagingDirectory}/bin/opencode`, sizeBytes: 2, sha256: 'b'.repeat(64) },
		{ type: 'extract-server-archive', archivePath: `${result.plan.stagingDirectory}/server/unigma-server.tar.gz`, destination: result.plan.stagingDirectory },
		{ type: 'activate-atomically', from: result.plan.stagingDirectory, to: result.plan.activationPath },
	]);
});

test('isolates staging and activation by commit', () => {
	const otherCommit = 'fedcba9876543210fedcba9876543210fedcba98';
	const first = planRemoteStaging(input());
	const second = planRemoteStaging(input({ manifest: { ...input().manifest, clientCommit: otherCommit, serverCommit: otherCommit } }));
	assert.equal(first.valid, true);
	assert.equal(second.valid, true);
	if (!first.valid || !second.valid) {
		return;
	}
	assert.notEqual(first.plan.stagingDirectory, second.plan.stagingDirectory);
	assert.notEqual(first.plan.activationPath, second.plan.activationPath);
});

test('rejects unsafe base directories and data folder names', () => {
	for (const remoteUserBaseDirectory of ['remote-user', '/home/../remote-user', '/home/remote\\user', '/home/remote\u0000user', '/home/remote\u0001user']) {
		const result = planRemoteStaging(input({ remoteUserBaseDirectory }));
		assert.deepEqual(result, { valid: false, code: 'staging-invalid-base-directory' });
	}
	for (const serverDataFolderName of ['../.unigma-server', 'remote\\server', 'remote\u0000server', 'remote\u0001server']) {
		const result = planRemoteStaging(input({ serverDataFolderName }));
		assert.deepEqual(result, { valid: false, code: 'staging-invalid-data-folder' });
	}
});

test('rejects unsafe manifest paths before building a plan', () => {
	for (const relativePath of ['../unigma-server.tar.gz', 'server\\unigma-server.tar.gz', 'server/\u0000archive.tar.gz', 'server/\u0001archive.tar.gz']) {
		const manifest = {
			...input().manifest,
			files: [{ ...input().manifest.files[0], relativePath }, input().manifest.files[1]]
		};
		assert.deepEqual(planRemoteStaging(input({ manifest: manifest as unknown as BootstrapManifest })), { valid: false, code: 'staging-invalid-manifest' });
	}
});

test('rejects an invalid commit or target', () => {
	const cases: readonly [unknown, string][] = [
		[{ ...input().manifest, clientCommit: 'short' }, 'staging-invalid-commit'],
		[{ ...input().manifest, serverCommit: 'f'.repeat(40) }, 'staging-invalid-commit'],
		[{ ...input().manifest, target: { os: 'windows', arch: 'x64' } }, 'staging-invalid-target'],
		[{ ...input().manifest, target: { os: 'linux', arch: 'arm64' } }, 'staging-invalid-target'],
	];
	for (const [manifest, code] of cases) {
		assert.deepEqual(planRemoteStaging(input({ manifest: manifest as BootstrapManifest })), { valid: false, code });
	}
});

test('rejects either missing member of the payload pair', () => {
	for (const files of [
		[input().manifest.files[0]],
		[input().manifest.files[1]],
		[input().manifest.files[0], { ...input().manifest.files[0], id: 'unigma-server' }],
		[{ ...input().manifest.files[0], relativePath: 'server/archive.tar.gz' }, input().manifest.files[1]],
	] as const) {
		const manifest = { ...input().manifest, files };
		assert.deepEqual(planRemoteStaging(input({ manifest: manifest as RemoteStagingPlanInput['manifest'] })), { valid: false, code: 'staging-missing-file' });
	}
});
