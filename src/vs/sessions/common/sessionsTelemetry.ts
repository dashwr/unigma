/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isCancellationError } from '../../base/common/errors.js';
import { StringSHA1 } from '../../base/common/hash.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';

/** Bounded provider categories emitted by sessions telemetry. */
export type SessionsTelemetryProviderId = 'default-copilot' | 'other';

/** Removes connection-specific details from a sessions provider identifier. */
export function getSessionsTelemetryProviderId(providerId: string): SessionsTelemetryProviderId {
	if (providerId === 'default-copilot') {
		return providerId;
	}
	return 'other';
}

/** Hashes a session identifier while preserving deterministic event correlation. */
export function hashSessionIdForTelemetry(sessionId: string): string {
	const sha1 = new StringSHA1();
	sha1.update(sessionId);
	return sha1.digest();
}

// --- Titlebar button interactions ---

export type SessionsInteractionButton =
	| 'newSession'
	| 'runPrimaryTask'
	| 'addTask'
	| 'generateNewTask'
	| 'openTerminal'
	| 'openInVSCode';

export type SessionsInteractionSource = 'menu' | 'actionWidget' | 'titleBar' | 'sidebar';

type SessionsInteractionEvent = {
	button: string;
	source?: string;
};

type SessionsInteractionClassification = {
	owner: 'osortega';
	comment: 'Tracks user interactions with buttons in the Agents window';
	button: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The identifier of the button that was clicked' };
	source?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The UI surface that triggered the interaction (menu, actionWidget, titleBar or sidebar)' };
};

/**
 * Log a titlebar button interaction in the Agents window.
 */
export function logSessionsInteraction(telemetryService: ITelemetryService, button: SessionsInteractionButton, source?: SessionsInteractionSource): void {
	telemetryService.publicLog2<SessionsInteractionEvent, SessionsInteractionClassification>('vscodeAgents.interaction', source ? { button, source } : { button });
}

// --- Changes panel interactions ---

type SidePanelToggleEvent = {
	visible: boolean;
};

type SidePanelToggleClassification = {
	owner: 'sandy081';
	comment: 'Tracks when the user toggles the Agents window side panel (editor area + auxiliary bar) open or closed.';
	visible: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the side panel is now visible.' };
};

export function logSidePanelToggle(telemetryService: ITelemetryService, visible: boolean): void {
	telemetryService.publicLog2<SidePanelToggleEvent, SidePanelToggleClassification>('vscodeAgents.layout/toggleSidePanel', { visible });
}

type ChangesViewVersionModeChangeEvent = {
	mode: string;
};

type ChangesViewVersionModeChangeClassification = {
	owner: 'osortega';
	comment: 'Tracks when the user switches the version mode in the Changes panel (Branch Changes, All Changes, Last Turn).';
	mode: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The version mode selected by the user.' };
};

export function logChangesViewVersionModeChange(telemetryService: ITelemetryService, mode: string): void {
	telemetryService.publicLog2<ChangesViewVersionModeChangeEvent, ChangesViewVersionModeChangeClassification>('vscodeAgents.changesView/versionModeChange', { mode });
}

type ChangesViewFileSelectEvent = {
	changeType: string;
};

type ChangesViewFileSelectClassification = {
	owner: 'osortega';
	comment: 'Tracks when the user selects a changed file in the Changes panel.';
	changeType: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The type of change (added, modified, deleted).' };
};

export function logChangesViewFileSelect(telemetryService: ITelemetryService, changeType: string): void {
	telemetryService.publicLog2<ChangesViewFileSelectEvent, ChangesViewFileSelectClassification>('vscodeAgents.changesView/fileSelect', { changeType });
}

type ChangesViewViewModeChangeEvent = {
	mode: string;
};

type ChangesViewViewModeChangeClassification = {
	owner: 'osortega';
	comment: 'Tracks when the user switches between list and tree view modes in the Changes panel.';
	mode: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The view mode selected by the user (list or tree).' };
};

