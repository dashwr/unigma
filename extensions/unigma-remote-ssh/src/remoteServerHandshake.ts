/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	buildRemoteServerPathShellFragments,
	deriveRemoteServerPaths,
	isValidRemoteUnixSocketPath,
	REMOTE_UNIX_SOCKET_PATH_MAX_BYTES,
	type RemoteServerPaths
} from './remoteStagingPlan.js';

export const REMOTE_HANDSHAKE_PREFIX = 'unigma-remote:';

const COMMIT = /^[0-9a-f]{40}$/;

/**
 * How long a session that lost the bootstrap race waits for the owner's socket
 * before giving up. Long enough to cover a server that is still starting, short
 * enough that a genuinely stuck lock is reported instead of hanging the window.
 */
const REMOTE_SHARED_SOCKET_WAIT_SECONDS = 20;

export interface RemoteBootstrapScriptInput {
	readonly commit: string;
	readonly remoteUserBaseDirectory?: string;
	/** Keeps the owned SSH master alive after reporting a missing staged server. */
	readonly retainControlMasterOnServerUnavailable?: boolean;
}

export type RemoteBootstrapScriptResult =
	| { readonly valid: true; readonly script: string; readonly paths?: RemoteServerPaths }
	| { readonly valid: false; readonly code: 'invalid-commit' | 'invalid-base-directory' | 'socket-path-too-long' };

