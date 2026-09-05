/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike, RuntimeDemand, RuntimeDemandSource, RuntimeState, WorkspaceReference } from '../domain/runtime';
import type { RuntimePorts } from './runtimePorts';
import type { AgentRuntimeRpc, RuntimePromptCommand, RuntimeRpcEvent } from './rpc';

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
	private _runtimeTeardownCompleted = false;
	private readonly rpc: AgentRuntimeRpc<RuntimePromptCommand, RuntimeRpcEvent> | undefined;
	private readonly rpcSubscription: DisposableLike | undefined;
	private readonly clientEventSubscription: DisposableLike | undefined;
	private readonly sessionOperations = new Map<string, Promise<void>>();
	private readonly requestIds = new Set<string>();
	private readonly sessionIds = new Set<string>();

	public constructor(ports?: RuntimePorts, rpc?: AgentRuntimeRpc<RuntimePromptCommand, RuntimeRpcEvent>) {
		this._ports = ports;
		this.rpc = rpc;
		this.rpcSubscription = rpc?.onCommand(command => this.handleRpcCommand(command));
		this.clientEventSubscription = ports?.openCodeClient.onEvent(event => this.rpc?.emitEvent({ version: 1, type: 'session.event', event }));
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
	 * Connects the runtime to one trusted workspace before a command uses it.
	 */
	public async connectWorkspace(workspace: WorkspaceReference, requestId?: string, demandSource: RuntimeDemandSource = 'command'): Promise<void> {
		if (this._state === 'disposed') {
			return;
		}

		if (!this._ports) {
			throw new Error('Unigma agent runtime ports are not configured.');
		}

		this.requireTrustedWorkspace(workspace, requestId);

		if (this._connectionPromise) {
			if (this._connectionWorkspaceUri !== workspace.uri) {
				throw new Error('The runtime is already connecting to a different workspace.');
			}
			return this._connectionPromise;
		}

		this._runtimeTeardownCompleted = false;
		this.acceptDemand({ source: demandSource, requestId });
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
		const preflight = this._ports!.localIntegrationPreflight?.(workspace);
		if (!preflight || !preflight.accepted) {
			const refusalCode = preflight && !preflight.accepted ? preflight.code : 'unknownOrigin';
			this._ports!.diagnostics.record({
				level: 'warn',
				code: `runtime.integration.refused.${refusalCode}`,
				requestId,
			});
			throw new Error('Local integration preflight refused.');
		}

		try {
			const process = await this._ports!.processManager.ensureStarted(workspace);
			if (this.isDisposed()) {
				await this.disposeRuntime();
				return;
			}

			await this._ports!.openCodeClient.connect(process);
			if (this.isDisposed()) {
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

	private isDisposed(): boolean {
		return this._state === 'disposed';
	}

	private async handleRpcCommand(command: RuntimePromptCommand): Promise<void> {
		if (command.version !== 1 || command.type !== 'session.prompt' || this.isDisposed()) {
			return;
		}
		if (!this._ports) {
			this.emitRpcError(command.requestId, 'internal');
			return;
		}

		if (this.requestIds.has(command.requestId)) {
			this.emitRpcError(command.requestId, 'duplicateRequestId');
			return;
		}
		this.requestIds.add(command.requestId);

		if (!this._ports!.workspaceTrust.isTrusted(command.workspace)) {
			this._ports!.diagnostics.record({ level: 'warn', code: 'runtime.workspace.untrusted', requestId: command.requestId });
			this.emitRpcError(command.requestId, 'workspaceUntrusted');
			return;
		}

		const previous = this.sessionOperations.get(command.workspace.uri) ?? Promise.resolve();
		const operation = previous.catch(() => undefined).then(() => this.runPrompt(command));
		this.sessionOperations.set(command.workspace.uri, operation);
		return operation.finally(() => {
			if (this.sessionOperations.get(command.workspace.uri) === operation) {
				this.sessionOperations.delete(command.workspace.uri);
			}
		});
	}

	private async runPrompt(command: RuntimePromptCommand): Promise<void> {
		if (this.isDisposed()) {
			return;
		}

		// The gate in handlePrompt ran when this command was queued, and a queued
		// command waits for the ones ahead of it. Trust can stop holding in that
		// gap: closing the folder takes the workspace out of the trusted set while
		// the queue is still draining. Re-checking here also keeps the refusal
		// legible, because connectWorkspace throws and the catch below reports
		// every throw as internal, which reads as a runtime fault rather than a
		// denial.
		if (!this._ports!.workspaceTrust.isTrusted(command.workspace)) {
			this._ports!.diagnostics.record({ level: 'warn', code: 'runtime.workspace.untrusted', requestId: command.requestId });
			this.emitRpcError(command.requestId, 'workspaceUntrusted');
			return;
		}

		let createdSession = false;
		let sessionId: string | undefined;
		try {
			const reference = await this._ports!.sessionReferenceStore.read(command.workspace);
			const registeredSessionId = reference?.workspaceUri === command.workspace.uri ? reference.sessionId : undefined;
			if (registeredSessionId) {
				this.sessionIds.add(registeredSessionId);
			}
			if (command.sessionId !== undefined && (registeredSessionId !== command.sessionId || !this.sessionIds.has(command.sessionId))) {
				this.emitRpcError(command.requestId, 'sessionNotFound');
				return;
			}

			await this.connectWorkspace(command.workspace, command.requestId, 'rpc');
			if (this.isDisposed()) {
				return;
			}
			sessionId = registeredSessionId ?? await this.createSession();
			if (!registeredSessionId) {
				createdSession = true;
				await this._ports!.sessionReferenceStore.write({ sessionId, workspaceUri: command.workspace.uri });
			}
			this.sessionIds.add(sessionId);
			await this._ports!.openCodeClient.send({
				method: 'POST',
				path: `/session/${encodeURIComponent(sessionId)}/prompt_async`,
				body: command.prompt,
			});
			this.rpc?.emitEvent({ version: 1, type: 'session.ready', sessionId, requestId: command.requestId });
		} catch {
			if (createdSession) {
				this.sessionIds.delete(sessionId!);
				try {
					await this._ports!.sessionReferenceStore.remove(command.workspace);
				} catch {
					this._ports!.diagnostics.record({ level: 'error', code: 'runtime.session.rollback.failed', requestId: command.requestId });
				}
			}
			this._ports?.diagnostics.record({ level: 'error', code: 'runtime.session.failed', requestId: command.requestId });
			this.emitRpcError(command.requestId, 'internal');
		}
	}

	private emitRpcError(requestId: string, code: 'duplicateRequestId' | 'sessionNotFound' | 'workspaceUntrusted' | 'internal'): void {
		switch (code) {
			case 'duplicateRequestId':
				this.rpc?.emitEvent({ version: 1, type: 'session.error', requestId, error: { code, message: 'This request was already handled.', retryable: false } });
				return;
			case 'sessionNotFound':
				this.rpc?.emitEvent({ version: 1, type: 'session.error', requestId, error: { code, message: 'The requested session is not available.', retryable: false } });
				return;
			case 'workspaceUntrusted':
				this.rpc?.emitEvent({ version: 1, type: 'session.error', requestId, error: { code, message: 'The workspace is not trusted.', retryable: false } });
				return;
			case 'internal':
				this.rpc?.emitEvent({ version: 1, type: 'session.error', requestId, error: { code, message: 'The agent runtime could not complete the request.', retryable: false } });
				return;
		}
	}

	private requireTrustedWorkspace(workspace: WorkspaceReference, requestId?: string): void {
		if (!this._ports!.workspaceTrust.isTrusted(workspace)) {
			this._ports!.diagnostics.record({ level: 'warn', code: 'runtime.workspace.untrusted', requestId });
			throw new Error('The workspace is not trusted.');
		}
	}

	private async createSession(): Promise<string> {
		const created = await this._ports!.openCodeClient.send({ method: 'POST', path: '/session', body: {} });
		if (!created || typeof created !== 'object' || Array.isArray(created) || typeof (created as { id?: unknown }).id !== 'string') {
			throw new Error('OpenCode did not return a session reference.');
		}

		return (created as { id: string }).id;
	}

	public dispose(): void {
		if (this._state === 'disposed') {
			return;
		}

		this._state = 'disposed';
		this._lastDemand = undefined;
		this.requestIds.clear();
		this.sessionIds.clear();
		this.rpcSubscription?.dispose();
		this.clientEventSubscription?.dispose();
		this._disposePromise ??= this.disposeRuntime().catch(() => {
			this._ports?.diagnostics.record({ level: 'error', code: 'runtime.teardown.failed' });
		});
	}

	private async disposeRuntime(): Promise<void> {
		if (!this._ports) {
			return;
		}

		if (this._runtimeTeardownCompleted) {
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
				this._runtimeTeardownCompleted = true;
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
