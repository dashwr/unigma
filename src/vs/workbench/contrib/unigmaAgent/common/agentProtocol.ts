/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Version of the private native workbench <-> agent runtime contract. */
export const AGENT_PROTOCOL_VERSION = 1 as const;
export type AgentProtocolVersion = typeof AGENT_PROTOCOL_VERSION;

export const enum AgentCommandType {
	StartSession = 'start',
	StopSession = 'stop',
	SendInput = 'input',
	RequestDiff = 'diff',
	Approve = 'approve',
	Reject = 'reject',
	ListWorktrees = 'worktrees',
	ApplyConfiguration = 'configure',
}

export const enum AgentEventType {
	State = 'state',
	Content = 'content',
	Diff = 'diff',
	Permission = 'permission',
	Worktrees = 'worktrees',
	Result = 'result',
	Error = 'error',
}

export const enum AgentSessionState {
	Starting = 'starting',
	Running = 'running',
	WaitingForApproval = 'waitingForApproval',
	Stopping = 'stopping',
	Stopped = 'stopped',
	Error = 'error',
}

export const enum AgentErrorCode {
	InvalidPayload = 'invalidPayload',
	UnsupportedVersion = 'unsupportedVersion',
	DuplicateRequestId = 'duplicateRequestId',
	SessionNotFound = 'sessionNotFound',
	RuntimeUnavailable = 'runtimeUnavailable',
	ConnectionLost = 'connectionLost',
	WorkspaceUntrusted = 'workspaceUntrusted',
	PermissionDenied = 'permissionDenied',
	WorktreeNotFound = 'worktreeNotFound',
	ConfigurationInvalid = 'configurationInvalid',
	Internal = 'internal',
}

export const enum AgentApprovalKind {
	Edit = 'edit',
	Command = 'command',
	Tool = 'tool',
}

export const enum AgentResultStatus {
	Completed = 'completed',
	Cancelled = 'cancelled',
	Rejected = 'rejected',
}

export type AgentContentRole = 'user' | 'assistant' | 'system';

export interface AgentCommandBase {
	readonly version: AgentProtocolVersion;
	readonly requestId: string;
	readonly type: AgentCommandType;
}

export interface AgentSessionCommandBase extends AgentCommandBase {
	readonly sessionId: string;
}

export interface AgentStartSessionCommand extends AgentCommandBase {
	readonly type: AgentCommandType.StartSession;
	/** Omit to create a session; provide to resume a known session. */
	readonly sessionId?: string;
	/** Workspace reference only. The runtime resolves files and processes. */
	readonly workspaceUri?: string;
}

export interface AgentStopSessionCommand extends AgentSessionCommandBase {
	readonly type: AgentCommandType.StopSession;
}

export interface AgentSendInputCommand extends AgentSessionCommandBase {
	readonly type: AgentCommandType.SendInput;
	readonly text: string;
}

export interface AgentRequestDiffCommand extends AgentSessionCommandBase {
	readonly type: AgentCommandType.RequestDiff;
	/** Omit to request the current proposed diff. */
	readonly diffId?: string;
}

export interface AgentApproveCommand extends AgentSessionCommandBase {
	readonly type: AgentCommandType.Approve;
	readonly approvalId: string;
}

export interface AgentRejectCommand extends AgentSessionCommandBase {
	readonly type: AgentCommandType.Reject;
	readonly approvalId: string;
	readonly reason?: string;
}

export interface AgentListWorktreesCommand extends AgentSessionCommandBase {
	readonly type: AgentCommandType.ListWorktrees;
}

/** Configuration contains identifiers only; credentials stay with the runtime/provider. */
export interface AgentConfiguration {
	readonly provider?: string;
	readonly model?: string;
	readonly worktreeId?: string;
}

export interface AgentApplyConfigurationCommand extends AgentCommandBase {
	readonly type: AgentCommandType.ApplyConfiguration;
	readonly sessionId?: string;
	readonly configuration: AgentConfiguration;
}

export type AgentCommand =
	| AgentStartSessionCommand
	| AgentStopSessionCommand
	| AgentSendInputCommand
	| AgentRequestDiffCommand
	| AgentApproveCommand
	| AgentRejectCommand
	| AgentListWorktreesCommand
	| AgentApplyConfigurationCommand;

export interface AgentDiffFile {
	readonly path: string;
	readonly original: string;
	readonly modified: string;
}

