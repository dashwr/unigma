/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type RemoteSshPlatform = 'windows-x64' | 'linux-x64' | 'other';
export type RemoteSshHostTrust = 'trusted' | 'unknown' | 'mismatched' | 'revoked';
export type RemoteSshOpenSsh = 'available' | 'unavailable';
export type RemoteSshTarget = 'valid' | 'invalid';
export type RemoteSshConnectionState = 'ready' | 'interrupted';
export type RemoteSshServerCompatibility = 'compatible' | 'incompatible';

/** Fixture input only. It neither resolves an SSH target nor accesses credentials. */
export interface RemoteSshConnectionRequest {
	readonly clientPlatform: RemoteSshPlatform;
	readonly hostPlatform: RemoteSshPlatform;
	readonly workspaceTrusted: boolean;
	readonly openSsh: RemoteSshOpenSsh;
	readonly target: RemoteSshTarget;
	readonly hostTrust: RemoteSshHostTrust;
	readonly connectionState: RemoteSshConnectionState;
	readonly remoteServerCompatibility: RemoteSshServerCompatibility;
}

export type RemoteSshDecision =
	| { readonly accepted: true }
	| {
		readonly accepted: false;
		readonly code:
		| 'ssh.workspace-blocked'
		| 'ssh.remote-platform-unsupported'
		| 'ssh.client-unavailable'
		| 'ssh.target-unresolved'
		| 'ssh.host-key-untrusted'
		| 'ssh.connection-lost'
		| 'ssh.remote-server-incompatible';
	};

/** Applies the remote matrix before a future transport/provisioning implementation is allowed to run. */
export function evaluateRemoteSshConnection(request: RemoteSshConnectionRequest): RemoteSshDecision {
	if (!request.workspaceTrusted) {
		return { accepted: false, code: 'ssh.workspace-blocked' };
	}

	if ((request.clientPlatform !== 'windows-x64' && request.clientPlatform !== 'linux-x64') || request.hostPlatform !== 'linux-x64') {
		return { accepted: false, code: 'ssh.remote-platform-unsupported' };
	}

	if (request.openSsh !== 'available') {
		return { accepted: false, code: 'ssh.client-unavailable' };
	}

	if (request.target !== 'valid') {
		return { accepted: false, code: 'ssh.target-unresolved' };
	}

	if (request.hostTrust !== 'trusted') {
		return { accepted: false, code: 'ssh.host-key-untrusted' };
	}

	if (request.connectionState !== 'ready') {
		return { accepted: false, code: 'ssh.connection-lost' };
	}

	if (request.remoteServerCompatibility !== 'compatible') {
		return { accepted: false, code: 'ssh.remote-server-incompatible' };
	}

	return { accepted: true };
}