export function logChangesViewViewModeChange(telemetryService: ITelemetryService, mode: string): void {
	telemetryService.publicLog2<ChangesViewViewModeChangeEvent, ChangesViewViewModeChangeClassification>('vscodeAgents.changesView/viewModeChange', { mode });
}

// --- Shared multi-root topology helpers ---

/**
 * The browser-projected git/non-git shape of a session's workspace folders,
 * used for telemetry. These counts come from workspace *metadata*
 * (`folder.gitRepository`), distinct from the agent host's Node-side git probe;
 * `folderCount === gitFolderCount + nonGitFolderCount`.
 */
export interface ISessionWorkspaceTopology {
	readonly folderCount: number;
	readonly gitFolderCount: number;
	readonly nonGitFolderCount: number;
	readonly isMultiRoot: boolean;
}

/**
 * Derives the reconcilable {@link ISessionWorkspaceTopology} from a session's
 * total and git-backed folder counts (`isMultiRoot` uses the folder-count
 * convention shared across sessions telemetry).
 */
export function classifySessionWorkspaceTopology(folderCount: number, gitFolderCount: number): ISessionWorkspaceTopology {
	return {
		folderCount: folderCount,
		gitFolderCount,
		nonGitFolderCount: folderCount - gitFolderCount,
		isMultiRoot: folderCount > 1,
	};
}

// --- SSH agent host connect ---

export type SSHConnectErrorCategory =
	| 'authentication'
	| 'cancelled'
	| 'hostKeyDenied'
	| 'incompatible'
	| 'network'
	| 'other';

const SSH_HOST_KEY_DENIED_ERROR_NAME = 'SSHHostKeyDenied';

function isSSHHostKeyDeniedError(error: unknown): boolean {
	return error instanceof Error && error.name === SSH_HOST_KEY_DENIED_ERROR_NAME;
}

export function categorizeSSHConnectError(err: unknown): SSHConnectErrorCategory {
	if (isCancellationError(err)) {
		return 'cancelled';
	}
	if (isSSHHostKeyDeniedError(err)) {
		return 'hostKeyDenied';
	}
	if (err instanceof Error && (err as Error & { code?: unknown }).code === -32005) {
		return 'incompatible';
	}
	const message = err instanceof Error ? err.message : String(err);
	if (/authenticat|permission denied|no supported authentication methods|all configured authentication methods failed/i.test(message)) {
		return 'authentication';
	}
	if (/ECONN|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|ETIMEDOUT|network|handshake.*timed out|closed before the handshake completed/i.test(message)) {
		return 'network';
	}
	return 'other';
}

type SSHConnectAttemptEvent = {
	operation: string;
	userInitiated: boolean;
	attempt: number;
	durationMs: number;
	success: boolean;
	willRetry: boolean;
	errorCategory: string;
};

type SSHConnectAttemptClassification = {
	owner: 'roblourens';
	comment: 'Tracks SSH provider connection attempts so connection and reconnection reliability can be measured.';
	operation: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether this was an explicit connection or a reconnect using a stored SSH config host.' };
	userInitiated: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the attempt was initiated by an explicit user action rather than automatic connection or reconnection.' };
	attempt: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Attempt number within the current connection cycle, starting at one.' };
	durationMs: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Duration of the complete SSH and Agent Host protocol connection attempt in milliseconds.' };
	success: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Whether the connection completed through Agent Host protocol initialization.' };
	willRetry: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Whether another automatic retry was scheduled after this failed attempt.' };
	errorCategory: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Bounded failure category (authentication, cancelled, hostKeyDenied, incompatible, network, or other); empty on success.' };
};

export function logSSHConnectAttempt(telemetryService: ITelemetryService, data: {
	operation: 'connect' | 'reconnect';
	userInitiated: boolean;
	attempt: number;
	durationMs: number;
	success: boolean;
	willRetry: boolean;
	errorCategory?: SSHConnectErrorCategory;
}): void {
	telemetryService.publicLog2<SSHConnectAttemptEvent, SSHConnectAttemptClassification>('vscodeAgents.sshConnect/attempt', {
		...data,
		errorCategory: data.errorCategory ?? '',
	});
}