export interface AgentDiff {
	readonly diffId: string;
	readonly files: readonly AgentDiffFile[];
}

export interface AgentPermissionRequest {
	readonly approvalId: string;
	readonly kind: AgentApprovalKind;
	readonly title: string;
	readonly description?: string;
	readonly diffId?: string;
}

export interface AgentWorktree {
	readonly id: string;
	readonly label: string;
	readonly branch: string;
	readonly isCurrent: boolean;
}

export interface AgentResult {
	readonly status: AgentResultStatus;
	readonly content?: string;
	readonly diffId?: string;
}

export interface AgentError {
	readonly code: AgentErrorCode;
	readonly message: string;
	readonly retryable: boolean;
}

export interface AgentEventBase {
	readonly version: AgentProtocolVersion;
	readonly type: AgentEventType;
	/** Present when the event is a response or stream item for one command. */
	readonly requestId?: string;
}

export interface AgentSessionEventBase extends AgentEventBase {
	readonly sessionId: string;
}

export interface AgentStateEvent extends AgentSessionEventBase {
	readonly type: AgentEventType.State;
	readonly state: AgentSessionState;
}

export interface AgentContentEvent extends AgentSessionEventBase {
	readonly type: AgentEventType.Content;
	readonly role: AgentContentRole;
	readonly content: string;
	readonly delta: boolean;
}

export interface AgentDiffEvent extends AgentSessionEventBase {
	readonly type: AgentEventType.Diff;
	readonly diff: AgentDiff;
}

export interface AgentPermissionEvent extends AgentSessionEventBase {
	readonly type: AgentEventType.Permission;
	readonly permission: AgentPermissionRequest;
}

export interface AgentWorktreesEvent extends AgentSessionEventBase {
	readonly type: AgentEventType.Worktrees;
	readonly worktrees: readonly AgentWorktree[];
}

export interface AgentResultEvent extends AgentSessionEventBase {
	readonly type: AgentEventType.Result;
	readonly result: AgentResult;
}

export interface AgentErrorEvent extends AgentEventBase {
	readonly type: AgentEventType.Error;
	/** Omitted only when the failure happened before a session existed. */
	readonly sessionId?: string;
	readonly error: AgentError;
}

export type AgentEvent =
	| AgentStateEvent
	| AgentContentEvent
	| AgentDiffEvent
	| AgentPermissionEvent
	| AgentWorktreesEvent
	| AgentResultEvent
	| AgentErrorEvent;

export interface AgentValidationSuccess<T> {
	readonly valid: true;
	readonly value: T;
}

export interface AgentValidationFailure {
	readonly valid: false;
	readonly error: AgentError;
}

export type AgentValidationResult<T> = AgentValidationSuccess<T> | AgentValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || isNonEmptyString(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).every(key => keys.includes(key));
}

function invalidPayload(message: string): AgentError {
	return { code: AgentErrorCode.InvalidPayload, message, retryable: false };
}

function getEnvelopeError(value: unknown, kind: 'command' | 'event', requiresRequestId: boolean): AgentError | undefined {
	if (!isRecord(value)) {
		return invalidPayload(`Invalid agent ${kind} payload.`);
	}

	if (value.version !== AGENT_PROTOCOL_VERSION) {
		return typeof value.version === 'number'
			? { code: AgentErrorCode.UnsupportedVersion, message: 'Unsupported agent protocol version.', retryable: false }
			: invalidPayload(`Agent ${kind} payload has no valid version.`);
	}

	if (requiresRequestId && !isNonEmptyString(value.requestId)) {
		return invalidPayload(`Agent ${kind} payload requires a requestId.`);
	}

	if (!requiresRequestId && value.requestId !== undefined && !isNonEmptyString(value.requestId)) {
		return invalidPayload(`Agent ${kind} payload has an invalid requestId.`);
	}

	if (!isNonEmptyString(value.type)) {
		return invalidPayload(`Agent ${kind} payload requires a type.`);
	}

	return undefined;
}

function isAgentSessionState(value: unknown): value is AgentSessionState {
	switch (value) {
		case AgentSessionState.Starting:
		case AgentSessionState.Running:
		case AgentSessionState.WaitingForApproval:
		case AgentSessionState.Stopping:
		case AgentSessionState.Stopped:
		case AgentSessionState.Error:
			return true;
		default:
			return false;
	}
}

