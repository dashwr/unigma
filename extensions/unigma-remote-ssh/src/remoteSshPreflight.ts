/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pre-connection gate wiring for the `ssh-remote` authority.
 *
 * Four of the seven gates in `docs/SSH-CONTRACT.md` section 2.1 are observable on the
 * client before anything is dialled: workspace trust, client platform, OpenSSH
 * availability and target validity. The remaining three — host platform, host
 * key trust, channel state and remote server compatibility — can only be
 * observed from an established session with a `unigma-server` that matches the
 * client commit (`D-028`/`D-031`).
 *
 * This module runs the local gates in contract order and then hands the full
 * decision to the frozen T-013 policy, so `evaluateRemoteSshConnection` stays
 * the single authority. When the host observation is absent — which is always
 * the case in this build, because no transport or provisioning exists yet — the
 * result is a fail-closed `ssh.remote-server-unavailable` and no connection is
 * attempted.
 */

import { parseRemoteSshAuthority, type RemoteSshAuthorityRejection, type RemoteSshAuthorityTarget } from './remoteSshAuthority.js';
import type { OpenSshProbeResult } from './openSshClient.js';
import {
	evaluateRemoteSshConnection,
	type RemoteSshConnectionState,
	type RemoteSshHostTrust,
	type RemoteSshPlatform,
	type RemoteSshServerCompatibility
} from './remoteSshPolicy.js';

export type RemoteSshFailureCode =
	| 'ssh.workspace-blocked'
	| 'ssh.remote-platform-unsupported'
	| 'ssh.client-unavailable'
	| 'ssh.authentication-unavailable'
	| 'ssh.transport-failed'
	| 'ssh.target-unresolved'
	| 'ssh.host-key-untrusted'
	| 'ssh.connection-lost'
	| 'ssh.remote-server-incompatible'
	| 'ssh.remote-server-unavailable'
	| 'ssh.remote-server-busy'
	| 'ssh.remote-server-start-failed'
	| 'ssh.client-commit-unavailable';

export type RemoteSshPhase = 'workspace' | 'platform' | 'client' | 'authority' | 'host';

/** Observations the client can make without contacting the host. */
export interface RemoteSshLocalObservation {
	readonly authority: unknown;
	readonly workspaceTrusted: boolean;
	readonly clientPlatform: RemoteSshPlatform;
	readonly openSsh: OpenSshProbeResult;
}

/**
 * Observations that only a live, authorized session can produce. There is no
 * code path in this build that can populate it; it exists so the gate wiring is
 * testable without a host and without a fabricated transport.
 */
export interface RemoteSshHostObservation {
	readonly hostPlatform: RemoteSshPlatform;
	readonly hostTrust: RemoteSshHostTrust;
	readonly connectionState: RemoteSshConnectionState;
	readonly remoteServerCompatibility: RemoteSshServerCompatibility;
}

export type RemoteSshPreflightResult =
	| { readonly accepted: true; readonly target: RemoteSshAuthorityTarget }
	| {
		readonly accepted: false;
		readonly code: RemoteSshFailureCode;
		readonly phase: RemoteSshPhase;
		/** Present only for an authority rejection; never carries target text. */
		readonly rejection?: RemoteSshAuthorityRejection;
	};

/** Maps the running process to a contract platform row. */
export function detectClientPlatform(platform: string, arch: string): RemoteSshPlatform {
	if (arch !== 'x64') {
		return 'other';
	}
	if (platform === 'win32') {
		return 'windows-x64';
	}
	if (platform === 'linux') {
		return 'linux-x64';
	}
	return 'other';
}

export function evaluateRemoteSshPreflight(
	local: RemoteSshLocalObservation,
	host?: RemoteSshHostObservation
): RemoteSshPreflightResult {
	const localDecision = evaluateRemoteSshLocalPreflight(local);
	if (!localDecision.accepted) {
		return localDecision;
	}

	if (!host) {
		// No session, so host key, channel and server compatibility were never
		// verified. Refusing here is the only fail-closed answer available.
		return { accepted: false, code: 'ssh.remote-server-unavailable', phase: 'host' };
	}

	const decision = evaluateRemoteSshConnection({
		clientPlatform: local.clientPlatform,
		hostPlatform: host.hostPlatform,
		workspaceTrusted: true,
		openSsh: 'available',
		target: 'valid',
		hostTrust: host.hostTrust,
		connectionState: host.connectionState,
		remoteServerCompatibility: host.remoteServerCompatibility
	});

	if (!decision.accepted) {
		return { accepted: false, code: decision.code, phase: 'host' };
	}

	return { accepted: true, target: localDecision.target };
}

