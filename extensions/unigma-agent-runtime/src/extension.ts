/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentRuntimeApplication, RUNTIME_DEMAND_COMMAND } from './application/runtimeApplication';
import { createRuntimeInfrastructure } from './infrastructure/runtimeInfrastructure';

export function activate(context: vscode.ExtensionContext): void {
	const infrastructure = createRuntimeInfrastructure(context);
	const application = new AgentRuntimeApplication(infrastructure.ports);

	context.subscriptions.push(
		infrastructure,
		application,
		vscode.commands.registerCommand(RUNTIME_DEMAND_COMMAND, async () => {
			const workspace = vscode.workspace.workspaceFolders?.[0];
			if (!workspace) {
				return;
			}

			if (!vscode.workspace.isTrusted) {
				infrastructure.ports.diagnostics.record({ level: 'warn', code: 'runtime.workspace.untrusted' });
				return;
			}

			try {
				await application.connectWorkspace({ uri: workspace.uri.toString() });
			} catch {
				infrastructure.ports.diagnostics.record({ level: 'error', code: 'runtime.unavailable' });
			}
		}),
	);
}
