/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	AGENT_PROTOCOL_VERSION,
	AgentApprovalKind,
	AgentCommand,
	AgentCommandType,
	AgentErrorCode,
	AgentEvent,
	AgentEventType,
	AgentResultStatus,
	AgentSessionState,
	isAgentCommand,
	isAgentEvent,
	validateAgentCommand,
	validateAgentEvent,
} from '../../common/agentProtocol.js';

suite('AgentProtocol', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('accepts every command shape', () => {
		const commands: readonly AgentCommand[] = [
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'start-1', type: AgentCommandType.StartSession, workspaceUri: 'file:///workspace', localIntegrationPreflight: { accepted: true } },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'stop-1', type: AgentCommandType.StopSession, sessionId: 'session-1' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'input-1', type: AgentCommandType.SendInput, sessionId: 'session-1', text: 'Explain this change.' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'diff-1', type: AgentCommandType.RequestDiff, sessionId: 'session-1' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'approve-1', type: AgentCommandType.Approve, sessionId: 'session-1', approvalId: 'approval-1' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'reject-1', type: AgentCommandType.Reject, sessionId: 'session-1', approvalId: 'approval-1', reason: 'Not now.' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'worktrees-1', type: AgentCommandType.ListWorktrees, sessionId: 'session-1' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'config-1', type: AgentCommandType.ApplyConfiguration, sessionId: 'session-1', configuration: { provider: 'local', model: 'default' } },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'integrations-1', type: AgentCommandType.ListLocalIntegrations, workspaceUri: 'file:///workspace' },
		];

		for (const command of commands) {
			assert.strictEqual(isAgentCommand(command), true);
			assert.strictEqual(validateAgentCommand(command).valid, true);
		}
	});

	test('accepts every event shape', () => {
		const events: readonly AgentEvent[] = [
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.State, sessionId: 'session-1', state: AgentSessionState.Running },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Content, sessionId: 'session-1', role: 'assistant', content: 'Done.', delta: false },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Diff, sessionId: 'session-1', diff: { diffId: 'diff-1', files: [{ path: 'src/file.ts', original: 'old', modified: 'new' }] } },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Permission, sessionId: 'session-1', permission: { approvalId: 'approval-1', kind: AgentApprovalKind.Edit, title: 'Apply change' } },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Worktrees, sessionId: 'session-1', worktrees: [{ id: 'main', label: 'Main', branch: 'main', isCurrent: true }] },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Result, sessionId: 'session-1', result: { status: AgentResultStatus.Completed, content: 'Completed.' } },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Error, error: { code: AgentErrorCode.SessionNotFound, message: 'Session was not found.', retryable: false } },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.LocalIntegrations, requestId: 'integrations-1', inventory: { complete: true, sources: [] } },
		];

		for (const event of events) {
			assert.strictEqual(isAgentEvent(event), true);
			assert.strictEqual(validateAgentEvent(event).valid, true);
		}
	});

	test('rejects invalid command payloads before application', () => {
		const invalid = validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION,
			requestId: '',
			type: AgentCommandType.SendInput,
			sessionId: 'session-1',
			text: 'hello',
		});

		assert.strictEqual(invalid.valid, false);
		if (!invalid.valid) {
			assert.strictEqual(invalid.error.code, AgentErrorCode.InvalidPayload);
		}
	});

	test('reports incompatible versions and malformed events explicitly', () => {
		const versionError = validateAgentCommand({
			// Derived, never a literal: this assertion is about "a version this
			// build does not support", and writing that as `2` made the test
			// fail the moment the protocol reached 2 -- the literal had quietly
			// become the current version.
			version: AGENT_PROTOCOL_VERSION + 1,
			requestId: 'request-1',
			type: AgentCommandType.StartSession,
		});
		assert.strictEqual(versionError.valid, false);
		if (!versionError.valid) {
			assert.strictEqual(versionError.error.code, AgentErrorCode.UnsupportedVersion);
		}

		assert.strictEqual(isAgentEvent({
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Diff,
			sessionId: 'session-1',
			diff: { diffId: 'diff-1', files: [{ path: 'src/file.ts', original: 'old' }] },
		}), false);
	});

	test('requires a sanitized local integration preflight', () => {
		const accepted = validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION,
			requestId: 'start-accepted',
			type: AgentCommandType.StartSession,
			localIntegrationPreflight: { accepted: true },
		});
		const refused = validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION,
			requestId: 'start-refused',
			type: AgentCommandType.StartSession,
			localIntegrationPreflight: { accepted: false, code: 'permissionDenied' },
		});
		const missing = validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION,
			requestId: 'start-missing',
			type: AgentCommandType.StartSession,
		});
		const malformed = validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION,
			requestId: 'start-malformed',
			type: AgentCommandType.StartSession,
			localIntegrationPreflight: { accepted: false, code: 'raw-config' },
		});

		assert.strictEqual(accepted.valid, true);
		assert.strictEqual(refused.valid, true);
		assert.strictEqual(missing.valid, false);
		assert.strictEqual(malformed.valid, false);
	});

	test('rejects fields outside the private contract', () => {
		const commandError = validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION,
			requestId: 'request-1',
			type: AgentCommandType.StartSession,
			endpoint: 'http://127.0.0.1:4096',
		});
		assert.strictEqual(commandError.valid, false);

		const eventError = validateAgentEvent({
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.State,
			sessionId: 'session-1',
			state: AgentSessionState.Running,
			token: 'must-not-cross-the-boundary',
		});
		assert.strictEqual(eventError.valid, false);
	});

	test('accepts only documented permission replies', () => {
		for (const reply of ['once', 'always', 'reject'] as const) {
			const resolved: AgentEvent = {
				version: AGENT_PROTOCOL_VERSION,
				type: AgentEventType.PermissionResolved,
				sessionId: 'session-1',
				resolution: { approvalId: 'approval-1', reply },
			};
			assert.strictEqual(validateAgentEvent(resolved).valid, true);
			assert.strictEqual(isAgentEvent(resolved), true);
		}

		// An undocumented reply, a missing approval, or an extra field must fail closed.
		for (const resolution of [
			{ approvalId: 'approval-1', reply: 'maybe' },
			{ approvalId: '', reply: 'once' },
			{ reply: 'once' },
			{ approvalId: 'approval-1', reply: 'once', reason: 'extra' },
		]) {
			assert.strictEqual(validateAgentEvent({
				version: AGENT_PROTOCOL_VERSION,
				type: AgentEventType.PermissionResolved,
				sessionId: 'session-1',
				resolution,
			}).valid, false);
		}

		assert.strictEqual(validateAgentEvent({
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.PermissionResolved,
			resolution: { approvalId: 'approval-1', reply: 'once' },
		}).valid, false, 'a resolution without a session must be rejected');
	});

	test('accepts stateful errors emitted by the application layer', () => {
		for (const code of [AgentErrorCode.DuplicateRequestId, AgentErrorCode.SessionNotFound]) {
			const errorEvent: AgentEvent = {
				version: AGENT_PROTOCOL_VERSION,
				type: AgentEventType.Error,
				requestId: `error-${code}`,
				sessionId: 'session-1',
				error: { code, message: 'Application state rejected the request.', retryable: false },
			};

			assert.strictEqual(validateAgentEvent(errorEvent).valid, true);
		}
	});

	test('accepts the three read-only projections of D-040', () => {
		const events: AgentEvent[] = [
			{
				version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Todo, sessionId: 'session-1',
				todos: [
					{ content: 'read', status: 'pending', knownStatus: 'pending', priority: 'high', knownPriority: 'high' },
					// A status the contract does not name still travels: it is a
					// free string in the artefact, and the absent knownStatus is
					// how the UI is told to print it rather than default it.
					{ content: 'wait', status: 'blocked', priority: 'urgent' },
				],
			},
			{
				version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Question, sessionId: 'session-1',
				questions: [{ requestId: 'que_1', index: 0, question: 'Which branch?', header: 'Branch', options: [{ label: 'main', description: 'the default' }], multiple: false, custom: false }],
			},
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.QuestionResolved, sessionId: 'session-1', questionRequestId: 'que_1', resolution: 'replied' },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.ChildSessions, sessionId: 'session-1', children: [{ sessionId: 'ses_child', parentId: 'session-1', title: 'reading' }] },
		];
		for (const event of events) {
			assert.strictEqual(validateAgentEvent(event).valid, true, event.type);
		}
	});

	test('refuses a todo whose known value disagrees with the raw one', () => {
		// The pair is a claim about the same field. If they can drift, the UI
		// can colour an item one way while printing another, and the mismatch
		// would be invisible on both sides.
		assert.strictEqual(validateAgentEvent({
			version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Todo, sessionId: 'session-1',
			todos: [{ content: 'c', status: 'blocked', knownStatus: 'pending', priority: 'low' }],
		}).valid, false);
	});

	test('refuses a projection that arrives without a session', () => {
		for (const event of [
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Todo, todos: [] },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Question, questions: [] },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.ChildSessions, children: [] },
		]) {
			assert.strictEqual(validateAgentEvent(event).valid, false, String(event.type));
		}
	});

	test('a question carries no field a standing permission could travel in', () => {
		// Question and permission are separate surfaces in the artefact and
		// separate commands here. An extra key is refused rather than ignored,
		// so `always` cannot ride along on a question and be read later as if
		// it had been granted.
		assert.strictEqual(validateAgentEvent({
			version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Question, sessionId: 'session-1',
			questions: [{ requestId: 'que_1', index: 0, question: 'q', header: 'h', options: [], multiple: false, custom: false, always: true }],
		}).valid, false);
	});

	test('accepts answering and rejecting a question, and refuses an empty answer', () => {
		assert.strictEqual(validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION, requestId: 'answer-1', type: AgentCommandType.AnswerQuestion,
			sessionId: 'session-1', questionRequestId: 'que_1', answers: [['main']],
		}).valid, true);
		assert.strictEqual(validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION, requestId: 'reject-1', type: AgentCommandType.RejectQuestion,
			sessionId: 'session-1', questionRequestId: 'que_1',
		}).valid, true);
		// `answers` is one array per question; none at all is not an answer.
		for (const answers of [[], 'main', ['main'], [[1]]]) {
			assert.strictEqual(validateAgentCommand({
				version: AGENT_PROTOCOL_VERSION, requestId: 'answer-2', type: AgentCommandType.AnswerQuestion,
				sessionId: 'session-1', questionRequestId: 'que_1', answers,
			}).valid, false, JSON.stringify(answers));
		}
	});

	test('an answer command cannot carry a permission reply', () => {
		assert.strictEqual(validateAgentCommand({
			version: AGENT_PROTOCOL_VERSION, requestId: 'answer-3', type: AgentCommandType.AnswerQuestion,
			sessionId: 'session-1', questionRequestId: 'que_1', answers: [['main']], response: 'always',
		}).valid, false);
	});
});
