/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike, WorkspaceReference } from '../domain/runtime';
import type { OpenCodeEvent } from './runtimePorts';

export interface VersionedRpcMessage {
	readonly version: number;
}

export type RpcCommandHandler<Command> = (command: Command) => void | Promise<void>;

/** Future private workbench-to-runtime RPC point; transport is supplied by the host. */
export interface AgentRuntimeRpc<Command extends VersionedRpcMessage, Event extends VersionedRpcMessage> extends DisposableLike {
	onCommand(handler: RpcCommandHandler<Command>): DisposableLike;
	emitEvent(event: Event): void;
}

/** Private, transient command for the local OpenCode session use case. */
export interface RuntimePromptCommand extends VersionedRpcMessage {
	readonly type: 'session.prompt';
	readonly workspace: WorkspaceReference;
	readonly prompt: { readonly parts: readonly unknown[] };
	readonly requestId: string;
	/** Optional only while creating a session; supplied IDs must belong to this workspace. */
	readonly sessionId?: string;
}

export interface RuntimeRpcError {
	readonly code: 'duplicateRequestId' | 'sessionNotFound' | 'workspaceUntrusted' | 'internal';
	readonly message: string;
	readonly retryable: boolean;
}

export type RuntimeRpcEvent =
	| { readonly version: 1; readonly type: 'session.ready'; readonly sessionId: string; readonly requestId?: string }
	| { readonly version: 1; readonly type: 'session.event'; readonly event: OpenCodeEvent }
	| { readonly version: 1; readonly type: 'session.error'; readonly requestId: string; readonly error: RuntimeRpcError };
