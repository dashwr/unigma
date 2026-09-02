/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BootstrapFileId, BootstrapManifest, BootstrapManifestFile } from './bootstrapManifest.js';

const SHA1 = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const SERVER_ARCHIVE_PATH = 'server/unigma-server.tar.gz';

/** The product metadata fixes this folder name for all versioned server data. */
export const REMOTE_SERVER_DATA_FOLDER = '.unigma-server';
export const REMOTE_SERVER_SOCKET_FILE = '.unigma-server.sock';

/**
 * Conservative budget for `sockaddr_un.sun_path`, which Linux caps at 108 bytes
 * including the terminator. Refusing early turns an opaque `listen EINVAL` from
 * the server into a named, observable refusal, as section 7 of the contract
 * requires.
 */
export const REMOTE_UNIX_SOCKET_PATH_MAX_BYTES = 100;

export interface RemoteServerPathsInput {
	readonly remoteUserBaseDirectory: string;
	readonly commit: string;
}

export interface RemoteServerPaths {
	readonly dataDirectory: string;
	readonly versionedDirectory: string;
	readonly executablePath: string;
	readonly serverDataDirectory: string;
	readonly socketPath: string;
}

type RemoteServerPathSegment =
	| { readonly type: 'literal'; readonly value: string }
	| { readonly type: 'commit' }
	| { readonly type: 'commit-prefix' }
	| { readonly type: 'commit-prefix-socket' };

const COMMIT_SEGMENT: RemoteServerPathSegment = { type: 'commit' };
const REMOTE_SERVER_PATH_TEMPLATES: Readonly<Record<keyof RemoteServerPaths, readonly RemoteServerPathSegment[]>> = {
	dataDirectory: [{ type: 'literal', value: REMOTE_SERVER_DATA_FOLDER }],
	versionedDirectory: [{ type: 'literal', value: REMOTE_SERVER_DATA_FOLDER }, { type: 'literal', value: 'bin' }, COMMIT_SEGMENT],
	executablePath: [{ type: 'literal', value: REMOTE_SERVER_DATA_FOLDER }, { type: 'literal', value: 'bin' }, COMMIT_SEGMENT, { type: 'literal', value: 'bin' }, { type: 'literal', value: 'unigma-server' }],
	serverDataDirectory: [{ type: 'literal', value: REMOTE_SERVER_DATA_FOLDER }, { type: 'literal', value: 'bin' }, COMMIT_SEGMENT, { type: 'literal', value: 'data' }],
	socketPath: [{ type: 'literal', value: REMOTE_SERVER_DATA_FOLDER }, { type: 'commit-prefix-socket' }]
};

export interface RemoteServerPathShellFragments {
	readonly dataDirectory: string;
	readonly versionedDirectory: string;
	readonly executablePath: string;
	readonly serverDataDirectory: string;
	readonly socketPath: string;
}

export type RemoteServerPathsValidation =
	| { readonly valid: true; readonly paths: RemoteServerPaths }
	| { readonly valid: false; readonly code: 'staging-invalid-base-directory' | 'staging-invalid-commit' | 'staging-socket-path-too-long' };

export interface RemoteStagingPlanInput {
	readonly manifest: BootstrapManifest;
	readonly remoteUserBaseDirectory: string;
	readonly serverDataFolderName: string;
}

export type RemoteStagingStep =
	| { readonly type: 'create-staging-directory'; readonly path: string }
	| {
		readonly type: 'receive-file';
		readonly id: BootstrapFileId;
		readonly relativePath: string;
		readonly path: string;
	}
	| {
		readonly type: 'verify-file';
		readonly id: BootstrapFileId;
		readonly path: string;
		readonly sizeBytes: number;
		readonly sha256: string;
	}
	| {
		readonly type: 'extract-server-archive';
		readonly archivePath: string;
		readonly destination: string;
	}
	| {
		readonly type: 'activate-atomically';
		readonly from: string;
		readonly to: string;
	};

export interface RemoteStagingPlan {
	readonly stagingDirectory: string;
	readonly activationPath: string;
	readonly steps: readonly RemoteStagingStep[];
}

export type RemoteStagingPlanError =
	| 'staging-invalid-input'
	| 'staging-invalid-base-directory'
	| 'staging-invalid-data-folder'
	| 'staging-invalid-commit'
	| 'staging-invalid-target'
	| 'staging-invalid-manifest'
	| 'staging-missing-file';