function isAgentApprovalKind(value: unknown): value is AgentApprovalKind {
	switch (value) {
		case AgentApprovalKind.Edit:
		case AgentApprovalKind.Command:
		case AgentApprovalKind.Tool:
			return true;
		default:
			return false;
	}
}

function isAgentResultStatus(value: unknown): value is AgentResultStatus {
	switch (value) {
		case AgentResultStatus.Completed:
		case AgentResultStatus.Cancelled:
		case AgentResultStatus.Rejected:
			return true;
		default:
			return false;
	}
}

function isAgentErrorCode(value: unknown): value is AgentErrorCode {
	switch (value) {
		case AgentErrorCode.InvalidPayload:
		case AgentErrorCode.UnsupportedVersion:
		case AgentErrorCode.DuplicateRequestId:
		case AgentErrorCode.SessionNotFound:
		case AgentErrorCode.RuntimeUnavailable:
		case AgentErrorCode.ConnectionLost:
		case AgentErrorCode.WorkspaceUntrusted:
		case AgentErrorCode.PermissionDenied:
		case AgentErrorCode.WorktreeNotFound:
		case AgentErrorCode.ConfigurationInvalid:
		case AgentErrorCode.Internal:
			return true;
		default:
			return false;
	}
}

export function isAgentConfiguration(value: unknown): value is AgentConfiguration {
	if (!isRecord(value) || !hasOnlyKeys(value, ['provider', 'model', 'worktreeId'])) {
		return false;
	}

	return isOptionalString(value.provider)
		&& isOptionalString(value.model)
		&& isOptionalString(value.worktreeId);
}

export function isAgentDiff(value: unknown): value is AgentDiff {
	if (!isRecord(value)
		|| !hasOnlyKeys(value, ['diffId', 'files'])
		|| !isNonEmptyString(value.diffId)
		|| !Array.isArray(value.files)) {
		return false;
	}

	return value.files.every(file => {
		if (!isRecord(file) || !hasOnlyKeys(file, ['path', 'original', 'modified'])) {
			return false;
		}

		return isNonEmptyString(file.path)
			&& typeof file.original === 'string'
			&& typeof file.modified === 'string';
	});
}

function isAgentPermissionRequest(value: unknown): value is AgentPermissionRequest {
	if (!isRecord(value)
		|| !hasOnlyKeys(value, ['approvalId', 'kind', 'title', 'description', 'diffId'])
		|| !isNonEmptyString(value.approvalId)
		|| !isAgentApprovalKind(value.kind)
		|| !isNonEmptyString(value.title)
		|| !isOptionalString(value.description)
		|| !isOptionalString(value.diffId)) {
		return false;
	}

	return true;
}

function isAgentWorktree(value: unknown): value is AgentWorktree {
	return isRecord(value)
		&& hasOnlyKeys(value, ['id', 'label', 'branch', 'isCurrent'])
		&& isNonEmptyString(value.id)
		&& isNonEmptyString(value.label)
		&& isNonEmptyString(value.branch)
		&& typeof value.isCurrent === 'boolean';
}

function isAgentResult(value: unknown): value is AgentResult {
	return isRecord(value)
		&& hasOnlyKeys(value, ['status', 'content', 'diffId'])
		&& isAgentResultStatus(value.status)
		&& isOptionalString(value.content)
		&& isOptionalString(value.diffId);
}

function isAgentError(value: unknown): value is AgentError {
	return isRecord(value)
		&& hasOnlyKeys(value, ['code', 'message', 'retryable'])
		&& isAgentErrorCode(value.code)
		&& isNonEmptyString(value.message)
		&& typeof value.retryable === 'boolean';
}

