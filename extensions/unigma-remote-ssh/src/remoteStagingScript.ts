/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import {
	validateBootstrapManifest,
	type BootstrapManifest,
	type BootstrapManifestFile
} from './bootstrapManifest.js';
import {
	buildRemoteServerPathShellFragments,
	buildRemoteStagingPathShellFragments,
	planRemoteStaging,
	REMOTE_SERVER_DATA_FOLDER
} from './remoteStagingPlan.js';
import { REMOTE_HANDSHAKE_PREFIX } from './remoteServerHandshake.js';

const COMMIT = /^[0-9a-f]{40}$/;

export interface RemoteStagingScriptInput {
	readonly commit: string;
	readonly manifest: BootstrapManifest;
}

export type RemoteStagingScriptError =
	| 'staging-invalid-input'
	| 'staging-invalid-commit'
	| 'staging-invalid-target'
	| 'staging-invalid-manifest'
	| 'staging-missing-file';

export type RemoteStagingScriptResult =
	| { readonly valid: true; readonly script: string; readonly manifestHash: string }
	| { readonly valid: false; readonly code: RemoteStagingScriptError };

export type RemoteStagingHandshake =
	| { readonly kind: 'activated' }
	| { readonly kind: 'already-activated' }
	| {
		readonly kind:
		| 'home-invalid'
		| 'staging-failed'
		| 'manifest-invalid'
		| 'payload-invalid'
		| 'file-missing'
		| 'file-size-mismatch'
		| 'file-hash-mismatch'
		| 'payload-extra-file'
		| 'server-archive-invalid'
		| 'server-not-executable'
		| 'activation-invalid'
		| 'activation-failed';
	};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shellQuote(value: string): string {
	const quote = String.fromCharCode(39);
	return `${quote}${value.split(quote).join(`${quote}\\${quote}${quote}`)}${quote}`;
}

function manifestJson(manifest: BootstrapManifest): string {
	return `${JSON.stringify(manifest, undefined, 2)}\n`;
}

/** Hashes the exact deterministic manifest bytes shown to the remote confirmation. */
export function hashBootstrapManifest(manifest: BootstrapManifest): string {
	return createHash('sha256').update(manifestJson(manifest)).digest('hex');
}

function mapPlanError(code: string): RemoteStagingScriptError {
	switch (code) {
		case 'staging-invalid-commit':
		case 'manifest-invalid-commit':
		case 'manifest-commit-mismatch': return 'staging-invalid-commit';
		case 'staging-invalid-target':
		case 'manifest-invalid-target': return 'staging-invalid-target';
		case 'staging-missing-file': return 'staging-missing-file';
		default: return 'staging-invalid-manifest';
	}
}

function fileAssignment(name: string, file: BootstrapManifestFile): string {
	return `${name}="$STAGING"/${shellQuote(file.relativePath)}`;
}

function expectedPathPredicate(files: readonly BootstrapManifestFile[]): string[] {
	const expected = ['manifest.json', 'LICENSE-opencode.txt', ...files.map(file => file.relativePath)];
	return [`\tif ${expected.map(path => `[ "$relative" = ${shellQuote(path)} ]`).join(' || ')}; then :; else exit 1; fi`];
}

