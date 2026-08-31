/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DisposableLike } from '../domain/runtime';

/** Version of the private native workbench <-> agent runtime transport contract. */
export const TRANSPORT_PROTOCOL_VERSION = 1 as const;
export type TransportProtocolVersion = typeof TRANSPORT_PROTOCOL_VERSION;

/** Sanitized decision accepted from the workbench boundary. */
export type TransportLocalIntegrationPreflightCode =
	| 'workspaceUntrusted'
	| 'unknownOrigin'
	| 'ambiguousPrecedence'
	| 'pathOutsideApprovedScope'
	| 'externalSymlink'
	| 'pathUnavailable'
	| 'configurationInvalid'
	| 'installerCommand'
	| 'npmPlugin'
	| 'startupInstallation'
	| 'insecureUrl'
	| 'silentOAuth'
	| 'permissionDenied';

export type TransportLocalIntegrationPreflight =
	| { readonly accepted: true }
	| { readonly accepted: false; readonly code: TransportLocalIntegrationPreflightCode };

export const enum TransportCommandType {
	StartSession = 'start',
	StopSession = 'stop',
	SendInput = 'input',
	RequestDiff = 'diff',
	Approve = 'approve',
	Reject = 'reject',
	ListWorktrees = 'worktrees',
	ApplyConfiguration = 'configure',
}

export const enum TransportEventType {
	State = 'state',
	Content = 'content',
	Diff = 'diff',
	Permission = 'permission',
	PermissionResolved = 'permissionResolved',
	Worktrees = 'worktrees',
	Result = 'result',
	Error = 'error',
}

export const enum TransportSessionState {
	Starting = 'starting',
	Running = 'running',
	WaitingForApproval = 'waitingForApproval',
	Stopping = 'stopping',
	Stopped = 'stopped',
	Error = 'error',
}

