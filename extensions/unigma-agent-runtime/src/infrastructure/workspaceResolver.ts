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

/**
 * Resolve a file inside an open folder, so attached editor context never escapes it.
 * Only the folder prefix is rewritten; the remainder is preserved verbatim.
 */
export function resolveWorkspaceFile(uri: string, host: WorkspaceHost): string | undefined {
	if (!isSupportedWorkspaceHost(host) || uri.includes('?') || uri.includes('#') || uri.includes('..')) {
		return undefined;
	}
	for (const folder of host.folders) {
		if (!folder.uri.startsWith('file:')) {
			continue;
		}
		const prefix = folder.transportUri.endsWith('/') ? folder.transportUri : `${folder.transportUri}/`;
		if (uri.startsWith(prefix) && uri.length > prefix.length) {
			const base = folder.uri.endsWith('/') ? folder.uri.slice(0, -1) : folder.uri;
			return `${base}/${uri.slice(prefix.length)}`;
		}
	}
	return undefined;
}
