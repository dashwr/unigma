/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { DisposableLike } from '../domain/runtime';
import type { LocalIntegrationPreflightResult, RuntimePorts } from '../application/runtimePorts';
import { RedactedDiagnosticSink } from './diagnostics';
import { OpenCodeHttpClient } from './openCodeHttpClient';
import { ChildProcessManager } from './processManager';
import { WorkspaceStateSessionReferenceStore } from './sessionReferenceStore';
import { enumerateLocalIntegrations } from './localIntegrationInventory';
import { evaluateRuntimeLocalIntegrationPreflight } from './localIntegrationPreflight';
import { isSupportedWorkspaceHost, resolveWorkspace } from './workspaceResolver';

/**
 * Composes the local adapters while keeping process and transport access outside the UI.
 */
export interface RuntimeInfrastructure extends DisposableLike {
	readonly ports: RuntimePorts;
}

export function createRuntimeInfrastructure(context: vscode.ExtensionContext): RuntimeInfrastructure {
	const diagnostics = new RedactedDiagnosticSink(vscode.window.createOutputChannel('Unigma Agent Runtime'));
	const processManager = new ChildProcessManager({ applicationDirectory: vscode.env.appRoot });
	const openCodeClient = new OpenCodeHttpClient({ diagnostics });
	const sessionReferenceStore = new WorkspaceStateSessionReferenceStore(context.workspaceState);
	const workspaceTrust = {
		isTrusted: (workspace: { readonly uri: string }): boolean => vscode.workspace.isTrusted
			&& isSupportedWorkspaceHost({ remoteName: vscode.env.remoteName, remoteAuthority: vscode.env.remoteAuthority, isWorkspaceHost: context.extension.extensionKind === vscode.ExtensionKind.Workspace })
			&& vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme === 'file' && folder.uri.toString() === workspace.uri) === true,
	};
	let disconnectPromise: Promise<void> | undefined;
	let stopPromise: Promise<void> | undefined;
	const inventories = new Map<string, Awaited<ReturnType<typeof enumerateLocalIntegrations>>>();
	const disconnect = (): Promise<void> => disconnectPromise ??= openCodeClient.disconnect();
	const stopOwned = (): Promise<void> => stopPromise ??= (async () => {
		try {
			await disconnect();
		} finally {
			await processManager.stopOwned();
		}
	})();

	return {
		ports: {
			resolveWorkspace: uri => {
				const remoteAuthority = vscode.env.remoteAuthority;
				return resolveWorkspace(uri, {
					remoteName: vscode.env.remoteName,
					remoteAuthority,
					isWorkspaceHost: context.extension.extensionKind === vscode.ExtensionKind.Workspace,
					folders: (vscode.workspace.workspaceFolders ?? []).map(folder => ({
						uri: folder.uri.toString(),
						transportUri: remoteAuthority ? folder.uri.with({ scheme: 'vscode-remote', authority: remoteAuthority }).toString() : folder.uri.toString(),
					})),
				});
			},
			workspaceTrust,
			processManager: {
				ensureStarted: workspace => processManager.ensureStarted(workspace),
				stopOwned,
			},
			enumerateLocalIntegrations: async workspace => {
				const inventory = await enumerateLocalIntegrations(workspace);
				inventories.set(workspace.uri, inventory);
				return inventory;
			},
			localIntegrationPreflight: (workspace, _requested): LocalIntegrationPreflightResult => {
				if (!workspaceTrust.isTrusted(workspace)) {
					return { accepted: false, code: 'workspaceUntrusted' };
				}
				const inventory = inventories.get(workspace.uri);
				return inventory ? evaluateRuntimeLocalIntegrationPreflight(inventory) : { accepted: false, code: 'unknownOrigin' };
			},
			openCodeClient: {
				connect: process => openCodeClient.connect(process),
				disconnect,
				send: request => openCodeClient.send(request),
				onEvent: listener => openCodeClient.onEvent(listener),
			},
			sessionReferenceStore,
			diagnostics,
		},
		dispose: () => {
			void stopOwned().catch(() => undefined).then(() => diagnostics.dispose());
		},
	};
}
