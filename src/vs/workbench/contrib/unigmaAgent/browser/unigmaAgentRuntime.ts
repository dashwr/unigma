/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	AGENT_PROTOCOL_VERSION,
	type AgentCatalogResult,
	type AgentError,
	AgentCommand,
	AgentCommandType,
	AgentErrorCode,
	type AgentErrorEvent,
	type AgentLocalIntegrationPreflight,
	AgentEvent,
	AgentEventType,
	validateAgentEvent,
} from '../common/agentProtocol.js';

export const enum UnigmaAgentRuntimeConnectionState {
	Disconnected = 'disconnected',
	Connected = 'connected',
}

export type AgentModelSelectionResult =
	| { readonly selected: true }
	| { readonly selected: false; readonly error: AgentError };

/** Serializable internal channel from the workbench to the extension host. */
export const UNIGMA_AGENT_RUNTIME_TRANSPORT_COMMAND = 'unigma.agent.runtime.transport.send';
/** Serializable internal channel from the extension host to the workbench. */
export const UNIGMA_AGENT_RUNTIME_TRANSPORT_EVENT_COMMAND = 'unigma.agent.runtime.transport.event';

/** Injectable boundary for tests and future RPC adapters. */
export interface IUnigmaAgentRpcTransport {
	readonly onDidReceiveEvent: Event<unknown>;

	send(command: AgentCommand): Promise<void>;
}

/** UI-facing RPC adapter. It owns no process, network connection, or persisted state. */
export interface IUnigmaAgentRuntime {
	readonly _serviceBrand: undefined;
	readonly onDidReceiveEvent: Event<AgentEvent>;
	readonly connectionState: UnigmaAgentRuntimeConnectionState;
	readonly onDidChangeConnectionState: Event<UnigmaAgentRuntimeConnectionState>;

	start(preflight: AgentLocalIntegrationPreflight, workspaceUri?: string): Promise<void>;
	stopSession(sessionId: string): Promise<void>;
	sendInput(sessionId: string, text: string): Promise<void>;
	/**
	 * Requests the current diff of a session. No diff identifier is sent: the
	 * OpenCode profile documents no such parameter, and the UI must not invent one.
	 */
	requestDiff(sessionId: string): Promise<void>;
	approve(sessionId: string, approvalId: string): Promise<void>;
	reject(sessionId: string, approvalId: string, reason?: string): Promise<void>;
	registerTransport(transport: IUnigmaAgentRpcTransport): IDisposable;
	/** The pinned OpenCode `/doc` does not yet authorize catalog routes. */
	getCatalog(sessionId: string): Promise<AgentCatalogResult>;
	requestModels(sessionId: string): Promise<void>;
	applyModel(sessionId: string, providerId: string, modelId: string): Promise<AgentModelSelectionResult>;
}

/*
 * `ListWorktrees` and `ApplyConfiguration` exist in the protocol but the runtime
 * bridge answers both with an explicit error, so the UI service does not expose
 * them. Surfacing an unsupported capability would be a promise the runtime
 * cannot keep.
 */

export const IUnigmaAgentRuntime = createDecorator<IUnigmaAgentRuntime>('unigmaAgentRuntime');

/** Translates decoded payloads at the UI boundary; invalid data becomes a protocol error. */
export function translateUnigmaAgentRpcEvent(value: unknown): AgentEvent {
	const validation = validateAgentEvent(value);
	if (validation.valid) {
		return validation.value;
	}

	const sessionId = typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { sessionId?: unknown }).sessionId === 'string'
		? (value as { sessionId: string }).sessionId
		: undefined;
	return sessionId === undefined ? {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Error,
		error: validation.error,
	} : {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Error,
		sessionId,
		error: validation.error,
	};
}

