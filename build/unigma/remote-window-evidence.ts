/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * What is allowed to leave a remote window smoke and become a published file.
 *
 * The workbench log of a remote session carries the host, the account, the
 * absolute paths of both machines and, on failure, whatever the remote shell
 * wrote to stderr. None of that may reach an artifact, so the evidence writer
 * does not filter the log: it reads the log and emits a new text built only
 * from vocabulary declared here.
 *
 * Everything below is a closed set chosen in this repository. A word only
 * appears in the evidence because it appears in one of these lists, which is
 * why a host cannot influence the output by choosing what to print. The
 * translation lives in its own module so it can be tested without running a
 * smoke against a real machine.
 */

export interface Observations {
	readonly resolverSuccess: boolean;
	readonly resolverError: boolean;
	readonly resolvedAuthorityConsumed: boolean;
	readonly connectionTokenHandshake: boolean;
	readonly trustBlocked: boolean;
	readonly tokenFailure: boolean;
	readonly extensionHostHandshake: boolean;
	readonly resolverElapsed?: string;
	readonly resolverErrorElapsed?: string;
	readonly handshakeElapsed?: string;
}

/**
 * The closed set of failure categories the resolver can name.
 *
 * The evidence writer reported only whether fixed patterns were present, so a
 * refusal arrived without saying which refusal it was. These are contract
 * categories, not free text: they carry no host, path, user or environment, so
 * naming the one that appeared is safe and is the difference between a
 * diagnosis and another runner cycle.
 */
export const CONTRACT_CATEGORIES = [
	'ssh.authentication-unavailable',
	'ssh.client-commit-unavailable',
	'ssh.client-unavailable',
	'ssh.connection-lost',
	'ssh.forward-failed',
	'ssh.host-key-untrusted',
	'ssh.provisioning-denied',
	'ssh.remote-home-invalid',
	'ssh.remote-platform-unsupported',
	'ssh.remote-server-busy',
	'ssh.remote-server-incompatible',
	'ssh.remote-server-start-failed',
	'ssh.remote-server-unavailable',
	'ssh.remote-socket-path-too-long',
	'ssh.target-unresolved',
	'ssh.transport-failed',
	'ssh.workspace-blocked'
] as const;

/**
 * The closed set of phases the resolver can name.
 *
 * Knowing the category without the phase still costs a runner cycle: the same
 * category means something different when it comes from the handshake than from
 * the bootstrap. Phases are contract vocabulary and carry nothing else.
 */
export const CONTRACT_PHASES = [
	'authority', 'bootstrap', 'client', 'commit', 'confirmation', 'connect',
	'forward', 'handshake', 'host', 'lifecycle', 'payload-transfer', 'platform',
	'remote-execution', 'script-delivery', 'validation', 'workspace'
] as const;

/**
 * Why the host said the server was not there.
 *
 * The category and the phase together still did not say whether the version was
 * missing or its entry point was not executable, which are the two halves of the
 * same refusal and have different causes. The vocabulary is fixed by the remote
 * script, so nothing host-specific can travel here.
 */
export const CONTRACT_REASONS = ['missing-version', 'entry-point-not-executable'] as const;

export function observedContractCategories(text: string): readonly string[] {
	return CONTRACT_CATEGORIES.filter(category => text.includes(category));
}

export function observedPhases(text: string): readonly string[] {
	return CONTRACT_PHASES.filter(phase => text.includes(`[${phase}]`));
}

export function observedReasons(text: string): readonly string[] {
	return CONTRACT_REASONS.filter(reason => text.includes(`reason=${reason}`));
}

/**
 * Exit status of the SSH process when it closed without answering.
 *
 * `ssh.remote-server-unavailable` is emitted both by the explicit refusal and by
 * the generic verdict for a session that died silently, and the sanitized log
 * kept only the code. A run reported that code with no reason at all, which the
 * evidence could not explain, so the number is published as well: it is produced
 * by the local process and bounded to three digits, so no host data rides on it.
 */
export function observedExitCodes(text: string): readonly string[] {
	// The lookbehind keeps `server-exit=` out: `\b` matches between `-` and `e`,
	// so without it the status of the remote server would be republished as the
	// status of the local SSH process, which is the confusion this key exists to
	// end.
	return boundedNumbers(text, /(?<![-\w])exit=(\d{1,3})\b/g);
}

/**
 * Exit status of the remote server, when it stopped without announcing itself.
 *
 * Separate from the SSH status because the session can end cleanly while the
 * process it launched on the far side did not, and the two were indistinguishable
 * for three runner cycles.
 */
export function observedServerExitCodes(text: string): readonly string[] {
	return boundedNumbers(text, /\bserver-exit=(\d{1,3})\b/g);
}

function boundedNumbers(text: string, pattern: RegExp): readonly string[] {
	const codes = new Set<string>();
	for (const match of text.matchAll(pattern)) {
		codes.add(match[1]);
	}
	return [...codes].sort();
}

/**
 * Build the evidence text from the observations and the raw log.
 *
 * The elapsed times are the only numbers taken from the log itself, and the
 * caller extracts them with anchored patterns that capture digits only.
 */
export function sanitizedEvidenceLines(observations: Observations, resolverAttempted = false, rawText = ''): readonly string[] {
	const lines: string[] = [];
	for (const category of observedContractCategories(rawText)) {
		lines.push(`observed=${category}`);
	}
	for (const phase of observedPhases(rawText)) {
		lines.push(`observed-phase=${phase}`);
	}
	for (const reason of observedReasons(rawText)) {
		lines.push(`observed-reason=${reason}`);
	}
	for (const exitCode of observedExitCodes(rawText)) {
		lines.push(`observed-exit=${exitCode}`);
	}
	for (const serverExitCode of observedServerExitCodes(rawText)) {
		lines.push(`observed-server-exit=${serverExitCode}`);
	}
	if (observations.resolverSuccess) {
		lines.push(`resolveAuthority(ssh-remote) returned after ${observations.resolverElapsed ?? 'unknown'} ms`);
	}
	if (observations.resolverError) {
		lines.push(`resolveAuthority(ssh-remote) returned an error after ${observations.resolverErrorElapsed ?? 'unknown'} ms`);
	}
	if (observations.resolvedAuthorityConsumed) {
		lines.push('remote ResolvedAuthority consumed by the management connection');
	} else if (resolverAttempted) {
		lines.push('category=ssh.resolved-authority-consumed');
	}
	if (observations.connectionTokenHandshake) {
		lines.push('remote connection token handshake accepted');
	} else if (resolverAttempted) {
		lines.push('category=ssh.connection-token-handshake');
	}
	if (observations.extensionHostHandshake) {
		lines.push(`remote ExtensionHost handshake finished after ${observations.handshakeElapsed ?? 'unknown'} ms`);
	}
	if (observations.trustBlocked) {
		lines.push('category=ssh.workspace-blocked');
	}
	if (observations.tokenFailure) {
		lines.push('category=ssh.connection-token-handshake');
	}
	return lines;
}