export const enum TransportErrorCode {
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

export interface TransportCommandBase {
	readonly version: TransportProtocolVersion;
	readonly requestId: string;
	readonly type: TransportCommandType;
}

function isTransportRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTransportLocalIntegrationPreflight(value: unknown): value is TransportLocalIntegrationPreflight {
	if (!isTransportRecord(value) || !('accepted' in value)) {
		return false;
	}
	if (value.accepted === true) {
		return Object.keys(value).length === 1;
	}
	if (value.accepted !== false || Object.keys(value).length !== 2 || typeof value.code !== 'string') {
		return false;
	}
	return [
		'workspaceUntrusted',
		'unknownOrigin',
		'ambiguousPrecedence',
		'pathOutsideApprovedScope',
		'externalSymlink',
		'pathUnavailable',
		'configurationInvalid',
		'installerCommand',
		'npmPlugin',
		'startupInstallation',
		'insecureUrl',
		'silentOAuth',
		'permissionDenied',
	].includes(value.code);
}

export interface TransportSessionCommandBase extends TransportCommandBase {
	readonly sessionId: string;
}

export interface TransportStartSessionCommand extends TransportCommandBase {
	readonly type: TransportCommandType.StartSession;
	readonly sessionId?: string;
	readonly workspaceUri: string;
	readonly localIntegrationPreflight: TransportLocalIntegrationPreflight;
}

export interface TransportStopSessionCommand extends TransportSessionCommandBase {
	readonly type: TransportCommandType.StopSession;
}

export interface TransportSendInputCommand extends TransportSessionCommandBase {
	readonly type: TransportCommandType.SendInput;
	readonly text: string;
}

export interface TransportRequestDiffCommand extends TransportSessionCommandBase {
	readonly type: TransportCommandType.RequestDiff;
	readonly diffId?: string;
}

export interface TransportApproveCommand extends TransportSessionCommandBase {
	readonly type: TransportCommandType.Approve;
	readonly approvalId: string;
}

export interface TransportRejectCommand extends TransportSessionCommandBase {
	readonly type: TransportCommandType.Reject;
	readonly approvalId: string;
	readonly reason?: string;
}

export interface TransportListWorktreesCommand extends TransportSessionCommandBase {
	readonly type: TransportCommandType.ListWorktrees;
}

export interface TransportApplyConfigurationCommand extends TransportCommandBase {
	readonly type: TransportCommandType.ApplyConfiguration;
	readonly sessionId?: string;
	readonly configuration: TransportConfiguration;
}

export interface TransportConfiguration {
	readonly provider?: string;
	readonly model?: string;
	readonly worktreeId?: string;
}

export type TransportCommand =
	| TransportStartSessionCommand
	| TransportStopSessionCommand
	| TransportSendInputCommand
	| TransportRequestDiffCommand
	| TransportApproveCommand
	| TransportRejectCommand
	| TransportListWorktreesCommand
	| TransportApplyConfigurationCommand;

export interface TransportDiffFile {
	readonly path: string;
	/** Legacy full-content representation used by fixtures. */
	readonly original?: string;
	readonly modified?: string;
	/** Unified patch representation returned by OpenCode 1.18.23. */
	readonly patch?: string;
}

export interface TransportDiff {
	readonly diffId: string;
	readonly files: readonly TransportDiffFile[];
}

export interface TransportPermissionRequest {
	readonly approvalId: string;
	readonly kind: 'edit' | 'command' | 'tool';
	readonly title: string;
	readonly description?: string;
	readonly diffId?: string;
}

/** The reply values documented by OpenCode 1.18.23 for a permission request. */
export type TransportPermissionReply = 'once' | 'always' | 'reject';

/** Reports how a permission request was actually answered; never inferred locally. */
export interface TransportPermissionResolution {
	readonly approvalId: string;
	readonly reply: TransportPermissionReply;
}

export interface TransportWorktree {
	readonly id: string;
	readonly label: string;
	readonly branch: string;
	readonly isCurrent: boolean;
}

export interface TransportResult {
	readonly status: 'completed' | 'cancelled' | 'rejected';
	readonly content?: string;
	readonly diffId?: string;
}

export interface TransportError {
	readonly code: TransportErrorCode;
	readonly message: string;
	readonly retryable: boolean;
}

export interface TransportValidationSuccess<T> {
	readonly valid: true;
	readonly value: T;
}

export interface TransportValidationFailure {
	readonly valid: false;
	readonly error: TransportError;
}

export type TransportValidationResult<T> = TransportValidationSuccess<T> | TransportValidationFailure;

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || isNonEmptyString(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).every(key => keys.includes(key));
}

function isTransportCommandType(value: unknown): value is TransportCommandType {
	switch (value) {
		case TransportCommandType.StartSession:
		case TransportCommandType.StopSession:
		case TransportCommandType.SendInput:
		case TransportCommandType.RequestDiff:
		case TransportCommandType.Approve:
		case TransportCommandType.Reject:
		case TransportCommandType.ListWorktrees:
		case TransportCommandType.ApplyConfiguration:
			return true;
		default:
			return false;
	}
}

function isTransportConfiguration(value: unknown): value is TransportConfiguration {
	if (!isTransportRecord(value) || !hasOnlyKeys(value, ['provider', 'model', 'worktreeId'])) {
		return false;
	}

	return isOptionalString(value.provider)
		&& isOptionalString(value.model)
		&& isOptionalString(value.worktreeId);
}

function invalidPayload(message: string): TransportError {
	return { code: TransportErrorCode.InvalidPayload, message, retryable: false };
}

function getEnvelopeError(value: unknown): TransportError | undefined {
	if (!isTransportRecord(value)) {
		return invalidPayload('Invalid agent runtime transport payload.');
	}

	if (value.version !== TRANSPORT_PROTOCOL_VERSION) {
		return typeof value.version === 'number'
			? { code: TransportErrorCode.UnsupportedVersion, message: 'Unsupported transport protocol version.', retryable: false }
			: invalidPayload('Transport payload has no valid version.');
	}

	if (!isNonEmptyString(value.requestId)) {
		return invalidPayload('Transport command requires a requestId.');
	}

	if (!isTransportCommandType(value.type)) {
		return invalidPayload('Unknown command type.');
	}

	return undefined;
}

