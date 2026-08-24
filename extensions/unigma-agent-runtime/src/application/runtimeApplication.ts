/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike, RuntimeDemand, RuntimeState } from '../domain/runtime';

export const RUNTIME_DEMAND_COMMAND = 'unigma.agent.runtime.activate';

/**
 * T-020 records demand without constructing any process, transport, or storage adapter.
 */
export class AgentRuntimeApplication implements DisposableLike {
	private _state: RuntimeState = 'idle';
	private _lastDemand: RuntimeDemand | undefined;

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

	public dispose(): void {
		this._state = 'disposed';
		this._lastDemand = undefined;
	}
}
