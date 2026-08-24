/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike } from '../domain/runtime';

export interface VersionedRpcMessage {
	readonly version: number;
}

export type RpcCommandHandler<Command> = (command: Command) => void | Promise<void>;

/** Future private workbench-to-runtime RPC point; transport is supplied by the host. */
export interface AgentRuntimeRpc<Command extends VersionedRpcMessage, Event extends VersionedRpcMessage> extends DisposableLike {
	onCommand(handler: RpcCommandHandler<Command>): DisposableLike;
	emitEvent(event: Event): void;
}
