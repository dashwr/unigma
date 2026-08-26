/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	AGENT_PROTOCOL_VERSION,
	AgentCommand,
	AgentCommandType,
	AgentErrorCode,
	AgentEvent,
	AgentEventType,
	validateAgentEvent,
} from '../common/agentProtocol.js';

export const enum UnigmaAgentRuntimeConnectionState {
	Disconnected = 'disconnected',
	Connected = 'connected',
}

/** Injectable boundary for a future process, extension-host, or remote RPC adapter. */
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

	start(): Promise<void>;
	sendInput(sessionId: string, text: string): Promise<void>;
	registerTransport(transport: IUnigmaAgentRpcTransport): IDisposable;
}

export const IUnigmaAgentRuntime = createDecorator<IUnigmaAgentRuntime>('unigmaAgentRuntime');

/**
 * Translates decoded transport payloads at the UI boundary. Invalid payloads remain visible as
 * protocol errors rather than entering the view model as untyped data.
 */
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

/**
 * A transport-free runtime by default. An integration registers the transport explicitly; this
 * service never starts it or performs I/O itself.
 */
export class UnigmaAgentRuntime extends Disposable implements IUnigmaAgentRuntime {
	declare readonly _serviceBrand: undefined;
	private readonly _onDidReceiveEvent = this._register(new Emitter<AgentEvent>());
	readonly onDidReceiveEvent = this._onDidReceiveEvent.event;
	private readonly _onDidChangeConnectionState = this._register(new Emitter<UnigmaAgentRuntimeConnectionState>());
	readonly onDidChangeConnectionState = this._onDidChangeConnectionState.event;
	private transport: IUnigmaAgentRpcTransport | undefined;
	private transportSubscription: IDisposable | undefined;
	private requestSequence = 0;

	get connectionState(): UnigmaAgentRuntimeConnectionState {
		return this.transport ? UnigmaAgentRuntimeConnectionState.Connected : UnigmaAgentRuntimeConnectionState.Disconnected;
	}

	registerTransport(transport: IUnigmaAgentRpcTransport): IDisposable {
		if (this.transport) {
			throw new Error('An unigma agent RPC transport is already registered.');
		}

		this.transport = transport;
		this.transportSubscription = transport.onDidReceiveEvent(event => this._onDidReceiveEvent.fire(translateUnigmaAgentRpcEvent(event)));
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

	async start(): Promise<void> {
		await this.send({
			version: AGENT_PROTOCOL_VERSION,
			requestId: this.nextRequestId(),
			type: AgentCommandType.StartSession,
		});
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

	private nextRequestId(): string {
		return `unigma-agent-${++this.requestSequence}`;
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
		const event = {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Error,
			requestId: command.requestId,
			error,
		};
		const sessionId = 'sessionId' in command ? command.sessionId : undefined;
		this._onDidReceiveEvent.fire(sessionId === undefined ? event : { ...event, sessionId });
	}

	override dispose(): void {
		this.transportSubscription?.dispose();
		this.transportSubscription = undefined;
		this.transport = undefined;
		super.dispose();
	}
}