// --- Socket lifecycle telemetry ---

export type SocketCloseTrigger =
	| 'server'
	| 'sendOnDeadSocket'
	| 'visibility'
	| 'offline'
	| 'malformedFrames'
	| 'disposed'
	| 'error';

type SocketCloseEvent = {
	closeCode: number;
	wasClean: boolean;
	lifetimeMs: number;
	messagesSent: number;
	messagesReceived: number;
	messagesDropped: number;
	trigger: string;
};

type SocketCloseClassification = {
	owner: 'osortega';
	comment: 'Tracks WebSocket close events for agent host connections to measure connection reliability.';
	closeCode: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'WebSocket close code.' };
	wasClean: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Whether the close was clean.' };
	lifetimeMs: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'How long the socket was alive in milliseconds.' };
	messagesSent: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Total messages sent.' };
	messagesReceived: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Total messages received.' };
	messagesDropped: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Total messages dropped due to non-OPEN socket.' };
	trigger: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'What triggered the close (server, sendOnDeadSocket, visibility, offline, malformedFrames, disposed, error).' };
};

export function logSocketClose(telemetryService: ITelemetryService, data: { closeCode: number; wasClean: boolean; lifetimeMs: number; messagesSent: number; messagesReceived: number; messagesDropped: number; trigger: SocketCloseTrigger }): void {
	telemetryService.publicLog2<SocketCloseEvent, SocketCloseClassification>('vscodeAgents.socket/close', data);
}

// --- Send dropped telemetry ---

type SendDroppedEvent = {
	readyState: number;
	timeSinceLastReceiveMs: number;
	timeSinceLastSendMs: number;
};

type SendDroppedClassification = {
	owner: 'osortega';
	comment: 'Tracks when a message is silently dropped due to a non-OPEN WebSocket, indicating a zombie socket.';
	readyState: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'WebSocket readyState at drop time (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED).' };
	timeSinceLastReceiveMs: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Milliseconds since last received message.' };
	timeSinceLastSendMs: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Milliseconds since last sent message.' };
};

export function logSendDropped(telemetryService: ITelemetryService, data: { readyState: number; timeSinceLastReceiveMs: number; timeSinceLastSendMs: number }): void {
	telemetryService.publicLog2<SendDroppedEvent, SendDroppedClassification>('vscodeAgents.socket/sendDropped', data);
}

// --- Visibility resumed telemetry ---

type VisibilityResumedEvent = {
	hiddenDurationMs: number;
	socketAlive: boolean;
	forceClosed: boolean;
};

type VisibilityResumedClassification = {
	owner: 'osortega';
	comment: 'Tracks tab visibility resume events to measure zombie socket detection effectiveness.';
	hiddenDurationMs: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'How long the tab was hidden in milliseconds.' };
	socketAlive: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Whether the socket was alive after zombie detection check.' };
	forceClosed: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Whether the socket was force-closed on resume.' };
};

export function logVisibilityResumed(telemetryService: ITelemetryService, data: { hiddenDurationMs: number; socketAlive: boolean; forceClosed: boolean }): void {
	telemetryService.publicLog2<VisibilityResumedEvent, VisibilityResumedClassification>('vscodeAgents.socket/visibilityResumed', data);
}

// --- Terminal recovery telemetry ---

type TerminalRecoveryEvent = {
	recoveredCount: number;
	totalCount: number;
};

type TerminalRecoveryClassification = {
	owner: 'osortega';
	comment: 'Tracks terminal reconnection outcomes after agent host disconnect.';
	recoveredCount: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Number of terminals successfully reconnected.' };
	totalCount: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Total number of active terminals at reconnect time.' };
};

export function logTerminalRecovery(telemetryService: ITelemetryService, data: { recoveredCount: number; totalCount: number }): void {
	telemetryService.publicLog2<TerminalRecoveryEvent, TerminalRecoveryClassification>('vscodeAgents.terminal/recovery', data);
}
