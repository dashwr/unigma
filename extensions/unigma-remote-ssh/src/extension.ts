/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { createOpenSshVersionRunner, probeOpenSshClient } from './openSshClient.js';
import { REMOTE_SSH_AUTHORITY_PREFIX } from './remoteSshAuthority.js';
import {
	describeRemoteSshFailure,
	detectClientPlatform,
	evaluateRemoteSshPreflight,
	type RemoteSshPreflightResult
} from './remoteSshPreflight.js';

/**
 * Registers the `ssh-remote` remote authority resolver.
 *
 * The resolver runs the pre-connection gates of `docs/SSH-CONTRACT.md` section 2.1 and
 * then stops. It cannot return a `ResolvedAuthority` or a
 * `ManagedResolvedAuthority`: both describe a reachable endpoint backed by a
 * running `unigma-server` of the same commit, and neither the transport
 * (B.2.4) nor the pre-installed server path (`D-031`) exists yet. Every
 * outcome is therefore a `RemoteAuthorityResolverError`, which is the
 * fail-closed behaviour the contract requires.
 */

/** Diagnostics carry the category and the phase only — never the target, command or environment. */
function log(channel: vscode.OutputChannel, resolveAttempt: number, result: RemoteSshPreflightResult): void {
	if (result.accepted) {
		channel.appendLine(`[attempt ${resolveAttempt}] pre-connection gates passed; awaiting host observation`);
		return;
	}
	const rejection = result.rejection ? ` (${result.rejection})` : '';
	channel.appendLine(`[attempt ${resolveAttempt}] refused at ${result.phase}: ${result.code}${rejection}`);
}

export function activate(context: vscode.ExtensionContext): void {
	const channel = vscode.window.createOutputChannel('unigma Remote SSH');
	context.subscriptions.push(channel);

	context.subscriptions.push(vscode.workspace.registerRemoteAuthorityResolver(REMOTE_SSH_AUTHORITY_PREFIX, {
		async resolve(authority: string, resolverContext: vscode.RemoteAuthorityResolverContext): Promise<vscode.ResolverResult> {
			const openSsh = await probeOpenSshClient(createOpenSshVersionRunner());

			// The host observation is intentionally omitted: host key trust,
			// channel state and server compatibility cannot be observed without
			// a session, and no session can be opened yet.
			const result = evaluateRemoteSshPreflight({
				authority,
				workspaceTrusted: vscode.workspace.isTrusted,
				clientPlatform: detectClientPlatform(process.platform, process.arch),
				openSsh
			});

			log(channel, resolverContext.resolveAttempt, result);

			throw vscode.RemoteAuthorityResolverError.NotAvailable(
				describeRemoteSshFailure(result.accepted ? 'ssh.remote-server-unavailable' : result.code)
			);
		}
	}));
}

export function deactivate(): void {
	// Nothing to tear down: no process, socket or connection is ever created.
}