export type RemoteStagingPlanValidation =
	| { readonly valid: true; readonly plan: RemoteStagingPlan }
	| { readonly valid: false; readonly code: RemoteStagingPlanError };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnsafeCharacters(value: string): boolean {
	return value.includes('\\') || value.includes('\u0000') || /[\u0000-\u001f\u007f]/.test(value) || value.includes('..');
}

function isAbsolutePosixPath(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.startsWith('/') && !hasUnsafeCharacters(value);
}

function isSafeDirectoryName(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && !value.includes('/') && !hasUnsafeCharacters(value) && value !== '.';
}

function isSafeRelativePath(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.startsWith('/') || hasUnsafeCharacters(value)) {
		return false;
	}
	return value.split('/').every(part => part.length > 0 && part !== '.');
}

function isPositiveUint(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isBootstrapFile(value: unknown): value is BootstrapManifestFile {
	return isRecord(value)
		&& (value.id === 'unigma-server' || value.id === 'unigma+opencode')
		&& isSafeRelativePath(value.relativePath)
		&& isPositiveUint(value.sizeBytes)
		&& typeof value.sha256 === 'string'
		&& SHA256.test(value.sha256);
}

function joinPosix(base: string, ...parts: readonly string[]): string {
	const prefix = base === '/' ? '' : base.replace(/\/+$/, '');
	return `/${[prefix.replace(/^\/+/, ''), ...parts].filter(Boolean).join('/')}`;
}

function expandPathTemplate(base: string, commit: string, segments: readonly RemoteServerPathSegment[]): string {
	return joinPosix(base, ...segments.map(segment => {
		switch (segment.type) {
			case 'literal': return segment.value;
			case 'commit': return commit;
			case 'commit-prefix': return `${commit.slice(0, 12)}`;
			case 'commit-prefix-socket': return `${commit.slice(0, 12)}${REMOTE_SERVER_SOCKET_FILE}`;
		}
	}));
}

/** Generates shell expressions from the same path templates used by staging. */
export function buildRemoteServerPathShellFragments(): RemoteServerPathShellFragments {
	const shellPath = (segments: readonly RemoteServerPathSegment[]): string => {
		const suffix = segments.map(segment => {
			switch (segment.type) {
				case 'literal': return segment.value;
				case 'commit': return '$COMMIT';
				case 'commit-prefix': return '$COMMIT_PREFIX';
				case 'commit-prefix-socket': return `$COMMIT_PREFIX${REMOTE_SERVER_SOCKET_FILE}`;
			}
		}).join('/');
		return `"$BASE/${suffix}"`;
	};
	return {
		dataDirectory: shellPath(REMOTE_SERVER_PATH_TEMPLATES.dataDirectory),
		versionedDirectory: shellPath(REMOTE_SERVER_PATH_TEMPLATES.versionedDirectory),
		executablePath: shellPath(REMOTE_SERVER_PATH_TEMPLATES.executablePath),
		serverDataDirectory: shellPath(REMOTE_SERVER_PATH_TEMPLATES.serverDataDirectory),
		socketPath: shellPath(REMOTE_SERVER_PATH_TEMPLATES.socketPath)
	};
}

/** Validates a POSIX UNIX socket address before trusting it from a remote host. */
export function isValidRemoteUnixSocketPath(value: unknown): value is string {
	return isAbsolutePosixPath(value)
		&& Buffer.byteLength(value, 'utf8') <= REMOTE_UNIX_SOCKET_PATH_MAX_BYTES;
}

/** Derives paths used after activation, keeping them aligned with the staging plan. */
export function deriveRemoteServerPaths(input: RemoteServerPathsInput): RemoteServerPathsValidation {
	if (!isRecord(input)) {
		return { valid: false, code: 'staging-invalid-base-directory' };
	}
	if (!isAbsolutePosixPath(input.remoteUserBaseDirectory)) {
		return { valid: false, code: 'staging-invalid-base-directory' };
	}
	if (typeof input.commit !== 'string' || !SHA1.test(input.commit)) {
		return { valid: false, code: 'staging-invalid-commit' };
	}

	const dataDirectory = expandPathTemplate(input.remoteUserBaseDirectory, input.commit, REMOTE_SERVER_PATH_TEMPLATES.dataDirectory);
	const versionedDirectory = expandPathTemplate(input.remoteUserBaseDirectory, input.commit, REMOTE_SERVER_PATH_TEMPLATES.versionedDirectory);
	// The socket deliberately sits beside the versioned directory instead of
	// inside it. `sockaddr_un.sun_path` holds 108 bytes on Linux, and a socket
	// under the versioned directory spends 40 of them on the commit alone: the
	// server answered `listen EINVAL` for a base directory as ordinary as a
	// checkout under a home directory. A short commit prefix keeps one socket per
	// version without approaching the limit; the full commit still names the
	// directory that actually pins the build.
	const socketPath = expandPathTemplate(input.remoteUserBaseDirectory, input.commit, REMOTE_SERVER_PATH_TEMPLATES.socketPath);
	if (!isValidRemoteUnixSocketPath(socketPath)) {
		return { valid: false, code: 'staging-socket-path-too-long' };
	}
	return {
		valid: true,
		paths: {
			dataDirectory,
			versionedDirectory,
			executablePath: expandPathTemplate(input.remoteUserBaseDirectory, input.commit, REMOTE_SERVER_PATH_TEMPLATES.executablePath),
			serverDataDirectory: expandPathTemplate(input.remoteUserBaseDirectory, input.commit, REMOTE_SERVER_PATH_TEMPLATES.serverDataDirectory),
			socketPath,
		}
	};
}

/** Builds a deterministic remote payload plan without performing any I/O. */
export function planRemoteStaging(input: RemoteStagingPlanInput): RemoteStagingPlanValidation {
	if (!isRecord(input)) {
		return { valid: false, code: 'staging-invalid-input' };
	}

	if (!isAbsolutePosixPath(input.remoteUserBaseDirectory)) {
		return { valid: false, code: 'staging-invalid-base-directory' };
	}
	if (!isSafeDirectoryName(input.serverDataFolderName)) {
		return { valid: false, code: 'staging-invalid-data-folder' };
	}

	const manifestValue = input.manifest;
	if (!isRecord(manifestValue)) {
		return { valid: false, code: 'staging-invalid-manifest' };
	}
	if (typeof manifestValue.clientCommit !== 'string' || !SHA1.test(manifestValue.clientCommit)
		|| typeof manifestValue.serverCommit !== 'string' || !SHA1.test(manifestValue.serverCommit)
		|| manifestValue.clientCommit.toLowerCase() !== manifestValue.serverCommit.toLowerCase()) {
		return { valid: false, code: 'staging-invalid-commit' };
	}
	if (!isRecord(manifestValue.target) || manifestValue.target.os !== 'linux' || manifestValue.target.arch !== 'x64') {
		return { valid: false, code: 'staging-invalid-target' };
	}
	if (!Array.isArray(manifestValue.files) || !manifestValue.files.every(isBootstrapFile)) {
		return { valid: false, code: 'staging-invalid-manifest' };
	}
	if (manifestValue.files.length !== 2) {
		return { valid: false, code: 'staging-missing-file' };
	}

	const files = manifestValue.files as readonly BootstrapManifestFile[];
	const ids = new Set(files.map(file => file.id));
	if (ids.size !== 2 || !ids.has('unigma-server') || !ids.has('unigma+opencode')) {
		return { valid: false, code: 'staging-missing-file' };
	}
	const serverFile = files.find(file => file.id === 'unigma-server');
	if (!serverFile || serverFile.relativePath !== SERVER_ARCHIVE_PATH) {
		return { valid: false, code: 'staging-missing-file' };
	}

	const dataDirectory = joinPosix(input.remoteUserBaseDirectory, input.serverDataFolderName);
	const stagingDirectory = joinPosix(dataDirectory, 'staging', manifestValue.clientCommit);
	const activationPath = joinPosix(dataDirectory, 'bin', manifestValue.clientCommit);
	const paths = new Map<BootstrapFileId, string>();
	for (const file of files) {
		paths.set(file.id, joinPosix(stagingDirectory, ...file.relativePath.split('/')));
	}

	const steps: RemoteStagingStep[] = [
		{ type: 'create-staging-directory', path: stagingDirectory }
	];
	for (const file of files) {
		steps.push({ type: 'receive-file', id: file.id, relativePath: file.relativePath, path: paths.get(file.id)! });
	}
	for (const file of files) {
		steps.push({ type: 'verify-file', id: file.id, path: paths.get(file.id)!, sizeBytes: file.sizeBytes, sha256: file.sha256 });
	}
	steps.push(
		{ type: 'extract-server-archive', archivePath: paths.get(serverFile.id)!, destination: stagingDirectory },
		{ type: 'activate-atomically', from: stagingDirectory, to: activationPath }
	);

	return { valid: true, plan: { stagingDirectory, activationPath, steps } };
}
