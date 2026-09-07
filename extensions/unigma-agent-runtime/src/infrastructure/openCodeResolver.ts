/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface OpenCodeCandidate {
	readonly command: string;
	readonly exists: boolean;
	readonly executable: boolean;
}

export interface OpenCodeCandidates {
	readonly embedded?: OpenCodeCandidate;
	readonly configured?: OpenCodeCandidate;
	readonly path?: OpenCodeCandidate;
}

export type OpenCodeResolution =
	| { readonly kind: 'embedded'; readonly command: string }
	| { readonly kind: 'configured'; readonly command: string }
	| { readonly kind: 'path'; readonly command: string }
	| { readonly kind: 'unavailable'; readonly code: 'embedded-not-executable' | 'configured-not-executable' | 'no-executable-candidate' };

export interface EmbeddedOpenCodeProbe {
	/** Reports a single path as an executable candidate. */
	readonly inspect: (candidate: string) => OpenCodeCandidate;
	/** Reports whether a directory is present, without asserting its contents. */
	readonly directoryExists: (directory: string) => boolean;
	/** Path join for the host running the extension, injected so this stays pure. */
	readonly join: (...segments: string[]) => string;
}

/**
 * The product ships OpenCode in two packaged layouts, and both are its own
 * bundle rather than a host-provided binary. The desktop package writes
 * `opencode/bin/opencode` under `resources/app` (`build/gulpfile.vscode.ts`),
 * while the pair pushed to a remote host lands the binary beside the server
 * executable, as `<appRoot>/bin/opencode` (`build/unigma/make-payload.ts` and
 * `unigma-remote-ssh/src/remoteStagingScript.ts`, which extracts the staging
 * directory in place and activates it with `mv -T`).
 *
 * A remote extension host resolves against the second layout: its `appRoot` is
 * the activated version directory on the host, not the desktop package. Looking
 * only for the desktop layout there found nothing and fell through to `PATH`,
 * where the staged binary is not published either, so a remote session could
 * never start the runtime the very same payload had just delivered.
 */
export function resolveEmbeddedOpenCodeCandidate(applicationDirectory: string, probe: EmbeddedOpenCodeProbe): OpenCodeCandidate {
	const desktop = probe.inspect(probe.join(applicationDirectory, 'opencode', 'bin', 'opencode'));
	if (desktop.exists) {
		return desktop;
	}

	const server = probe.inspect(probe.join(applicationDirectory, 'bin', 'opencode'));
	if (server.exists) {
		return server;
	}

	/*
	 * The desktop bundle directory exists but holds no executable: report the
	 * bundle as present so resolution fails as a broken bundle instead of
	 * silently preferring whatever `PATH` happens to offer. The server layout
	 * has no such sentinel, because `<appRoot>/bin` always exists there.
	 */
	return probe.directoryExists(probe.join(applicationDirectory, 'opencode'))
		? { ...desktop, exists: true }
		: desktop;
}

/**
 * Resolves the bundled runtime before any user-provided or development command.
 * The package is the reproducible product input; an explicit command is only a
 * deliberate override, and PATH is retained last for development compatibility.
 */
export function resolveOpenCodeCommand(candidates: OpenCodeCandidates): OpenCodeResolution {
	if (candidates.embedded?.exists) {
		return candidates.embedded.executable
			? { kind: 'embedded', command: candidates.embedded.command }
			: { kind: 'unavailable', code: 'embedded-not-executable' };
	}

	if (candidates.configured?.exists) {
		return candidates.configured.executable
			? { kind: 'configured', command: candidates.configured.command }
			: { kind: 'unavailable', code: 'configured-not-executable' };
	}

	if (candidates.path?.exists && candidates.path.executable) {
		return { kind: 'path', command: candidates.path.command };
	}

	return { kind: 'unavailable', code: 'no-executable-candidate' };
}
