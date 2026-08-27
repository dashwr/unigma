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
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'config-1', type: AgentCommandType.ApplyConfiguration, configuration: { provider: 'local', model: 'default' } },
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
			version: 2,
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
});
