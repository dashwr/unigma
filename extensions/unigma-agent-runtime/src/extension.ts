/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentRuntimeApplication, RUNTIME_DEMAND_COMMAND } from './application/runtimeApplication';

export function activate(context: vscode.ExtensionContext): void {
	const application = new AgentRuntimeApplication();

	context.subscriptions.push(
		application,
		vscode.commands.registerCommand(RUNTIME_DEMAND_COMMAND, () => {
			application.acceptDemand({ source: 'command' });
		}),
	);
}