function serializeAgentCommand(command: AgentCommand): Record<string, unknown> {
	const envelope = {
		version: command.version,
		requestId: command.requestId,
		type: command.type,
	};

	switch (command.type) {
		case AgentCommandType.StartSession:
			return {
				...envelope,
				...(command.sessionId === undefined ? {} : { sessionId: command.sessionId }),
				...(command.workspaceUri === undefined ? {} : { workspaceUri: command.workspaceUri }),
				localIntegrationPreflight: { ...command.localIntegrationPreflight },
			};
		case AgentCommandType.StopSession:
		case AgentCommandType.ListWorktrees:
		case AgentCommandType.ListCatalog:
		case AgentCommandType.ListModels:
			return { ...envelope, sessionId: command.sessionId };
		case AgentCommandType.SendInput:
			return { ...envelope, sessionId: command.sessionId, text: command.text };
		case AgentCommandType.RequestDiff:
			return {
				...envelope,
				sessionId: command.sessionId,
				...(command.diffId === undefined ? {} : { diffId: command.diffId }),
			};
		case AgentCommandType.Approve:
			return { ...envelope, sessionId: command.sessionId, approvalId: command.approvalId };
		case AgentCommandType.Reject:
			return {
				...envelope,
				sessionId: command.sessionId,
				approvalId: command.approvalId,
				...(command.reason === undefined ? {} : { reason: command.reason }),
			};
		case AgentCommandType.ApplyConfiguration:
			return {
				...envelope,
				...(command.sessionId === undefined ? {} : { sessionId: command.sessionId }),
				configuration: { ...command.configuration },
			};
	}
}

class CommandAgentRpcTransport implements IUnigmaAgentRpcTransport {
	readonly onDidReceiveEvent: Event<unknown> = Event.None;

	constructor(private readonly commandService: ICommandService) { }

	send(command: AgentCommand): Promise<void> {
		return this.commandService.executeCommand<void>(UNIGMA_AGENT_RUNTIME_TRANSPORT_COMMAND, serializeAgentCommand(command)).then(() => undefined);
	}
}

/** Runtime da UI sem processo ou I/O; o adaptador de comandos liga-o ao extension host. */
export class UnigmaAgentRuntime extends Disposable implements IUnigmaAgentRuntime {
	declare readonly _serviceBrand: undefined;
	private readonly _onDidReceiveEvent = this._register(new Emitter<AgentEvent>());
	readonly onDidReceiveEvent = this._onDidReceiveEvent.event;
	private readonly _onDidChangeConnectionState = this._register(new Emitter<UnigmaAgentRuntimeConnectionState>());
	readonly onDidChangeConnectionState = this._onDidChangeConnectionState.event;
	private transport: IUnigmaAgentRpcTransport | undefined;
	private transportSubscription: IDisposable | undefined;
	private requestSequence = 0;
	private readonly pendingCatalog = new Map<string, (result: AgentCatalogResult) => void>();
	private readonly pendingModelSelection = new Map<string, (result: AgentModelSelectionResult) => void>();

	constructor();
	constructor(commandService: ICommandService);
	constructor(@ICommandService commandService?: ICommandService) {
		super();
		this._register(CommandsRegistry.registerCommand(UNIGMA_AGENT_RUNTIME_TRANSPORT_EVENT_COMMAND, (_accessor, event: unknown) => {
			const translated = translateUnigmaAgentRpcEvent(event);
			this.resolveCatalog(translated);
			this.resolveModelSelection(translated);
			this._onDidReceiveEvent.fire(translated);
		}));
		if (commandService) {
			this._register(this.registerTransport(new CommandAgentRpcTransport(commandService)));
		}
	}

	get connectionState(): UnigmaAgentRuntimeConnectionState {
		return this.transport ? UnigmaAgentRuntimeConnectionState.Connected : UnigmaAgentRuntimeConnectionState.Disconnected;
	}

	registerTransport(transport: IUnigmaAgentRpcTransport): IDisposable {
		if (this.transport) {
			throw new Error('An unigma agent RPC transport is already registered.');
		}

		this.transport = transport;
		this.transportSubscription = transport.onDidReceiveEvent(event => {
			const translated = translateUnigmaAgentRpcEvent(event);
			this.resolveCatalog(translated);
			this.resolveModelSelection(translated);
			this._onDidReceiveEvent.fire(translated);
		});
		this._onDidChangeConnectionState.fire(this.connectionState);
		return {
			dispose: () => {
				if (this.transport !== transport) {
					return;
				}
				this.transportSubscription?.dispose();
				this.transportSubscription = undefined;
				this.transport = undefined;
				this._onDidChangeConnectionState.fire(this.connectionState);
			},
		};
	}

