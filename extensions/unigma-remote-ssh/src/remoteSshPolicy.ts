/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type RemoteSshPlatform = 'windows-x64' | 'linux-x64' | 'other';
export type RemoteSshHostTrust = 'trusted' | 'unknown' | 'mismatched' | 'revoked';

/** Fixture input only. It neither resolves an SSH target nor accesses credentials. */
export interface RemoteSshConnectionRequest {
	readonly clientPlatform: RemoteSshPlatform;
	readonly hostPlatform: RemoteSshPlatform;
	readonly workspaceTrusted: boolean;
	readonly hostTrust: RemoteSshHostTrust;
}

export type RemoteSshDecision =
	| { readonly accepted: true }
	| { readonly accepted: false; readonly code: 'ssh.workspace-blocked' | 'ssh.remote-platform-unsupported' | 'ssh.host-key-untrusted' };

/** Applies the remote matrix before a future transport/provisioning implementation is allowed to run. */
export function evaluateRemoteSshConnection(request: RemoteSshConnectionRequest): RemoteSshDecision {
	if (!request.workspaceTrusted) {
		return { accepted: false, code: 'ssh.workspace-blocked' };
	}

	if ((request.clientPlatform !== 'windows-x64' && request.clientPlatform !== 'linux-x64') || request.hostPlatform !== 'linux-x64') {
		return { accepted: false, code: 'ssh.remote-platform-unsupported' };
	}

	if (request.hostTrust !== 'trusted') {
		return { accepted: false, code: 'ssh.host-key-untrusted' };
	}

	return { accepted: true };
}