/** Runs exactly the local gates immediately before OpenSSH is started. */
export function evaluateRemoteSshLocalPreflight(local: RemoteSshLocalObservation):
	| { readonly accepted: true; readonly target: RemoteSshAuthorityTarget }
	| { readonly accepted: false; readonly code: RemoteSshFailureCode; readonly phase: Exclude<RemoteSshPhase, 'host'>; readonly rejection?: RemoteSshAuthorityRejection } {
	if (local.workspaceTrusted !== true) {
		return { accepted: false, code: 'ssh.workspace-blocked', phase: 'workspace' };
	}

	if (local.clientPlatform !== 'windows-x64' && local.clientPlatform !== 'linux-x64') {
		return { accepted: false, code: 'ssh.remote-platform-unsupported', phase: 'platform' };
	}

	if (local.openSsh?.available !== true) {
		return { accepted: false, code: 'ssh.client-unavailable', phase: 'client' };
	}

	const parsed = parseRemoteSshAuthority(local.authority);
	if (!parsed.ok) {
		return { accepted: false, code: 'ssh.target-unresolved', phase: 'authority', rejection: parsed.rejection };
	}
	return { accepted: true, target: parsed.target };
}

/**
 * User-facing text for a refusal. Derived only from the category, so no target,
 * command line, environment, path or host key material can reach a message.
 */
export function describeRemoteSshFailure(code: RemoteSshFailureCode): string {
	switch (code) {
		case 'ssh.workspace-blocked':
			return 'ssh.workspace-blocked: the workspace is not trusted. Trust the workspace before opening a remote window.';
		case 'ssh.remote-platform-unsupported':
			return 'ssh.remote-platform-unsupported: this client or host is outside the supported Windows x64 / Linux x64 matrix.';
		case 'ssh.client-unavailable':
			return 'ssh.client-unavailable: no usable OpenSSH client was found. Install OpenSSH and retry; unigma does not provide an alternative transport.';
		case 'ssh.authentication-unavailable':
			return 'ssh.authentication-unavailable: OpenSSH could not authenticate without an interactive credential. Fix the configured agent or keys and retry.';
		case 'ssh.transport-failed':
			return 'ssh.transport-failed: the SSH transport failed. Retry after checking the host and network.';
		case 'ssh.target-unresolved':
			return 'ssh.target-unresolved: the remote authority is not a valid SSH alias or user@host:port target. Fix the authority and retry.';
		case 'ssh.host-key-untrusted':
			return 'ssh.host-key-untrusted: the host key is unknown, changed or revoked. Establish trust through your own OpenSSH workflow and retry.';
		case 'ssh.connection-lost':
			return 'ssh.connection-lost: the SSH channel ended. Nothing pending was replayed; reconnect explicitly.';
		case 'ssh.remote-server-incompatible':
			return 'ssh.remote-server-incompatible: the remote unigma-server build does not match this client. There is no downgrade or fallback.';
		case 'ssh.remote-server-unavailable':
			return 'ssh.remote-server-unavailable: the matching unigma-server is not staged for this client commit. Run "Stage Remote Server" (unigma.remoteSsh.stageRemoteServer), then retry.';
		case 'ssh.remote-server-busy':
			return 'ssh.remote-server-busy: another session is starting the unigma-server on this host. Wait for it to finish, then retry. Staging again would not help.';
		case 'ssh.remote-server-start-failed':
			return 'ssh.remote-server-start-failed: the staged unigma-server was launched but ended without announcing its socket. The server is present, so staging again would not help; inspect the remote server log.';
		case 'ssh.client-commit-unavailable':
			return 'ssh.client-commit-unavailable: the running product commit is unavailable or invalid; the remote connection was refused.';
	}
}
