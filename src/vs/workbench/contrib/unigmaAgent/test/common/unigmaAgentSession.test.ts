/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { AGENT_PROTOCOL_VERSION, AgentApprovalKind, AgentErrorCode, AgentEventType, AgentResultStatus, AgentSessionState } from '../../common/agentProtocol.js';
import {
	EMPTY_UNIGMA_AGENT_SESSION,
	getUnigmaAgentStateAccessibility,
	reduceUnigmaAgentSessionEvent,
	startUnigmaAgentSession,
	UNIGMA_AGENT_VIEW_STATES,
} from '../../common/unigmaAgentSession.js';

test('exposes coherent live-region semantics for agent states', () => {
	assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Empty), {});
	assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Loading), { role: 'status', live: 'polite', busy: true });
	assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Running), { role: 'status', live: 'polite', busy: true });
	assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Error), { role: 'alert', live: 'assertive', busy: false });
	assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Result), { role: 'status', live: 'polite', busy: false });
});

test('reduces RPC session events without retaining another session', () => {
	const loading = startUnigmaAgentSession();
	const earlyResult = reduceUnigmaAgentSessionEvent(loading, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Result,
		sessionId: 'session-1',
		result: { status: AgentResultStatus.Completed, content: 'Old result.' },
	});
	const starting = reduceUnigmaAgentSessionEvent(loading, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.State,
		sessionId: 'session-1',
		state: AgentSessionState.Starting,
	});
	const result = reduceUnigmaAgentSessionEvent(starting, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Result,
		sessionId: 'session-1',
		result: { status: AgentResultStatus.Completed, content: 'Completed.' },
	});
	const ignored = reduceUnigmaAgentSessionEvent(result, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Error,
		sessionId: 'session-2',
		error: { code: AgentErrorCode.ConnectionLost, message: 'Lost.', retryable: true },
	});
	const stopped = reduceUnigmaAgentSessionEvent(result, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.State,
		sessionId: 'session-1',
		state: AgentSessionState.Stopped,
	});
	const lateResult = reduceUnigmaAgentSessionEvent(stopped, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Result,
		sessionId: 'session-1',
		result: { status: AgentResultStatus.Completed, content: 'Late result.' },
	});
	const lateError = reduceUnigmaAgentSessionEvent(loading, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Error,
		sessionId: 'session-1',
		error: { code: AgentErrorCode.ConnectionLost, message: 'Late error.', retryable: true },
	});

	assert.deepStrictEqual(EMPTY_UNIGMA_AGENT_SESSION, { state: UNIGMA_AGENT_VIEW_STATES.Empty });
	assert.strictEqual(earlyResult, loading);
	assert.deepStrictEqual(result, { state: UNIGMA_AGENT_VIEW_STATES.Result, sessionId: 'session-1', result: 'Completed.' });
	assert.strictEqual(ignored, result);
	assert.strictEqual(stopped, EMPTY_UNIGMA_AGENT_SESSION);
	assert.strictEqual(lateResult, stopped);
	assert.strictEqual(lateError, loading);
});

test('keeps a run visible while it streams and returns to input after cancellation', () => {
	const started = reduceUnigmaAgentSessionEvent(startUnigmaAgentSession(), {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.State,
		sessionId: 'session-1',
		state: AgentSessionState.Starting,
	});
	const running = reduceUnigmaAgentSessionEvent(started, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.State,
		sessionId: 'session-1',
		state: AgentSessionState.Running,
	});
	const firstDelta = reduceUnigmaAgentSessionEvent(running, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Content,
		sessionId: 'session-1',
		role: 'assistant',
		content: 'Hel',
		delta: true,
	});
	const secondDelta = reduceUnigmaAgentSessionEvent(firstDelta, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Content,
		sessionId: 'session-1',
		role: 'assistant',
		content: 'lo',
		delta: true,
	});
	const idle = reduceUnigmaAgentSessionEvent(secondDelta, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.State,
		sessionId: 'session-1',
		state: AgentSessionState.Idle,
	});

	// Streaming keeps the run state, so the cancel affordance stays reachable.
	assert.strictEqual(running.state, UNIGMA_AGENT_VIEW_STATES.Running);
	assert.strictEqual(secondDelta.state, UNIGMA_AGENT_VIEW_STATES.Running);
	assert.strictEqual(secondDelta.content, 'Hello');
	assert.strictEqual(getUnigmaAgentStateAccessibility(running.state).busy, true);

	// Going idle returns the panel to the input without discarding the transcript.
	assert.strictEqual(idle.state, UNIGMA_AGENT_VIEW_STATES.Empty);
	assert.strictEqual(idle.sessionId, 'session-1');
	assert.strictEqual(idle.content, 'Hello');
});

test('retires an approval only after the runtime reports the real reply', () => {
	const permission = { approvalId: 'per-1', kind: AgentApprovalKind.Tool, title: 'bash' };
	const started = reduceUnigmaAgentSessionEvent(startUnigmaAgentSession(), {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.State,
		sessionId: 'session-1',
		state: AgentSessionState.Starting,
	});
	const asked = reduceUnigmaAgentSessionEvent(started, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.Permission,
		sessionId: 'session-1',
		permission,
	});
	assert.deepStrictEqual(asked.permission, permission);

	// A reply for another approval or another session leaves the request pending.
	const otherApproval = reduceUnigmaAgentSessionEvent(asked, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.PermissionResolved,
		sessionId: 'session-1',
		resolution: { approvalId: 'per-2', reply: 'once' },
	});
	const otherSession = reduceUnigmaAgentSessionEvent(asked, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.PermissionResolved,
		sessionId: 'session-2',
		resolution: { approvalId: 'per-1', reply: 'once' },
	});
	assert.strictEqual(otherApproval, asked);
	assert.strictEqual(otherSession, asked);

	const replied = reduceUnigmaAgentSessionEvent(asked, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.PermissionResolved,
		sessionId: 'session-1',
		resolution: { approvalId: 'per-1', reply: 'reject' },
	});
	assert.strictEqual(Object.hasOwn(replied, 'permission'), false, 'the pending approval must be removed, not blanked');
	assert.strictEqual(replied.sessionId, 'session-1');
	assert.strictEqual(replied.state, asked.state);

	// A repeated reply is idempotent and never resurrects the approval.
	assert.strictEqual(reduceUnigmaAgentSessionEvent(replied, {
		version: AGENT_PROTOCOL_VERSION,
		type: AgentEventType.PermissionResolved,
		sessionId: 'session-1',
		resolution: { approvalId: 'per-1', reply: 'reject' },
	}), replied);
});
