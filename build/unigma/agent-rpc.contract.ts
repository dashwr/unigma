/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Run with Node's built-in TypeScript transform:
 * node --experimental-transform-types --test build/unigma/agent-rpc.contract.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	AGENT_PROTOCOL_VERSION,
	AgentApprovalKind,
	AgentCommandType,
	AgentErrorCode,
	AgentEventType,
	AgentResultStatus,
	AgentSessionState,
	validateAgentCommand,
	validateAgentEvent,
} from '../../src/vs/workbench/contrib/unigmaAgent/common/agentProtocol.ts';
import {
	TRANSPORT_PROTOCOL_VERSION,
	TransportErrorCode,
	validateTransportCommand,
	validateTransportEvent,
} from '../../extensions/unigma-agent-runtime/src/application/transport.ts';

const workspaceUri = 'file:///workspace';

function serialize(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}

const commonCommands = [
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'start-accepted', type: AgentCommandType.StartSession, workspaceUri, localIntegrationPreflight: { accepted: true } },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'start-refused', type: AgentCommandType.StartSession, workspaceUri, localIntegrationPreflight: { accepted: false, code: 'permissionDenied' } },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'stop', type: AgentCommandType.StopSession, sessionId: 'session-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'cancel', type: AgentCommandType.CancelRun, sessionId: 'session-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'input', type: AgentCommandType.SendInput, sessionId: 'session-1', text: 'Explain this change.' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'input-file', type: AgentCommandType.SendInput, sessionId: 'session-1', text: 'Review it.', context: [{ uri: `${workspaceUri}/src/file.ts` }] },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'input-selection', type: AgentCommandType.SendInput, sessionId: 'session-1', text: 'Review it.', context: [{ uri: `${workspaceUri}/src/file.ts`, startLine: 3, endLine: 9 }] },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'diff', type: AgentCommandType.RequestDiff, sessionId: 'session-1', diffId: 'diff-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'approve', type: AgentCommandType.Approve, sessionId: 'session-1', approvalId: 'approval-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'reject', type: AgentCommandType.Reject, sessionId: 'session-1', approvalId: 'approval-1', reason: 'Not now.' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'worktrees', type: AgentCommandType.ListWorktrees, sessionId: 'session-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'configure', type: AgentCommandType.ApplyConfiguration, sessionId: 'session-1', configuration: { provider: 'local', model: 'default' } },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'catalog', type: AgentCommandType.ListCatalog, sessionId: 'session-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'models', type: AgentCommandType.ListModels, sessionId: 'session-1' },
	{ version: AGENT_PROTOCOL_VERSION, requestId: 'integrations', type: AgentCommandType.ListLocalIntegrations, workspaceUri },
] as const;

const commonEvents = [
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.State, sessionId: 'session-1', state: AgentSessionState.Running },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.State, sessionId: 'session-1', state: AgentSessionState.Idle },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Result, sessionId: 'session-1', result: { status: AgentResultStatus.Cancelled } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Content, sessionId: 'session-1', role: 'assistant', content: 'Done.', delta: false },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Diff, sessionId: 'session-1', diff: { diffId: 'diff-1', files: [{ path: 'src/file.ts', patch: '@@ -1 +1 @@\n-old\n+new' }] } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Permission, sessionId: 'session-1', permission: { approvalId: 'approval-1', kind: AgentApprovalKind.Edit, title: 'Apply change' } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.PermissionResolved, sessionId: 'session-1', resolution: { approvalId: 'approval-1', reply: 'once' } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Worktrees, sessionId: 'session-1', worktrees: [{ id: 'main', label: 'Main', branch: 'main', isCurrent: true }] },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Result, sessionId: 'session-1', result: { status: AgentResultStatus.Completed, content: 'Completed.' } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Catalog, sessionId: 'session-1', entries: [{ id: 'review', name: 'Review', description: 'Review the change.', kind: 'command' }] },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Models, sessionId: 'session-1', entries: [{ providerId: 'local', modelId: 'default', label: 'Default', providerLabel: 'Local' }] },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Configuration, sessionId: 'session-1', selection: { providerId: 'local', modelId: 'default' } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.LocalIntegrations, requestId: 'integrations', inventory: { complete: true, sources: [{ kind: 'plugin', name: 'review', origin: 'workspacePluginDirectory', path: 'insideWorkspace', schema: 'valid', command: 'none', dependency: 'none', url: 'notApplicable', oauth: 'notApplicable', approved: true }] } },
	{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Error, requestId: 'failed', sessionId: 'session-1', error: { code: AgentErrorCode.RuntimeUnavailable, message: 'Runtime unavailable.', retryable: true } },
] as const;

test('keeps the workbench and runtime on protocol version 2', () => {
	assert.equal(AGENT_PROTOCOL_VERSION, 2);
	assert.equal(TRANSPORT_PROTOCOL_VERSION, AGENT_PROTOCOL_VERSION);
});

