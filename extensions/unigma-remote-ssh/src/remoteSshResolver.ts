/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { RemoteSshAuthorityTarget } from './remoteSshAuthority.js';
import { renderRemoteSshTarget } from './remoteSshTarget.js';
import {
	evaluateRemoteSshLocalPreflight,
	type RemoteSshFailureCode,
	type RemoteSshLocalObservation,
	type RemoteSshPhase,
	type RemoteSshPreflightResult
} from './remoteSshPreflight.js';
import {
	type RemoteServerFailure,
	type RemoteServerFailurePhase,
	type RemoteServerResult,
	type RemoteServerSession,
	type RemoteServerStagingSession
} from './remoteServerTransport.js';
import type { RemoteStagingFailurePhase } from './remoteStagingTransfer.js';

const SHA1 = /^[a-f0-9]{40}$/i;

export const CLIENT_COMMIT_UNAVAILABLE = 'ssh.client-commit-unavailable' as const;
export const REMOTE_SSH_STAGE_COMMAND_TITLE = 'Stage Remote Server';
export type RemoteSshResolverFailureCode = RemoteSshFailureCode | typeof CLIENT_COMMIT_UNAVAILABLE | 'ssh.provisioning-denied' | 'invalid-input';
export type RemoteSshResolverPhase = RemoteSshPhase | RemoteServerFailurePhase | RemoteStagingFailurePhase | 'commit';

export type ClientCommitResolution =
	| { readonly ok: true; readonly commit: string }
	| { readonly ok: false; readonly code: typeof CLIENT_COMMIT_UNAVAILABLE };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads only the build stamp; version, package metadata and Git are not substitutes. */
export function resolveClientCommitFromProduct(value: unknown): ClientCommitResolution {
	const commit = isRecord(value) && typeof value.commit === 'string' ? value.commit : undefined;
	return commit !== undefined && SHA1.test(commit)
		? { ok: true, commit: commit.toLowerCase() }
		: { ok: false, code: CLIENT_COMMIT_UNAVAILABLE };
}

/** The staging write proceeds only when the modal returns its explicit action. */
export function isRemoteStagingConfirmed(selectedAction: string | undefined): boolean {
	return selectedAction === REMOTE_SSH_STAGE_COMMAND_TITLE;
}

export interface RemoteSshMappedFailure {
	readonly code: RemoteSshResolverFailureCode;
	readonly phase: RemoteSshResolverPhase;
}

/** Converts transport-internal names into categories fixed by SSH-CONTRACT.md section 7. */
export function mapRemoteServerFailure(failure: RemoteServerFailure): RemoteSshMappedFailure {
	switch (failure.code) {
		case 'ssh.remote-home-invalid':
		case 'ssh.remote-socket-path-too-long':
			return { code: 'ssh.workspace-blocked', phase: failure.phase };
		case 'ssh.forward-failed':
			return { code: 'ssh.transport-failed', phase: failure.phase };
		case 'invalid-input':
			return { code: 'ssh.remote-server-unavailable', phase: failure.phase };
		default:
			return { code: failure.code, phase: failure.phase };
	}
}

export type RemoteSshResolutionResult =
	| {
		readonly ok: true;
		readonly target: RemoteSshAuthorityTarget;
		readonly destination: string;
		readonly commit: string;
		readonly session: RemoteServerSession;
	}
	| {
		readonly ok: false;
		readonly code: RemoteSshResolverFailureCode;
		readonly phase: RemoteSshResolverPhase;
		readonly destination?: string;
		readonly commit?: string;
		/** Fixed word from the remote script; never host data. See RemoteServerFailure. */
		readonly reason?: 'missing-version' | 'entry-point-not-executable';
		/**
		 * Exit status of the SSH process, when it closed before answering.
		 *
		 * `ssh.remote-server-unavailable` is also the generic verdict for a session
		 * that died without classifying itself, so on its own the code cannot tell
		 * a server that was never staged from one that failed for another reason.
		 * The exit status separates them — 255 is OpenSSH refusing the connection,
		 * anything else came from the remote shell — and it is a number produced
		 * locally, not host data.
		 */
		readonly exitCode?: number;
		readonly stagingSession?: RemoteServerStagingSession;
	};

export interface RemoteSshResolverDependencies {
	readonly resolveClientCommit: () => ClientCommitResolution;
	readonly openRemoteServer: (input: { readonly destination: string; readonly commit: string; readonly retainControlMasterOnServerUnavailable: true }, onConnectionLost: () => void) => Promise<RemoteServerResult>;
	readonly onConnectionLost?: () => void;
}

function isRemoteServerFailure(value: RemoteServerResult): value is RemoteServerFailure {
	return Object.prototype.hasOwnProperty.call(value, 'ok') && (value as RemoteServerFailure).ok === false;
}

/** Pure resolver sequencing: gates, build stamp, destination, then transport. */
export async function resolveRemoteSsh(
	local: RemoteSshLocalObservation,
	deps: RemoteSshResolverDependencies
): Promise<RemoteSshResolutionResult> {
	const preflight: RemoteSshPreflightResult = evaluateRemoteSshLocalPreflight(local);
	if (!preflight.accepted) {
		return { ok: false, code: preflight.code, phase: preflight.phase };
	}

	const clientCommit = deps.resolveClientCommit();
	if (!clientCommit.ok) {
		return { ok: false, code: clientCommit.code, phase: 'commit' };
	}

	const destination = renderRemoteSshTarget(preflight.target);
	const transport = await deps.openRemoteServer({ destination, commit: clientCommit.commit, retainControlMasterOnServerUnavailable: true }, () => deps.onConnectionLost?.());
	if (isRemoteServerFailure(transport)) {
		const mapped = mapRemoteServerFailure(transport);
		return { ok: false, ...mapped, reason: transport.reason, exitCode: transport.exitCode, destination, commit: clientCommit.commit, stagingSession: transport.stagingSession };
	}
	return { ok: true, target: preflight.target, destination, commit: clientCommit.commit, session: transport };
}

/**
 * Failures worth another attempt, as opposed to ones a retry cannot fix.
 *
 * The distinction is not cosmetic. During reconnection the workbench treats
 * `NotAvailable` as permanent and stops, so a dropped SSH channel — the most
 * ordinary thing that happens to a remote session — ended the window instead of
 * reconnecting. Only failures whose cause can clear on its own belong here: a
 * missing server, an untrusted host key or an unsupported platform all need a
 * person, and retrying them just hides the message that says so.
 */
export function isTransientRemoteSshFailure(code: RemoteSshResolverFailureCode): boolean {
	switch (code) {
		case 'ssh.connection-lost':
		case 'ssh.transport-failed':
		/**
		 * A busy bootstrap lock clears on its own once the session holding it
		 * finishes, so this is the one server-side refusal a retry can fix.
		 * `ssh.remote-server-start-failed` is deliberately not here: the server
		 * already failed to come up, and retrying only repeats the failure.
		 */
		case 'ssh.remote-server-busy':
			return true;
		default:
			return false;
	}
}
