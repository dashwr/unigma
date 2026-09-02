/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { RemoteSshAuthorityTarget } from './remoteSshAuthority.js';

/**
 * Renders only the destination positional argument accepted by OpenSSH.
 * An alias is deliberately returned byte-for-byte: section 4.1 of the SSH
 * contract makes the user's ssh_config the authority for its resolution.
 */
export function renderRemoteSshTarget(target: RemoteSshAuthorityTarget): string {
	if (target.kind === 'alias') {
		return target.alias;
	}

	const host = target.host.includes(':') ? `[${target.host}]` : target.host;
	const user = target.user === undefined ? '' : `${target.user}@`;
	const port = target.port === undefined ? '' : `:${target.port}`;
	return `${user}${host}${port}`;
}
