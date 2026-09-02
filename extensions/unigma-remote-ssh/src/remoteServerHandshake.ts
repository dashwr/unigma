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
	| { readonly valid: false; readonly code: 'invalid-commit' | 'invalid-base-directory' };

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
		return { valid: false, code: derived.code === 'staging-invalid-commit' ? 'invalid-commit' : 'invalid-base-directory' };
	}

	const { paths } = derived;
	const fifoPrefix = `${paths.versionedDirectory}/.unigma-bootstrap-`;
	const script = [
		'#!/bin/sh',
		'set -eu',
		'',
		`VERSIONED=${shellQuote(paths.versionedDirectory)}`,
		`SERVER=${shellQuote(paths.executablePath)}`,
		`SERVER_DATA=${shellQuote(paths.serverDataDirectory)}`,
		`SOCKET=${shellQuote(paths.socketPath)}`,
		`FIFO=${shellQuote(fifoPrefix)}$$`,
		`emit() { printf '%s%s\\n' ${shellQuote(REMOTE_HANDSHAKE_PREFIX)} "$1"; }`,
		'',
		'if [ ! -d "$VERSIONED" ] || [ ! -x "$SERVER" ]; then',
		`\temit '{"status":"server-unavailable"}'`,
		'\texit 41',
		'fi',
		'',
		'socket_state=2',
		'if [ -e "$SOCKET" ]; then',
		'\t# A missing probe or an inconclusive probe is treated as occupied; deleting an active socket is unsafe.',
		'\tif command -v fuser >/dev/null 2>&1; then',
		'\t\tfuser -s "$SOCKET" >/dev/null 2>&1 && socket_state=0 || socket_state=$?',
		'\telif command -v lsof >/dev/null 2>&1; then',
		'\t\tlsof -n -t -- "$SOCKET" >/dev/null 2>&1 && socket_state=0 || socket_state=$?',
		'\tfi',
		'\tcase "$socket_state" in',
		'\t\t0|2) emit \'{"status":"socket-occupied"}\'; exit 42 ;;',
		'\t\t1) rm -f "$SOCKET" || { emit \'{"status":"socket-occupied"}\'; exit 42; } ;;',
		'\t\t*) emit \'{"status":"socket-occupied"}\'; exit 42 ;;',
		'\tesac',
		'fi',
		'',
		'rm -f "$FIFO"',
		'cleanup() { rm -f "$FIFO"; }',
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