	async start(preflight: AgentLocalIntegrationPreflight, workspaceUri?: string): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.StartSession,
			workspaceUri,
			localIntegrationPreflight: preflight,
		});
	}

	async getCatalog(sessionId: string): Promise<AgentCatalogResult> {
		const requestId = this.nextRequestId();
		const result = new Promise<AgentCatalogResult>(resolve => this.pendingCatalog.set(requestId, resolve));
		try {
			await this.send({ version: AGENT_PROTOCOL_VERSION, requestId, type: AgentCommandType.ListCatalog, sessionId });
			return result;
		} catch {
			this.pendingCatalog.delete(requestId);
			return { available: false, error: { code: AgentErrorCode.CapabilityUnavailable, message: 'Catalog capability is unavailable.', retryable: false } };
		}
	}

	async requestModels(sessionId: string): Promise<void> {
		await this.send({ version: AGENT_PROTOCOL_VERSION, requestId: this.nextRequestId(), type: AgentCommandType.ListModels, sessionId });
	}

	async applyModel(sessionId: string, providerId: string, modelId: string): Promise<AgentModelSelectionResult> {
		const requestId = this.nextRequestId();
		const result = new Promise<AgentModelSelectionResult>(resolve => this.pendingModelSelection.set(requestId, resolve));
		try {
			await this.send({
				version: AGENT_PROTOCOL_VERSION,
				requestId,
				type: AgentCommandType.ApplyConfiguration,
				sessionId,
				configuration: { provider: providerId, model: modelId },
			});
			return result;
		} catch {
			this.pendingModelSelection.delete(requestId);
			return { selected: false, error: { code: AgentErrorCode.CapabilityUnavailable, message: 'Model selection is unavailable.', retryable: false } };
		}
	}

	async sendInput(sessionId: string, text: string): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.SendInput,
			sessionId,
			text,
		});
	}

	async stopSession(sessionId: string): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.StopSession,
			sessionId,
		});
	}

	async requestDiff(sessionId: string): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.RequestDiff,
			sessionId,
		});
	}

	async approve(sessionId: string, approvalId: string): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.Approve,
			sessionId,
			approvalId,
		});
	}

	async reject(sessionId: string, approvalId: string, reason?: string): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.Reject,
			sessionId,
			approvalId,
			reason,
		});
	}

	private nextRequestId(): string {
		return `unigma-agent-${++this.requestSequence}`;
	}

	private resolveCatalog(event: AgentEvent): void {
		if (!event.requestId) {
			return;
		}
		if (event.type === AgentEventType.Catalog) {
			this.pendingCatalog.get(event.requestId)?.({ available: true, entries: event.entries });
			this.pendingCatalog.delete(event.requestId);
		} else if (event.type === AgentEventType.Error) {
			this.pendingCatalog.get(event.requestId)?.({ available: false, error: event.error });
			this.pendingCatalog.delete(event.requestId);
		}
	}

	private resolveModelSelection(event: AgentEvent): void {
		if (!event.requestId) {
			return;
		}
		if (event.type === AgentEventType.Configuration) {
			this.pendingModelSelection.get(event.requestId)?.({ selected: true });
			this.pendingModelSelection.delete(event.requestId);
		} else if (event.type === AgentEventType.Error) {
			this.pendingModelSelection.get(event.requestId)?.({ selected: false, error: event.error });
			this.pendingModelSelection.delete(event.requestId);
		}
	}

	private async send(command: AgentCommand): Promise<void> {
		if (!this.transport) {
			this.fireError(command, {
				code: AgentErrorCode.RuntimeUnavailable,
				message: 'No unigma agent RPC transport is registered.',
				retryable: true,
			});
			throw new Error('No unigma agent RPC transport is registered.');
		}

		try {
			await this.transport.send(command);
		} catch {
			this.fireError(command, {
				code: AgentErrorCode.ConnectionLost,
				message: 'The unigma agent RPC transport disconnected.',
				retryable: true,
			});
			throw new Error('The unigma agent RPC transport disconnected.');
		}
	}

	private fireError(command: AgentCommand, error: { readonly code: AgentErrorCode; readonly message: string; readonly retryable: boolean }): void {
		const event: AgentErrorEvent = {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Error,
			requestId: command.requestId,
			error,
		};
		const sessionId = command.sessionId;
		const scopedEvent = sessionId === undefined ? event : { ...event, sessionId };
		this.resolveCatalog(scopedEvent);
		this.resolveModelSelection(scopedEvent);
		this._onDidReceiveEvent.fire(scopedEvent);
	}

	override dispose(): void {
		this.transportSubscription?.dispose();
		this.transportSubscription = undefined;
		this.transport = undefined;
		super.dispose();
	}
}