function getTransportCommandError(value: unknown): TransportError | undefined {
	const envelopeError = getEnvelopeError(value);
	if (envelopeError) {
		return envelopeError;
	}

	const command = value as Record<string, unknown>;
	switch (command.type) {
		case TransportCommandType.StartSession:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'workspaceUri', 'localIntegrationPreflight'])
				&& isOptionalString(command.sessionId)
				&& isNonEmptyString(command.workspaceUri)
				&& isTransportLocalIntegrationPreflight(command.localIntegrationPreflight)
				? undefined
				: invalidPayload('Start command requires a workspace and local integration preflight.');
		case TransportCommandType.StopSession:
		case TransportCommandType.ListWorktrees:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId'])
				&& isNonEmptyString(command.sessionId)
				? undefined
				: invalidPayload('Transport command requires a sessionId.');
		case TransportCommandType.SendInput:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'text'])
				&& isNonEmptyString(command.sessionId)
				&& typeof command.text === 'string'
				? undefined
				: invalidPayload('Input command requires a sessionId and text.');
		case TransportCommandType.RequestDiff:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'diffId'])
				&& isNonEmptyString(command.sessionId)
				&& isOptionalString(command.diffId)
				? undefined
				: invalidPayload('Diff command has an invalid sessionId or diffId.');
		case TransportCommandType.Approve:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'approvalId'])
				&& isNonEmptyString(command.sessionId)
				&& isNonEmptyString(command.approvalId)
				? undefined
				: invalidPayload('Approval command requires a sessionId and approvalId.');
		case TransportCommandType.Reject:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'approvalId', 'reason'])
				&& isNonEmptyString(command.sessionId)
				&& isNonEmptyString(command.approvalId)
				&& isOptionalString(command.reason)
				? undefined
				: invalidPayload('Rejection command requires a sessionId and approvalId.');
		case TransportCommandType.ApplyConfiguration:
			return hasOnlyKeys(command, ['version', 'requestId', 'type', 'sessionId', 'configuration'])
				&& isOptionalString(command.sessionId)
				&& isTransportConfiguration(command.configuration)
				? undefined
				: invalidPayload('Configuration command has an invalid sessionId or configuration.');
		default:
			return invalidPayload('Unknown command type.');
	}
}

/** Validates the decoded command at the extension-host boundary. */
export function validateTransportCommand(value: unknown): TransportValidationResult<TransportCommand> {
	const error = getTransportCommandError(value);
	return error ? { valid: false, error } : { valid: true, value: value as TransportCommand };
}

export interface TransportEventBase {
	readonly version: TransportProtocolVersion;
	readonly type: TransportEventType;
	readonly requestId?: string;
}

export interface TransportSessionEventBase extends TransportEventBase {
	readonly sessionId: string;
}

export interface TransportStateEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.State;
	readonly state: TransportSessionState;
}

export interface TransportContentEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.Content;
	readonly role: 'user' | 'assistant' | 'system';
	readonly content: string;
	readonly delta: boolean;
}

export interface TransportDiffEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.Diff;
	readonly diff: TransportDiff;
}

export interface TransportPermissionEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.Permission;
	readonly permission: TransportPermissionRequest;
}

export interface TransportPermissionResolvedEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.PermissionResolved;
	readonly resolution: TransportPermissionResolution;
}

export interface TransportWorktreesEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.Worktrees;
	readonly worktrees: readonly TransportWorktree[];
}

export interface TransportResultEvent extends TransportSessionEventBase {
	readonly type: TransportEventType.Result;
	readonly result: TransportResult;
}

export interface TransportErrorEvent extends TransportEventBase {
	readonly type: TransportEventType.Error;
	readonly sessionId?: string;
	readonly error: TransportError;
}