test('accepts every common command after JSON serialization on both sides', () => {
	for (const command of commonCommands) {
		const wire = serialize(command);
		const workbench = validateAgentCommand(wire);
		assert.equal(workbench.valid, true, `${command.type} must be valid in the workbench`);

		const runtime = validateTransportCommand(wire);
		assert.equal(runtime.valid, true, `${command.type} must be valid in the runtime`);
	}
});

test('accepts every existing event after JSON serialization on both sides', () => {
	for (const event of commonEvents) {
		const wire = serialize(event);
		const workbench = validateAgentEvent(wire);
		assert.equal(workbench.valid, true, `${event.type} must be valid in the workbench`);

		const runtime = validateTransportEvent(wire);
		assert.equal(runtime.valid, true, `${event.type} must be valid in the runtime`);
	}
});

test('rejects malformed attached context on both sides', () => {
	const invalid = [
		[{ uri: '' }],
		[{ uri: `${workspaceUri}/src/file.ts`, startLine: 0 }],
		[{ uri: `${workspaceUri}/src/file.ts`, startLine: 2, endLine: 1 }],
		[{ uri: `${workspaceUri}/src/file.ts`, endLine: 4 }],
		[{ uri: `${workspaceUri}/src/file.ts`, startLine: 1.5 }],
		[{ uri: `${workspaceUri}/src/file.ts`, line: 1 }],
		'file.ts',
	];

	for (const context of invalid) {
		const wire = serialize({ version: AGENT_PROTOCOL_VERSION, requestId: 'input-invalid', type: AgentCommandType.SendInput, sessionId: 'session-1', text: 'Review it.', context });
		assert.equal(validateAgentCommand(wire).valid, false, `${JSON.stringify(context)} must be refused by the workbench`);
		assert.equal(validateTransportCommand(wire).valid, false, `${JSON.stringify(context)} must be refused by the runtime`);
	}
});

test('rejects protocol version 1 in both validators', () => {
	const command = { ...commonCommands[0], version: 1 };
	const commandWorkbench = validateAgentCommand(serialize(command));
	assert.equal(commandWorkbench.valid, false);
	if (!commandWorkbench.valid) {
		assert.equal(commandWorkbench.error.code, AgentErrorCode.UnsupportedVersion);
	}
	const commandRuntime = validateTransportCommand(serialize(command));
	assert.equal(commandRuntime.valid, false);
	if (!commandRuntime.valid) {
		assert.equal(commandRuntime.error.code, TransportErrorCode.UnsupportedVersion);
	}

	const event = { ...commonEvents[0], version: 1 };
	const eventWorkbench = validateAgentEvent(serialize(event));
	assert.equal(eventWorkbench.valid, false);
	if (!eventWorkbench.valid) {
		assert.equal(eventWorkbench.error.code, AgentErrorCode.UnsupportedVersion);
	}
	const eventRuntime = validateTransportEvent(serialize(event));
	assert.equal(eventRuntime.valid, false);
	if (!eventRuntime.valid) {
		assert.equal(eventRuntime.error.code, TransportErrorCode.UnsupportedVersion);
	}
});

test('accepts question commands in the workbench but rejects them as unavailable in the runtime', () => {
	const commands = [
		{ version: AGENT_PROTOCOL_VERSION, requestId: 'answer', type: AgentCommandType.AnswerQuestion, sessionId: 'session-1', questionRequestId: 'question-1', answers: [['main']] },
		{ version: AGENT_PROTOCOL_VERSION, requestId: 'reject-question', type: AgentCommandType.RejectQuestion, sessionId: 'session-1', questionRequestId: 'question-1' },
	] as const;

	for (const command of commands) {
		const wire = serialize(command);
		const workbench = validateAgentCommand(wire);
		assert.equal(workbench.valid, true, `${command.type} must remain a workbench command`);

		const runtime = validateTransportCommand(wire);
		assert.equal(runtime.valid, false, `${command.type} must be unavailable in the runtime`);
		if (!runtime.valid) {
			assert.equal(runtime.error.code, TransportErrorCode.CapabilityUnavailable);
		}
	}
});

test('does not add todo, question, or child-session projections to runtime events', () => {
	const projections = [
		{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Todo, sessionId: 'session-1', todos: [{ content: 'read', status: 'pending', priority: 'high' }] },
		{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Question, sessionId: 'session-1', questions: [{ requestId: 'question-1', index: 0, question: 'Which branch?', header: 'Branch', options: [{ label: 'main', description: 'The default branch.' }], multiple: false, custom: false }] },
		{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.QuestionResolved, sessionId: 'session-1', questionRequestId: 'question-1', resolution: 'rejected' },
		{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.ChildSessions, sessionId: 'session-1', children: [{ sessionId: 'child-1', parentId: 'session-1', title: 'Reading' }] },
	] as const;

	for (const event of projections) {
		const wire = serialize(event);
		const workbench = validateAgentEvent(wire);
		assert.equal(workbench.valid, true, `${event.type} must remain a workbench event`);

		const runtime = validateTransportEvent(wire);
		assert.equal(runtime.valid, false, `${event.type} must not be implemented by the runtime`);
		if (!runtime.valid) {
			assert.equal(runtime.error.code, TransportErrorCode.InvalidPayload);
		}
	}
});
