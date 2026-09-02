/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const MANIFEST_KEYS = ['schemaVersion', 'product', 'clientCommit', 'serverCommit', 'target', 'totalSizeBytes', 'files'] as const;
const TARGET_KEYS = ['os', 'arch'] as const;
const FILE_KEYS = ['id', 'relativePath', 'sizeBytes', 'sha256'] as const;
const FILE_IDS = ['unigma-server', 'unigma+opencode'] as const;
const HEX_SHA1 = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;

export type BootstrapFileId = typeof FILE_IDS[number];
export interface BootstrapManifestFile {
	readonly id: BootstrapFileId;
	readonly relativePath: string;
	readonly sizeBytes: number;
	readonly sha256: string;
}
export interface BootstrapManifest {
	readonly schemaVersion: 1;
	readonly product: 'unigma';
	readonly clientCommit: string;
	readonly serverCommit: string;
	readonly target: { readonly os: 'linux'; readonly arch: 'x64' };
	readonly totalSizeBytes: number;
	readonly files: readonly [BootstrapManifestFile, BootstrapManifestFile];
}
export type BootstrapManifestError =
	| 'manifest-not-object' | 'manifest-extra-field' | 'manifest-invalid-field' | 'manifest-invalid-commit'
	| 'manifest-commit-mismatch' | 'manifest-invalid-target' | 'manifest-invalid-total-size'
	| 'manifest-invalid-files' | 'manifest-duplicate-file' | 'manifest-invalid-path' | 'manifest-invalid-size'
	| 'manifest-invalid-hash' | 'manifest-size-mismatch';
export type BootstrapManifestValidation =
	| { readonly valid: true; readonly manifest: BootstrapManifest }
	| { readonly valid: false; readonly code: BootstrapManifestError };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).every(key => keys.includes(key));
}
function isPositiveUint(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function isSafeRelativePath(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.includes('\\') || value.includes('\u0000') || value.startsWith('/')) {
		return false;
	}
	return value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}

/** Validates an already decoded manifest without reading files or performing I/O. */
export function validateBootstrapManifest(value: unknown): BootstrapManifestValidation {
	if (!isRecord(value)) { return { valid: false, code: 'manifest-not-object' }; }
	if (!hasOnlyKeys(value, MANIFEST_KEYS)) { return { valid: false, code: 'manifest-extra-field' }; }
	if (value.schemaVersion !== 1 || value.product !== 'unigma') { return { valid: false, code: 'manifest-invalid-field' }; }
	if (typeof value.clientCommit !== 'string' || !HEX_SHA1.test(value.clientCommit) || typeof value.serverCommit !== 'string' || !HEX_SHA1.test(value.serverCommit)) { return { valid: false, code: 'manifest-invalid-commit' }; }
	if (value.clientCommit.toLowerCase() !== value.serverCommit.toLowerCase()) { return { valid: false, code: 'manifest-commit-mismatch' }; }
	if (!isRecord(value.target) || !hasOnlyKeys(value.target, TARGET_KEYS) || value.target.os !== 'linux' || value.target.arch !== 'x64') { return { valid: false, code: 'manifest-invalid-target' }; }
	if (!isPositiveUint(value.totalSizeBytes)) { return { valid: false, code: 'manifest-invalid-total-size' }; }
	if (!Array.isArray(value.files) || value.files.length !== FILE_IDS.length) { return { valid: false, code: 'manifest-invalid-files' }; }

	const files: BootstrapManifestFile[] = [];
	const ids = new Set<string>();
	const paths = new Set<string>();
	for (const file of value.files) {
		if (!isRecord(file) || !hasOnlyKeys(file, FILE_KEYS) || typeof file.id !== 'string' || !FILE_IDS.includes(file.id as BootstrapFileId)) { return { valid: false, code: 'manifest-invalid-files' }; }
		if (ids.has(file.id)) { return { valid: false, code: 'manifest-duplicate-file' }; }
		ids.add(file.id);
		if (!isSafeRelativePath(file.relativePath)) { return { valid: false, code: 'manifest-invalid-path' }; }
		if (paths.has(file.relativePath)) { return { valid: false, code: 'manifest-invalid-path' }; }
		paths.add(file.relativePath);
		if (!isPositiveUint(file.sizeBytes)) { return { valid: false, code: 'manifest-invalid-size' }; }
		if (typeof file.sha256 !== 'string' || !SHA256.test(file.sha256)) { return { valid: false, code: 'manifest-invalid-hash' }; }
		files.push({ id: file.id as BootstrapFileId, relativePath: file.relativePath, sizeBytes: file.sizeBytes, sha256: file.sha256 });
	}
	if (ids.size !== FILE_IDS.length || !FILE_IDS.every(id => ids.has(id))) { return { valid: false, code: 'manifest-invalid-files' }; }
	const totalSizeBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
	if (!Number.isSafeInteger(totalSizeBytes) || totalSizeBytes !== value.totalSizeBytes) { return { valid: false, code: 'manifest-size-mismatch' }; }
	return { valid: true, manifest: { schemaVersion: 1, product: 'unigma', clientCommit: value.clientCommit, serverCommit: value.serverCommit, target: { os: 'linux', arch: 'x64' }, totalSizeBytes: value.totalSizeBytes, files: files as [BootstrapManifestFile, BootstrapManifestFile] } };
}
