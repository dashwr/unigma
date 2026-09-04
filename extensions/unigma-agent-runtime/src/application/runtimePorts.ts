/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	DiagnosticRecord,
	DisposableLike,
	OwnedProcessHandle,
	SessionReference,
	WorkspaceReference,
} from '../domain/runtime';

import type { TransportLocalIntegrationInventory } from './transport';

export interface OpenCodeRequest {
	readonly method: 'GET' | 'POST';
	readonly path: string;
	readonly body?: unknown;
}

export interface OpenCodeEvent {
	readonly type: string;
	readonly properties: Record<string, unknown>;
}

/** Sanitized refusal reasons produced by the local integration policy boundary. */
export type LocalIntegrationPreflightCode =
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

/** A decision crossing into the runtime contains no raw configuration or secrets. */
export type LocalIntegrationPreflightResult =
	| { readonly accepted: true }
	| { readonly accepted: false; readonly code: LocalIntegrationPreflightCode };

export type LocalIntegrationPreflight = (
	workspace: WorkspaceReference,
	requested?: LocalIntegrationPreflightResult,
) => LocalIntegrationPreflightResult;

export type LocalIntegrationInventory = (
	workspace: WorkspaceReference,
) => Promise<TransportLocalIntegrationInventory>;

/** Owns the single OpenCode process associated with this extension host. */
export interface ProcessManager {
	ensureStarted(workspace: WorkspaceReference): Promise<OwnedProcessHandle>;
	stopOwned(): Promise<void>;
}

/** Confirms that a command targets an open, trusted workspace. */
export interface WorkspaceTrust {
	isTrusted(workspace: WorkspaceReference): boolean;
}

/** Lifecycle-only boundary used by the application composition. */
export interface OpenCodeConnection {
	connect(process: OwnedProcessHandle): Promise<void>;
	disconnect(): Promise<void>;
}

/** Hides the OpenCode transport and its event stream from the infrastructure boundary. */
export interface OpenCodeClient<TRequest = unknown, TEvent = unknown> extends OpenCodeConnection {
	send(request: TRequest): Promise<unknown>;
	onEvent(listener: (event: TEvent) => void): DisposableLike;
}

/** Stores only the session reference permitted by the local-first data model. */
export interface SessionReferenceStore {
	read(workspace: WorkspaceReference): Promise<SessionReference | undefined>;
	write(reference: SessionReference): Promise<void>;
	remove(workspace: WorkspaceReference): Promise<void>;
}

/** Accepts correlation metadata only; implementations must redact content before recording. */
export interface DiagnosticSink {
	record(diagnostic: DiagnosticRecord): void;
}

/** Composition boundary for the future T-021/T-022/T-023 adapters. */
export interface RuntimePorts {
	readonly workspaceTrust: WorkspaceTrust;
	readonly processManager: ProcessManager;
	/** Runs after workspace trust and immediately before process startup. */
	readonly localIntegrationPreflight: LocalIntegrationPreflight;
	/** Enumerates local OpenCode sources without starting the process. */
	readonly enumerateLocalIntegrations: LocalIntegrationInventory;
	readonly openCodeClient: OpenCodeClient<OpenCodeRequest, OpenCodeEvent>;
	readonly sessionReferenceStore: SessionReferenceStore;
	readonly diagnostics: DiagnosticSink;
}
