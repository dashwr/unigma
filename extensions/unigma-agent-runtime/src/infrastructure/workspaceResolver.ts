/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WorkspaceReference } from '../domain/runtime';

export interface WorkspaceHost {
	readonly remoteName: string | undefined;
	readonly remoteAuthority: string | undefined;
	readonly isWorkspaceHost: boolean;
	readonly folders: readonly {
		readonly uri: string;
		readonly transportUri: string;
	}[];
}

export function isSupportedWorkspaceHost(host: Pick<WorkspaceHost, 'remoteName' | 'remoteAuthority' | 'isWorkspaceHost'>): boolean {
	return !host.remoteName && !host.remoteAuthority
		|| host.isWorkspaceHost && host.remoteName === 'ssh-remote' && host.remoteAuthority?.startsWith('ssh-remote+') === true && host.remoteAuthority.length > 'ssh-remote+'.length;
}

/** Resolve only identities supplied by the host, never an arbitrary filesystem path. */
export function resolveWorkspace(uri: string, host: WorkspaceHost): WorkspaceReference | undefined {
	if (!isSupportedWorkspaceHost(host)) {
		return undefined;
	}
	const folder = host.folders.find(folder => folder.transportUri === uri);
	return folder?.uri.startsWith('file:') ? { uri: folder.uri } : undefined;
}
