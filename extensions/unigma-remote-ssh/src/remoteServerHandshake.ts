/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deriveRemoteServerPaths, type RemoteServerPaths } from './remoteStagingPlan.js';

export const REMOTE_HANDSHAKE_PREFIX = 'unigma-remote:';

const COMMIT = /^[0-9a-f]{40}$/;

export interface RemoteBootstrapScriptInput {
	readonly commit: string;
	readonly remoteUserBaseDirectory: string;
}

export type RemoteBootstrapScriptResult =
	| { readonly valid: true; readonly script: string; readonly paths: RemoteServerPaths }
	| { readonly valid: false; readonly code: 'invalid-commit' | 'invalid-base-directory' | 'socket-path-too-long' };

export type RemoteHandshake =
	| { readonly kind: 'ready' }
	| { readonly kind: 'server-unavailable' }
	| { readonly kind: 'socket-occupied' }
	| { readonly kind: 'start-failed' }
	| { readonly kind: 'unrecognized' };

function shellQuote(value: string): string {
	return `'${value}'`;
}

function hasForbiddenPathCharacters(value: string): boolean {
	return value.length === 0 || /['"$`\n]/.test(value);
}

/** Generates the only remote command; all caller-controlled paths are validated and quoted. */
export function buildRemoteBootstrapScript(input: RemoteBootstrapScriptInput): RemoteBootstrapScriptResult {
	if (typeof input?.commit !== 'string' || !COMMIT.test(input.commit)) {
		return { valid: false, code: 'invalid-commit' };
	}
	if (typeof input.remoteUserBaseDirectory !== 'string' || hasForbiddenPathCharacters(input.remoteUserBaseDirectory)) {
		return { valid: false, code: 'invalid-base-directory' };
	}

	const derived = deriveRemoteServerPaths({
		commit: input.commit,
		remoteUserBaseDirectory: input.remoteUserBaseDirectory
	});
	if (!derived.valid) {
		switch (derived.code) {
			case 'staging-invalid-commit': return { valid: false, code: 'invalid-commit' };
			// A base directory that pushes the socket past the address limit is
			// still a property of the base directory the caller supplied.
			case 'staging-socket-path-too-long': return { valid: false, code: 'socket-path-too-long' };
			default: return { valid: false, code: 'invalid-base-directory' };
		}
	}

	const { paths } = derived;
	const fifoPrefix = `${paths.versionedDirectory}/.unigma-bootstrap-`;
	const lockPath = `${paths.versionedDirectory}/.unigma-bootstrap.lock`;
	const script = [
		'#!/bin/sh',
		'set -eu',
		'',
		`VERSIONED=${shellQuote(paths.versionedDirectory)}`,
		`SERVER=${shellQuote(paths.executablePath)}`,
		`SERVER_DATA=${shellQuote(paths.serverDataDirectory)}`,
		`SOCKET=${shellQuote(paths.socketPath)}`,
		`FIFO=${shellQuote(fifoPrefix)}$$`,
		`LOCK=${shellQuote(lockPath)}`,
		`emit() { printf '%s%s\\n' ${shellQuote(REMOTE_HANDSHAKE_PREFIX)} "$1"; }`,
		'',
		'if [ ! -d "$VERSIONED" ] || [ ! -x "$SERVER" ]; then',
		`\temit '{"status":"server-unavailable"}'`,
		'\texit 41',
		'fi',
		'',
		// Ownership is claimed with `mkdir`, which is atomic on every POSIX
		// filesystem, instead of probing the socket with `fuser` or `lsof`. Those
		// tools are optional packages, so depending on them made the connection
		// fail closed on an otherwise healthy host, and "something is listening"
		// never established that the listener was a server this authority owns.
		// The lock records its shell's pid, so a session killed without running
		// its trap leaves a lock that the next attempt can recognise as stale via
		// `kill -0` rather than one that blocks the host forever.
		'owned=0',
		'if mkdir "$LOCK" 2>/dev/null; then',
		'\towned=1',
		'else',
		'\tholder=""',
		'\tif [ -f "$LOCK/pid" ]; then holder="$(cat "$LOCK/pid" 2>/dev/null || :)"; fi',
		'\t# An unreadable or absent pid is inconclusive, so the lock is respected.',
		'\tif [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then',
		'\t\trm -f "$LOCK/pid" || :',
		'\t\trmdir "$LOCK" 2>/dev/null || :',
		'\t\tif mkdir "$LOCK" 2>/dev/null; then owned=1; fi',
		'\tfi',
		'fi',
		'if [ "$owned" -ne 1 ]; then',
		`\temit '{"status":"socket-occupied"}'`,
		'\texit 42',
		'fi',
		'echo $$ > "$LOCK/pid"',
		'',
		'# Only the holder of the lock may clear a socket left behind by a dead session.',
		'rm -f "$SOCKET"',
		'rm -f "$FIFO"',
		'cleanup() { rm -f "$FIFO" "$LOCK/pid"; rmdir "$LOCK" 2>/dev/null || :; }',
		'trap cleanup 0 HUP INT TERM',
		'mkfifo "$FIFO" || { emit \'{"status":"start-failed"}\'; exit 43; }',
		'',
		'(',
		'\tready=0',
		'\twhile IFS= read -r line; do',
		'\t\t# The server prints this from its listen callback, after the UNIX socket accepts connections.',
		'\t\tif [ "$line" = "Extension host agent listening on $SOCKET" ] && [ "$ready" -eq 0 ]; then',
		`\t\temit '{"status":"ready"}'`,
		'\t\t\tready=1',
		'\t\tfi',
		'\tdone < "$FIFO"',
		'\tif [ "$ready" -eq 0 ]; then',
		`\t\temit '{"status":"start-failed"}'`,
		'\tfi',
		') &',
		'reader=$!',
		'',
		'# The server stays in the foreground so closing this SSH session owns its lifetime.',
		'# The UNIX socket is confined to this user-owned directory, so the server help\'s',
		'# "secured by other means" mode is appropriate and no token is written anywhere.',
		`"$SERVER" --socket-path "$SOCKET" --without-connection-token --accept-server-license-terms --telemetry-level off --server-data-dir "$SERVER_DATA" > "$FIFO" || server_status=$?`,
		'server_status=${server_status:-0}',
		'wait "$reader" || :',
		'exit "$server_status"',
		''
	].join('\n');

	return { valid: true, script, paths };
}

function statusToHandshake(status: unknown): RemoteHandshake | undefined {
	if (status === 'ready') {
		return { kind: 'ready' };
	}
	if (status === 'server-unavailable') {
		return { kind: 'server-unavailable' };
	}
	if (status === 'socket-occupied') {
		return { kind: 'socket-occupied' };
	}
	if (status === 'start-failed') {
		return { kind: 'start-failed' };
	}
	return undefined;
}

/** Parses only the stable, minimal bootstrap envelope and never retains its input. */
export function parseRemoteHandshake(line: string): RemoteHandshake {
	if (typeof line !== 'string' || !line.startsWith(REMOTE_HANDSHAKE_PREFIX)) {
		return { kind: 'unrecognized' };
	}
	try {
		const payload: unknown = JSON.parse(line.slice(REMOTE_HANDSHAKE_PREFIX.length));
		if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
			return { kind: 'unrecognized' };
		}
		const fields = Object.keys(payload);
		if (fields.length !== 1 || fields[0] !== 'status') {
			return { kind: 'unrecognized' };
		}
		return statusToHandshake((payload as { status?: unknown }).status) ?? { kind: 'unrecognized' };
	} catch {
		return { kind: 'unrecognized' };
	}
}