export type TransportEvent =
	| TransportStateEvent
	| TransportContentEvent
	| TransportDiffEvent
	| TransportPermissionEvent
	| TransportPermissionResolvedEvent
	| TransportWorktreesEvent
	| TransportResultEvent
	| TransportErrorEvent;

function isTransportEventType(value: unknown): value is TransportEventType {
	switch (value) {
		case TransportEventType.State:
		case TransportEventType.Content:
		case TransportEventType.Diff:
		case TransportEventType.Permission:
		case TransportEventType.PermissionResolved:
		case TransportEventType.Worktrees:
		case TransportEventType.Result:
		case TransportEventType.Error:
			return true;
		default:
			return false;
	}
}

function isTransportSessionState(value: unknown): value is TransportSessionState {
	switch (value) {
		case TransportSessionState.Starting:
		case TransportSessionState.Running:
		case TransportSessionState.WaitingForApproval:
		case TransportSessionState.Stopping:
		case TransportSessionState.Stopped:
		case TransportSessionState.Error:
			return true;
		default:
			return false;
	}
}

function isTransportApprovalKind(value: unknown): value is TransportPermissionRequest['kind'] {
	return value === 'edit' || value === 'command' || value === 'tool';
}

function isTransportResultStatus(value: unknown): value is TransportResult['status'] {
	return value === 'completed' || value === 'cancelled' || value === 'rejected';
}

function isTransportErrorCode(value: unknown): value is TransportErrorCode {
	switch (value) {
		case TransportErrorCode.InvalidPayload:
		case TransportErrorCode.UnsupportedVersion:
		case TransportErrorCode.DuplicateRequestId:
		case TransportErrorCode.SessionNotFound:
		case TransportErrorCode.RuntimeUnavailable:
		case TransportErrorCode.ConnectionLost:
		case TransportErrorCode.WorkspaceUntrusted:
		case TransportErrorCode.PermissionDenied:
		case TransportErrorCode.WorktreeNotFound:
		case TransportErrorCode.ConfigurationInvalid:
		case TransportErrorCode.Internal:
			return true;
		default:
			return false;
	}
}

function isTransportDiff(value: unknown): value is TransportDiff {
	if (!isTransportRecord(value) || !hasOnlyKeys(value, ['diffId', 'files']) || !isNonEmptyString(value.diffId) || !Array.isArray(value.files)) {
		return false;
	}

	return value.files.every(file => {
		if (!isTransportRecord(file) || !isNonEmptyString(file.path)) {
			return false;
		}
		if (hasOnlyKeys(file, ['path', 'original', 'modified'])) {
			return typeof file.original === 'string' && typeof file.modified === 'string';
		}
		return hasOnlyKeys(file, ['path', 'patch']) && typeof file.patch === 'string';
	});
}

function isTransportPermissionRequest(value: unknown): value is TransportPermissionRequest {
	return isTransportRecord(value)
		&& hasOnlyKeys(value, ['approvalId', 'kind', 'title', 'description', 'diffId'])
		&& isNonEmptyString(value.approvalId)
		&& isTransportApprovalKind(value.kind)
		&& isNonEmptyString(value.title)
		&& isOptionalString(value.description)
		&& isOptionalString(value.diffId);
}

function isTransportPermissionResolution(value: unknown): value is TransportPermissionResolution {
	return isTransportRecord(value)
		&& hasOnlyKeys(value, ['approvalId', 'reply'])
		&& isNonEmptyString(value.approvalId)
		&& (value.reply === 'once' || value.reply === 'always' || value.reply === 'reject');
}

function isTransportWorktree(value: unknown): value is TransportWorktree {
	return isTransportRecord(value)
		&& hasOnlyKeys(value, ['id', 'label', 'branch', 'isCurrent'])
		&& isNonEmptyString(value.id)
		&& isNonEmptyString(value.label)
		&& isNonEmptyString(value.branch)
		&& typeof value.isCurrent === 'boolean';
}

