/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike, RuntimeDemand, RuntimeState, WorkspaceReference } from '../domain/runtime';
import type { RuntimePorts } from './runtimePorts';

export const RUNTIME_DEMAND_COMMAND = 'unigma.agent.runtime.activate';

/** Coordinates one trusted workspace connection without exposing transport details. */
export class AgentRuntimeApplication implements DisposableLike {
	private _state: RuntimeState = 'idle';
	private _lastDemand: RuntimeDemand | undefined;
	private readonly _ports: RuntimePorts | undefined;
	private _connectionPromise: Promise<void> | undefined;
	private _connectionWorkspaceUri: string | undefined;
	private _disposePromise: Promise<void> | undefined;
	private _runtimeTeardownPromise: Promise<void> | undefined;

	public constructor(ports?: RuntimePorts) {
		this._ports = ports;
	}

	public get state(): RuntimeState {
		return this._state;
	}

	public get lastDemand(): RuntimeDemand | undefined {
		return this._lastDemand;
	}

	public acceptDemand(demand: RuntimeDemand): void {
		if (this._state === 'disposed') {
			return;
		}

		this._state = 'demanded';
		this._lastDemand = demand;
	}

	/**
	 * Connects the runtime to one trusted workspace without creating a session or
	 * copying input. Session operations are deliberately left to the next slice.
	 */
	public async connectWorkspace(workspace: WorkspaceReference, requestId?: string): Promise<void> {
		if (this._state === 'disposed') {
			return;
		}

		if (!this._ports) {
			throw new Error('Unigma agent runtime ports are not configured.');
		}

		if (this._connectionPromise) {
			if (this._connectionWorkspaceUri !== workspace.uri) {
				throw new Error('The runtime is already connecting to a different workspace.');
			}
			return this._connectionPromise;
		}

		this.acceptDemand({ source: 'command', requestId });
		this._connectionWorkspaceUri = workspace.uri;
		this._connectionPromise = this.startConnection(workspace, requestId);
		try {
			await this._connectionPromise;
		} finally {
			this._connectionPromise = undefined;
			this._connectionWorkspaceUri = undefined;
		}
	}

	private async startConnection(workspace: WorkspaceReference, requestId?: string): Promise<void> {
		try {
			const process = await this._ports!.processManager.ensureStarted(workspace);
			if (this._state === 'disposed') {
				await this.disposeRuntime();
				return;
			}

			await this._ports!.openCodeClient.connect(process);
			if (this._state === 'disposed') {
				await this.disposeRuntime();
			}
		} catch (error) {
			if (this._state !== 'disposed') {
				this._ports!.diagnostics.record({ level: 'error', code: 'runtime.connection.failed', requestId });
			}
			try {
				await this.disposeRuntime();
			} catch {
				this._ports!.diagnostics.record({ level: 'error', code: 'runtime.teardown.failed', requestId });
			}
			throw error;
		}
	}

	public dispose(): void {
		if (this._state === 'disposed') {
			return;
		}

		this._state = 'disposed';
		this._lastDemand = undefined;
		this._disposePromise ??= this.disposeRuntime().catch(() => {
			this._ports?.diagnostics.record({ level: 'error', code: 'runtime.teardown.failed' });
		});
	}

	private async disposeRuntime(): Promise<void> {
		if (!this._ports) {
			return;
		}

		if (this._runtimeTeardownPromise) {
			return this._runtimeTeardownPromise;
		}

		const teardown = (async () => {
			try {
				await this._ports!.openCodeClient.disconnect();
			} finally {
				await this._ports!.processManager.stopOwned();
			}
		})();
		this._runtimeTeardownPromise = teardown;
		teardown.then(
			() => {
				if (this._runtimeTeardownPromise === teardown) {
					this._runtimeTeardownPromise = undefined;
				}
			},
			() => {
				if (this._runtimeTeardownPromise === teardown) {
					this._runtimeTeardownPromise = undefined;
				}
			},
		);
		await teardown;
	}
}