function getAgentCommandError(value: unknown): AgentError | undefined {
	const envelopeError = getEnvelopeError(value, 'command', true);
	if (envelopeError) {
		return envelopeError;
	}

	const command = value as Record<string, unknown>;
	switch (command.type) {
		case AgentCommandType.StartSession:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'workspaceUri'])
				&& isOptionalString(command.sessionId)
				&& isOptionalString(command.workspaceUri)
				? undefined
				: invalidPayload('Start command has an invalid sessionId or workspaceUri.');
		case AgentCommandType.StopSession:
		case AgentCommandType.ListWorktrees:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId'])
				&& isNonEmptyString(command.sessionId)
				? undefined
				: invalidPayload('Agent command requires a sessionId.');
		case AgentCommandType.SendInput:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'text'])
				&& isNonEmptyString(command.sessionId)
				&& typeof command.text === 'string'
				? undefined
				: invalidPayload('Input command requires a sessionId and text.');
		case AgentCommandType.RequestDiff:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'diffId'])
				&& isNonEmptyString(command.sessionId)
				&& isOptionalString(command.diffId)
				? undefined
				: invalidPayload('Diff command has an invalid sessionId or diffId.');
		case AgentCommandType.Approve:
		case AgentCommandType.Reject:
			return hasOnlyKeys(command, command.type === AgentCommandType.Approve
				? ['version', 'requestId', 'type', 'sessionId', 'approvalId']
				: ['version', 'requestId', 'type', 'sessionId', 'approvalId', 'reason'])
				&& isNonEmptyString(command.sessionId)
				&& isNonEmptyString(command.approvalId)
				&& (command.type === AgentCommandType.Approve || isOptionalString(command.reason))
				? undefined
				: invalidPayload('Approval command requires a sessionId and approvalId.');
		case AgentCommandType.ApplyConfiguration:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'configuration'])
				&& isOptionalString(command.sessionId)
				&& isAgentConfiguration(command.configuration)
				? undefined
				: invalidPayload('Configuration command has an invalid sessionId or configuration.');
		default:
			return invalidPayload('Unknown agent command type.');
	}
}

function getAgentEventError(value: unknown): AgentError | undefined {
	const envelopeError = getEnvelopeError(value, 'event', false);
	if (envelopeError) {
		return envelopeError;
	}

	const event = value as Record<string, unknown>;
	const sessionIdIsValid = isNonEmptyString(event.sessionId);
	switch (event.type) {
		case AgentEventType.State:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'state'])
				&& sessionIdIsValid
				&& isAgentSessionState(event.state)
				? undefined
				: invalidPayload('State event requires a sessionId and valid state.');
		case AgentEventType.Content:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'role', 'content', 'delta'])
				&& sessionIdIsValid
				&& (event.role === 'user' || event.role === 'assistant' || event.role === 'system')
				&& typeof event.content === 'string'
				&& typeof event.delta === 'boolean'
				? undefined
				: invalidPayload('Content event has an invalid sessionId, role, content, or delta.');
		case AgentEventType.Diff:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'diff'])
				&& sessionIdIsValid
				&& isAgentDiff(event.diff)
				? undefined
				: invalidPayload('Diff event requires a sessionId and valid diff.');
		case AgentEventType.Permission:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'permission'])
				&& sessionIdIsValid
				&& isAgentPermissionRequest(event.permission)
				? undefined
				: invalidPayload('Permission event requires a sessionId and valid permission.');
		case AgentEventType.Worktrees:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'worktrees'])
				&& sessionIdIsValid
				&& Array.isArray(event.worktrees)
				&& event.worktrees.every(isAgentWorktree)
				? undefined
				: invalidPayload('Worktrees event requires a sessionId and valid worktrees.');
		case AgentEventType.Result:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'result'])
				&& sessionIdIsValid
				&& isAgentResult(event.result)
				? undefined
				: invalidPayload('Result event requires a sessionId and valid result.');
		case AgentEventType.Error:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'error'])
				&& isOptionalString(event.sessionId)
				&& isAgentError(event.error)
				? undefined
				: invalidPayload('Error event has an invalid sessionId or error.');
		default:
			return invalidPayload('Unknown agent event type.');
	}
}

/** Checks a decoded RPC value without allowing it into the application layer. */
export function isAgentCommand(value: unknown): value is AgentCommand {
	return getAgentCommandError(value) === undefined;
}

/** Checks a decoded RPC value without allowing it into the UI layer. */
export function isAgentEvent(value: unknown): value is AgentEvent {
	return getAgentEventError(value) === undefined;
}

/** Returns an explicit protocol error for malformed or incompatible command payloads. */
export function validateAgentCommand(value: unknown): AgentValidationResult<AgentCommand> {
	const error = getAgentCommandError(value);
	return error ? { valid: false, error } : { valid: true, value: value as AgentCommand };
}

/** Returns an explicit protocol error for malformed or incompatible event payloads. */
export function validateAgentEvent(value: unknown): AgentValidationResult<AgentEvent> {
	const error = getAgentEventError(value);
	return error ? { valid: false, error } : { valid: true, value: value as AgentEvent };
}