/** Generates the host-side staging script without reading files or starting a process. */
export function buildRemoteStagingScript(input: unknown): RemoteStagingScriptResult {
	if (!isRecord(input) || typeof input.commit !== 'string' || !COMMIT.test(input.commit)) {
		return { valid: false, code: 'staging-invalid-commit' };
	}
	const manifestValidation = validateBootstrapManifest(input.manifest);
	if (!manifestValidation.valid) {
		return { valid: false, code: mapPlanError(manifestValidation.code) };
	}
	if (manifestValidation.manifest.clientCommit.toLowerCase() !== input.commit.toLowerCase()) {
		return { valid: false, code: 'staging-invalid-commit' };
	}
	const manifest = manifestValidation.manifest;
	const planValidation = planRemoteStaging({
		manifest,
		remoteUserBaseDirectory: '/home/remote-user',
		serverDataFolderName: REMOTE_SERVER_DATA_FOLDER
	});
	if (!planValidation.valid) {
		return { valid: false, code: mapPlanError(planValidation.code) };
	}

	const shellPaths = buildRemoteServerPathShellFragments();
	const stagingPaths = buildRemoteStagingPathShellFragments();
	const serverFile = manifest.files.find(file => file.id === 'unigma-server')!;
	const opencodeFile = manifest.files.find(file => file.id === 'unigma+opencode')!;
	const expected = manifestJson(manifest).trimEnd();
	const expectedPathLines = expectedPathPredicate(manifest.files);
	const script = [
		'#!/bin/sh',
		'set -eu',
		'',
		`emit() { printf '%s%s\\n' ${shellQuote(REMOTE_HANDSHAKE_PREFIX)} "$1"; }`,
		'fail() { emit "{\\"status\\":\\"$1\\"}"; exit "$2"; }',
		'SCRIPT_PATH=$0',
		// The sentinel is empty, never a real path. It used to be `/dev/null`, so a
		// trap firing before the real assignment ran `rm -rf /dev/null`: harmless
		// for an ordinary user, but this script is expected to run as root on some
		// hosts, and there it removes the device node and breaks the machine.
		'STAGING=',
		// Every recursive removal in this script goes through here. As root a wrong
		// or empty variable is the difference between cleaning a staging directory
		// and destroying the host, so the guard refuses anything that is not a
		// non-empty path strictly inside the directory this script owns, and
		// refuses silently rather than failing: cleanup must never mask the real
		// error that triggered it.
		'safe_rm() {',
		'\ttarget=${1:-}',
		'\t[ -n "$target" ] || return 0',
		'\t[ -n "${DATA_DIRECTORY:-}" ] || return 0',
		'\tcase "$target" in',
		'\t\t"$DATA_DIRECTORY"/?*) ;;',
		'\t\t*) return 0 ;;',
		'\tesac',
		'\tcase "$target" in',
		'\t\t*/..|*/../*) return 0 ;;',
		'\tesac',
		'\trm -rf -- "$target" 2>/dev/null || :',
		'}',
		'cleanup() { safe_rm "${STAGING:-}"; if [ -n "${SCRIPT_PATH:-}" ] && [ -f "${SCRIPT_PATH:-}" ]; then rm -f -- "$SCRIPT_PATH" 2>/dev/null || :; fi; }',
		'trap cleanup 0 HUP INT TERM',
		'',
		'if [ -z "${HOME:-}" ]; then fail home-invalid 44; fi',
		'case "$HOME" in /*) ;; *) fail home-invalid 44;; esac',
		'if [ ! -d "$HOME" ]; then fail home-invalid 44; fi',
		'BASE=$HOME',
		`COMMIT=${shellQuote(input.commit)}`,
		'COMMIT_PREFIX=${COMMIT%????????????????????????????}',
		`DATA_DIRECTORY=${shellPaths.dataDirectory}`,
		`STAGING=${stagingPaths.stagingDirectory}`,
		`VERSIONED=${shellPaths.versionedDirectory}`,
		`SERVER=${shellPaths.executablePath}`,
		`ACTIVATION=${stagingPaths.activationPath}`,
		fileAssignment('SERVER_ARCHIVE', serverFile),
		fileAssignment('OPENCODE', opencodeFile),
		'',
		'if [ -e "$VERSIONED" ] || [ -L "$VERSIONED" ]; then',
		'\tif [ -x "$VERSIONED/bin/unigma-server" ]; then emit \'{"status":"already-activated"}\'; exit 0; fi',
		'\tfail activation-invalid 49',
		'fi',
		'mkdir -p "$DATA_DIRECTORY/bin" || fail staging-failed 46',
		'safe_rm "$STAGING"',
		// `safe_rm` refuses silently, so the post-condition is asserted here rather
		// than assumed: a staging directory that survived means the guard rejected
		// the path, and continuing would extract over leftovers.
		'if [ -e "$STAGING" ] || [ -L "$STAGING" ]; then fail staging-failed 46; fi',
		'mkdir -p "$STAGING" || fail staging-failed 46',
		'',
		'if ! tar -xf - -C "$STAGING"; then fail payload-invalid 47; fi',
		'if [ ! -f "$STAGING/manifest.json" ] || [ -L "$STAGING/manifest.json" ]; then fail manifest-invalid 48; fi',
		`EXPECTED_MANIFEST=$(cat <<'UNIGMA_EXPECTED_MANIFEST'\n${expected}\nUNIGMA_EXPECTED_MANIFEST\n)`,
		'ACTUAL_MANIFEST=$(cat "$STAGING/manifest.json") || fail manifest-invalid 48',
		'if [ "$ACTUAL_MANIFEST" != "$EXPECTED_MANIFEST" ]; then fail manifest-invalid 48; fi',
		'',
		'if ! find "$STAGING" ! -type f ! -type d -print | while IFS= read -r entry; do',
		'\trelative=${entry#"$STAGING"/}',
		...expectedPathLines,
		'done; then fail payload-extra-file 49; fi',
		'if ! find "$STAGING" -type f -o -type l | while IFS= read -r entry; do',
		'\trelative=${entry#"$STAGING"/}',
		...expectedPathLines,
		'done; then fail payload-extra-file 49; fi',
		'',
		`check_file() { expected_path="$1"; expected_size="$2"; expected_hash="$3"; if [ ! -f "$expected_path" ] || [ -L "$expected_path" ]; then fail file-missing 50; fi; actual_size=$(wc -c < "$expected_path") || fail staging-failed 46; if [ "$actual_size" -ne "$expected_size" ]; then fail file-size-mismatch 51; fi; actual_hash=$(sha256sum -- "$expected_path" | awk '{print $1}') || fail staging-failed 46; if [ "$actual_hash" != "$expected_hash" ]; then fail file-hash-mismatch 52; fi; }`,
		`check_file "$SERVER_ARCHIVE" ${serverFile.sizeBytes} ${shellQuote(serverFile.sha256)}`,
		`check_file "$OPENCODE" ${opencodeFile.sizeBytes} ${shellQuote(opencodeFile.sha256)}`,
		'',
		'if ! tar -xzf "$SERVER_ARCHIVE" --strip-components=1 -C "$STAGING"; then fail server-archive-invalid 53; fi',
		'if [ ! -x "$STAGING/bin/unigma-server" ]; then fail server-not-executable 54; fi',
		'if [ -e "$VERSIONED" ] || [ -L "$VERSIONED" ]; then fail activation-invalid 49; fi',
		'if ! mv -T "$STAGING" "$VERSIONED"; then fail activation-failed 55; fi',
		'emit \'{"status":"activated"}\'',
		'exit 0',
		''
	].join('\n');

	return { valid: true, script, manifestHash: hashBootstrapManifest(manifest) };
}

/** Parses only the redacted staging envelope emitted by the host script. */
export function parseRemoteStagingHandshake(line: string): RemoteStagingHandshake | undefined {
	if (typeof line !== 'string' || !line.startsWith(REMOTE_HANDSHAKE_PREFIX)) {
		return undefined;
	}
	try {
		const payload: unknown = JSON.parse(line.slice(REMOTE_HANDSHAKE_PREFIX.length));
		if (!isRecord(payload) || Object.keys(payload).length !== 1 || typeof payload.status !== 'string') {
			return undefined;
		}
		if (payload.status === 'activated' || payload.status === 'already-activated') {
			return { kind: payload.status };
		}
		const statuses = new Set<RemoteStagingHandshake['kind']>([
			'home-invalid', 'staging-failed', 'manifest-invalid', 'payload-invalid', 'file-missing',
			'file-size-mismatch', 'file-hash-mismatch', 'payload-extra-file', 'server-archive-invalid',
			'server-not-executable', 'activation-invalid', 'activation-failed'
		]);
		return statuses.has(payload.status as RemoteStagingHandshake['kind']) ? { kind: payload.status as RemoteStagingHandshake['kind'] } : undefined;
	} catch {
		return undefined;
	}
}