export type RemoteHandshake =
	| { readonly kind: 'ready'; readonly socketPath: string }
	| { readonly kind: 'server-unavailable'; readonly reason?: 'missing-version' | 'entry-point-not-executable' }
	| { readonly kind: 'socket-occupied' }
	| { readonly kind: 'home-invalid' }
	| { readonly kind: 'socket-path-too-long' }
	// The exit status of the server process, when it terminated without ever
	// announcing its socket. It is a number the remote shell produced from `$?`,
	// never host text, and it is the only thing that separates "the server
	// refused to run" from "the server ran and said nothing".
	| { readonly kind: 'start-failed'; readonly serverExitCode?: number }
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

	let paths: RemoteServerPaths | undefined;
	if (input.remoteUserBaseDirectory !== undefined) {
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
		paths = derived.paths;
	}

	const shellPaths = buildRemoteServerPathShellFragments();
	const script = [
		'#!/bin/sh',
		'set -eu',
		'',
		`emit() { printf '%s%s\\n' ${shellQuote(REMOTE_HANDSHAKE_PREFIX)} "$1"; }`,
		'',
		'if [ -z "${HOME:-}" ]; then',
		`\temit '{"status":"home-invalid"}'`,
		'\texit 44',
		'fi',
		'case "$HOME" in',
		`\t/*) ;;`,
		`\t*) emit '{"status":"home-invalid"}'; exit 44 ;;`,
		'esac',
		'if [ ! -d "$HOME" ]; then',
		`\temit '{"status":"home-invalid"}'`,
		'\texit 44',
		'fi',
		'BASE=$HOME',
		`COMMIT=${shellQuote(input.commit)}`,
		'COMMIT_PREFIX=${COMMIT%????????????????????????????}',
		`DATA_DIRECTORY=${shellPaths.dataDirectory}`,
		`VERSIONED=${shellPaths.versionedDirectory}`,
		`SERVER=${shellPaths.executablePath}`,
		`SERVER_DATA=${shellPaths.serverDataDirectory}`,
		`SOCKET=${shellPaths.socketPath}`,
		'FIFO="$VERSIONED/.unigma-bootstrap-$$"',
		'LOCK="$VERSIONED/.unigma-bootstrap.lock"',
		'SOCKET_BYTES=$(LC_ALL=C printf \'%s\' "$SOCKET" | wc -c)',
		`if [ "$SOCKET_BYTES" -gt ${REMOTE_UNIX_SOCKET_PATH_MAX_BYTES} ]; then`,
		`\temit '{"status":"socket-path-too-long"}'`,
		'\texit 45',
		'fi',
		'',
		// The two halves of this condition fail for very different reasons: a
		// version that was never staged, and a version that is on disk but whose
		// entry point is missing or not executable. Reporting one word for both
		// cost a runner cycle that ended with the directory provably present on
		// the host while the connection said the server was not there. The reason
		// is a fixed word chosen here, not host data.
		'if [ ! -d "$VERSIONED" ]; then',
		`\temit '{"status":"server-unavailable","reason":"missing-version"}'`,
		...(input.retainControlMasterOnServerUnavailable ? ['\twhile :; do sleep 3600; done'] : ['\texit 41']),
		'fi',
		'if [ ! -x "$SERVER" ]; then',
		`\temit '{"status":"server-unavailable","reason":"entry-point-not-executable"}'`,
		...(input.retainControlMasterOnServerUnavailable ? ['\twhile :; do sleep 3600; done'] : ['\texit 41']),
		'fi',
		'',
		// Ownership is claimed with `mkdir`, which is atomic on every POSIX
		// filesystem, instead of probing the socket with `fuser` or `lsof`. Those
		// tools are optional packages, so depending on them made the connection
		// fail closed on an otherwise healthy host, and "something is listening"
		// never established that the listener belonged to this authority.
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
		// Losing the race does not mean the window cannot be served. The lock is
		// scoped to one commit, so whoever holds it is starting, or has already
		// started, the very server this session was going to start. Refusing here
		// denied four runner cycles a server that was provably healthy on the
		// host. The socket is awaited briefly and then reused.
		//
		// Nothing is removed on this path and no cleanup trap is installed: this
		// session owns neither the lock nor the socket, and tearing down either
		// would take the server out from under the session that does own it.
		'if [ "$owned" -ne 1 ]; then',
		`\twaited=0`,
		`\twhile [ "$waited" -lt ${REMOTE_SHARED_SOCKET_WAIT_SECONDS} ]; do`,
		'\t\tif [ -S "$SOCKET" ]; then',
		`\t\t\tsocket_json=$(printf '%s' "$SOCKET" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')`,
		`\t\t\temit "{\\"status\\":\\"ready\\",\\"socketPath\\":\\"$socket_json\\"}"`,
		'\t\t\t# Held open so the forward outlives this script, exactly as the owning',
		'\t\t\t# session does. The server belongs to that session, so this one waits',
		'\t\t\t# to be closed by the client rather than ending on its own.',
		'\t\t\twhile :; do sleep 3600; done',
		'\t\tfi',
		'\t\tsleep 1',
		'\t\twaited=$((waited + 1))',
		'\tdone',
		`\temit '{"status":"socket-occupied"}'`,
		'\texit 42',
		'fi',
		'echo $$ > "$LOCK/pid"',
		'',
		'# Only the holder of the lock may clear a socket left behind by a dead session.',
		'rm -f "$SOCKET"',
		'rm -f "$FIFO"',
		'cleanup() { rm -f "$FIFO" "$LOCK/pid" "$LOCK/ready"; rmdir "$LOCK" 2>/dev/null || :; }',
		'trap cleanup 0 HUP INT TERM',
		`mkfifo "$FIFO" || { emit '{"status":"start-failed"}'; exit 43; }`,
		'',
		'(',
		'\tready=0',
		'\twhile IFS= read -r line; do',
		'\t\t# The server prints this from its listen callback, after the UNIX socket',
		'\t\t# accepts connections. Matched by prefix, not by equality against the',
		'\t\t# socket path: the server echoes the address it resolved, and one round',
		'\t\t# of normalisation there would silently look like a server that never',
		'\t\t# started. Nothing else can reach this FIFO, which is private to the',
		'\t\t# process this script launched, so the prefix identifies it.',
		'\t\tcase "$line" in',
		'\t\t"Extension host agent listening on "*)',
		'\t\t\tif [ "$ready" -eq 0 ]; then',
		`\t\t\t\tsocket_json=$(printf '%s' "$SOCKET" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')`,
		`\t\t\t\temit "{\\"status\\":\\"ready\\",\\"socketPath\\":\\"$socket_json\\"}"`,
		'\t\t\t\tready=1',
		'\t\t\t\t# The subshell cannot hand a variable back, and the exit status of',
		'\t\t\t\t# the server is only known outside it, so readiness is recorded in',
		'\t\t\t\t# the directory this session already owns.',
		'\t\t\t\t: > "$LOCK/ready"',
		'\t\t\tfi',
		'\t\t\t;;',
		'\t\tesac',
		'\tdone < "$FIFO"',
		') &',
		'reader=$!',
		'',
		'# The server stays in the foreground so closing this SSH session owns its lifetime.',
		'# The UNIX socket is confined to this user-owned directory, so the server help\'s',
		'# "secured by other means" mode is appropriate and no token is written anywhere.',
		`"$SERVER" --socket-path "$SOCKET" --without-connection-token --accept-server-license-terms --telemetry-level off --server-data-dir "$SERVER_DATA" > "$FIFO" || server_status=$?`,
		'server_status=${server_status:-0}',
		'wait "$reader" || :',
		'# Reported here rather than inside the reader, because only this shell knows',
		'# why the server stopped. A start that failed with a status is a different',
		'# fault from a start that succeeded and stayed silent, and the caller cannot',
		'# tell them apart without the number.',
		'if [ ! -f "$LOCK/ready" ]; then',
		`\temit "{\\"status\\":\\"start-failed\\",\\"exit\\":$server_status}"`,
		'fi',
		'exit "$server_status"',
		''
	].join('\n');

	return paths === undefined ? { valid: true, script } : { valid: true, script, paths };
}

