/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AgentEvent, AgentEventType, AgentSessionState, type AgentDiff, type AgentModelEntry, type AgentPermissionRequest } from '../common/agentProtocol.js';

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
	/** Ephemeral transcript; OpenCode remains the source of truth. */
	readonly content?: string;
	readonly result?: string;
	readonly diff?: AgentDiff;
	readonly permission?: AgentPermissionRequest;
	readonly errorMessage?: string;
	readonly models?: readonly AgentModelEntry[];
	readonly activeModel?: { readonly providerId: string; readonly modelId: string };
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
			: { state: UNIGMA_AGENT_VIEW_STATES.Error, sessionId: event.sessionId ?? model.sessionId, errorMessage: event.error.message };
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
			return { ...model, state: UNIGMA_AGENT_VIEW_STATES.Empty, sessionId: event.sessionId };
		case AgentEventType.Content:
			return {
				...model,
				state: UNIGMA_AGENT_VIEW_STATES.Empty,
				sessionId: event.sessionId,
				content: event.delta ? `${model.content ?? ''}${event.content}` : event.content,
			};
		case AgentEventType.Diff:
			return { ...model, sessionId: event.sessionId, diff: event.diff };
		case AgentEventType.Permission:
			return { ...model, sessionId: event.sessionId, permission: event.permission };
		case AgentEventType.PermissionResolved: {
			/*
			 * The approval is retired only when the runtime reports the real reply for
			 * that same request; a local click never clears it.
			 */
			if (model.permission?.approvalId !== event.resolution.approvalId) {
				return model;
			}
			const { permission, ...withoutPermission } = model;
			return { ...withoutPermission, sessionId: event.sessionId };
		}
		case AgentEventType.Result:
			return {
				...model,
				state: UNIGMA_AGENT_VIEW_STATES.Result,
				sessionId: event.sessionId,
				result: event.result.content,
			};
		case AgentEventType.Models:
			return { ...model, sessionId: event.sessionId, models: event.entries };
		case AgentEventType.Configuration:
			return { ...model, sessionId: event.sessionId, activeModel: event.selection };
		default:
			return model;
	}
}
