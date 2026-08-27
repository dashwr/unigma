/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AgentEvent, AgentEventType, AgentSessionState } from '../common/agentProtocol.js';

export const UNIGMA_AGENT_VIEW_STATES = {
	Empty: 'empty',
	Loading: 'loading',
	Error: 'error',
	Result: 'result',
} as const;

export type UnigmaAgentViewState = typeof UNIGMA_AGENT_VIEW_STATES[keyof typeof UNIGMA_AGENT_VIEW_STATES];

export interface UnigmaAgentSessionViewModel {
	readonly state: UnigmaAgentViewState;
	readonly sessionId?: string;
	readonly result?: string;
}

export const EMPTY_UNIGMA_AGENT_SESSION: UnigmaAgentSessionViewModel = Object.freeze({ state: UNIGMA_AGENT_VIEW_STATES.Empty });

export function startUnigmaAgentSession(): UnigmaAgentSessionViewModel {
	return { state: UNIGMA_AGENT_VIEW_STATES.Loading };
}

/** Reduces only events for the active session, keeping the UI independent from the RPC transport. */
export function reduceUnigmaAgentSessionEvent(model: UnigmaAgentSessionViewModel, event: AgentEvent): UnigmaAgentSessionViewModel {
	if (event.type === AgentEventType.Error) {
		return event.sessionId && (!model.sessionId || event.sessionId !== model.sessionId)
			? model
			: { state: UNIGMA_AGENT_VIEW_STATES.Error, sessionId: event.sessionId ?? model.sessionId };
	}

	if (!model.sessionId && event.type !== AgentEventType.State) {
		return model;
	}

	if (model.sessionId && event.sessionId !== model.sessionId) {
		return model;
	}

	switch (event.type) {
		case AgentEventType.State:
			if (event.state === AgentSessionState.Starting) {
				return { state: UNIGMA_AGENT_VIEW_STATES.Loading, sessionId: event.sessionId };
			}
			if (event.state === AgentSessionState.Stopped || event.state === AgentSessionState.Error) {
				return event.state === AgentSessionState.Error
					? { state: UNIGMA_AGENT_VIEW_STATES.Error, sessionId: event.sessionId }
					: EMPTY_UNIGMA_AGENT_SESSION;
			}
			return { state: UNIGMA_AGENT_VIEW_STATES.Empty, sessionId: event.sessionId };
		case AgentEventType.Result:
			return {
				state: UNIGMA_AGENT_VIEW_STATES.Result,
				sessionId: event.sessionId,
				result: event.result.content,
			};
		default:
			return model;
	}
}