function statusToHandshake(payload: Record<string, unknown>): RemoteHandshake | undefined {
	const status = payload.status;
	if (status === 'ready') {
		if (Object.keys(payload).length !== 2 || !Object.prototype.hasOwnProperty.call(payload, 'socketPath') || !isValidRemoteUnixSocketPath(payload.socketPath)) {
			return undefined;
		}
		return { kind: 'ready', socketPath: payload.socketPath };
	}
	// Checked before the single-key envelope rule, because this is the one status
	// that carries a second field. A fixed vocabulary, so an unexpected value is
	// dropped rather than forwarded: the reason travels into a log and must never
	// carry host data.
	if (status === 'server-unavailable') {
		const keys = Object.keys(payload).length;
		if (keys === 1) {
			return { kind: 'server-unavailable' };
		}
		if (keys !== 2 || !Object.prototype.hasOwnProperty.call(payload, 'reason')) {
			return undefined;
		}
		const reason = payload['reason'];
		if (reason === 'missing-version' || reason === 'entry-point-not-executable') {
			return { kind: 'server-unavailable', reason };
		}
		return undefined;
	}
	// The second status that carries a field, checked before the single-key rule
	// for the same reason as the one above. The value is bounded to a process
	// exit status so a host cannot widen it into a channel.
	if (status === 'start-failed') {
		const keys = Object.keys(payload).length;
		if (keys === 1) {
			return { kind: 'start-failed' };
		}
		if (keys !== 2 || !Object.prototype.hasOwnProperty.call(payload, 'exit')) {
			return undefined;
		}
		const serverExitCode = payload['exit'];
		if (typeof serverExitCode !== 'number' || !Number.isInteger(serverExitCode) || serverExitCode < 0 || serverExitCode > 255) {
			return undefined;
		}
		return { kind: 'start-failed', serverExitCode };
	}
	if (Object.keys(payload).length !== 1) {
		return undefined;
	}
	if (status === 'socket-occupied') {
		return { kind: 'socket-occupied' };
	}
	if (status === 'home-invalid') {
		return { kind: 'home-invalid' };
	}
	if (status === 'socket-path-too-long') {
		return { kind: 'socket-path-too-long' };
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
		return statusToHandshake(payload as Record<string, unknown>) ?? { kind: 'unrecognized' };
	} catch {
		return { kind: 'unrecognized' };
	}
}
