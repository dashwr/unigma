/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { DisposableLike } from '../domain/runtime';
import type { RuntimePorts } from '../application/runtimePorts';
import { RedactedDiagnosticSink } from './diagnostics';
import { OpenCodeHttpClient } from './openCodeHttpClient';
import { ChildProcessManager } from './processManager';
import { WorkspaceStateSessionReferenceStore } from './sessionReferenceStore';

/**
 * Composes the local adapters while keeping process and transport access outside the UI.
 */
export interface RuntimeInfrastructure extends DisposableLike {
	readonly ports: RuntimePorts;
}

export function createRuntimeInfrastructure(context: vscode.ExtensionContext): RuntimeInfrastructure {
	const diagnostics = new RedactedDiagnosticSink(vscode.window.createOutputChannel('Unigma Agent Runtime'));
	const processManager = new ChildProcessManager();
	const openCodeClient = new OpenCodeHttpClient({ diagnostics });
	const sessionReferenceStore = new WorkspaceStateSessionReferenceStore(context.workspaceState);

	return {
		ports: {
			processManager,
			openCodeClient,
			sessionReferenceStore,
			diagnostics,
		},
		dispose: () => {
			void openCodeClient.disconnect();
			void processManager.stopOwned();
			diagnostics.dispose();
		},
	};
}