function isTransportResult(value: unknown): value is TransportResult {
	return isTransportRecord(value)
		&& hasOnlyKeys(value, ['status', 'content', 'diffId'])
		&& isTransportResultStatus(value.status)
		&& isOptionalString(value.content)
		&& isOptionalString(value.diffId);
}

function isTransportError(value: unknown): value is TransportError {
	return isTransportRecord(value)
		&& hasOnlyKeys(value, ['code', 'message', 'retryable'])
		&& isTransportErrorCode(value.code)
		&& isNonEmptyString(value.message)
		&& typeof value.retryable === 'boolean';
}

function getTransportEventError(value: unknown): TransportError | undefined {
	if (!isTransportRecord(value)) {
		return invalidPayload('Invalid agent runtime transport event.');
	}
	if (value.version !== TRANSPORT_PROTOCOL_VERSION) {
		return typeof value.version === 'number'
			? { code: TransportErrorCode.UnsupportedVersion, message: 'Unsupported transport protocol version.', retryable: false }
			: invalidPayload('Transport event has no valid version.');
	}
	if (value.requestId !== undefined && !isNonEmptyString(value.requestId)) {
		return invalidPayload('Transport event has an invalid requestId.');
	}
	if (!isTransportEventType(value.type)) {
		return invalidPayload('Unknown event type.');
	}

	const event = value as Record<string, unknown>;
	const sessionIdIsValid = isNonEmptyString(event.sessionId);
	switch (event.type) {
		case TransportEventType.State:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'state'])
				&& sessionIdIsValid
				&& isTransportSessionState(event.state)
				? undefined
				: invalidPayload('State event requires a sessionId and valid state.');
		case TransportEventType.Content:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'role', 'content', 'delta'])
				&& sessionIdIsValid
				&& (event.role === 'user' || event.role === 'assistant' || event.role === 'system')
				&& typeof event.content === 'string'
				&& typeof event.delta === 'boolean'
				? undefined
				: invalidPayload('Content event has an invalid sessionId, role, content, or delta.');
		case TransportEventType.Diff:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'diff'])
				&& sessionIdIsValid
				&& isTransportDiff(event.diff)
				? undefined
				: invalidPayload('Diff event requires a sessionId and valid diff.');
		case TransportEventType.Permission:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'permission'])
				&& sessionIdIsValid
				&& isTransportPermissionRequest(event.permission)
				? undefined
				: invalidPayload('Permission event requires a sessionId and valid permission.');
		case TransportEventType.PermissionResolved:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'resolution'])
				&& sessionIdIsValid
				&& isTransportPermissionResolution(event.resolution)
				? undefined
				: invalidPayload('Permission resolved event requires a sessionId and valid resolution.');
		case TransportEventType.Worktrees:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'worktrees'])
				&& sessionIdIsValid
				&& Array.isArray(event.worktrees)
				&& event.worktrees.every(isTransportWorktree)
				? undefined
				: invalidPayload('Worktrees event requires a sessionId and valid worktrees.');
		case TransportEventType.Result:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'result'])
				&& sessionIdIsValid
				&& isTransportResult(event.result)
				? undefined
				: invalidPayload('Result event requires a sessionId and valid result.');
		case TransportEventType.Error:
			return hasOnlyKeys(event, ['version', 'type', 'requestId', 'sessionId', 'error'])
				&& isOptionalString(event.sessionId)
				&& isTransportError(event.error)
				? undefined
				: invalidPayload('Error event has an invalid sessionId or error.');
		default:
			return invalidPayload('Unknown event type.');
	}
}

/** Validates events before delivering them to the workbench return command. */
export function validateTransportEvent(value: unknown): TransportValidationResult<TransportEvent> {
	const error = getTransportEventError(value);
	return error ? { valid: false, error } : { valid: true, value: value as TransportEvent };
}

/** Transport bridge interface exposed by the extension for workbench integration. */
export interface RuntimeTransport extends DisposableLike {
	onEvent(listener: (event: TransportEvent) => void): DisposableLike;
	send(command: TransportCommand): Promise<void>;
}
