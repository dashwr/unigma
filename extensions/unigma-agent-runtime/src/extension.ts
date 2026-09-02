/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentRuntimeApplication, RUNTIME_DEMAND_COMMAND } from './application/runtimeApplication';
import type { TransportCommand } from './application/transport';
import { createRuntimeInfrastructure } from './infrastructure/runtimeInfrastructure';
import { createRuntimeTransport } from './infrastructure/runtimeTransport';

/** Internal serializable command channel from the workbench to the extension host. */
export const TRANSPORT_COMMAND = 'unigma.agent.runtime.transport.send';
/** Internal serializable command channel from the extension host to the workbench. */
export const TRANSPORT_EVENT_COMMAND = 'unigma.agent.runtime.transport.event';

export function activate(context: vscode.ExtensionContext): void {
	const infrastructure = createRuntimeInfrastructure(context);
	const application = new AgentRuntimeApplication(infrastructure.ports);
	const transport = createRuntimeTransport(infrastructure.ports);
	const eventSubscription = transport.onEvent(event => {
		void vscode.commands.executeCommand<void>(TRANSPORT_EVENT_COMMAND, event).then(() => undefined, () => undefined);
	});

	context.subscriptions.push(
		infrastructure,
		application,
		transport,
		eventSubscription,
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
		vscode.commands.registerCommand(TRANSPORT_COMMAND, (command: unknown) => {
			// O resultado deve permanecer void; transporte e eventos nunca cruzam como objeto.
			return transport.send(command as TransportCommand).then(() => undefined);
		}),
	);
}
