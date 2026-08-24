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

/** Owns the single OpenCode process associated with this extension host. */
export interface ProcessManager {
	ensureStarted(): Promise<OwnedProcessHandle>;
	stopOwned(): Promise<void>;
}

/** Hides the OpenCode transport and its event stream from the application boundary. */
export interface OpenCodeClient<TRequest = unknown, TEvent = unknown> {
	connect(process: OwnedProcessHandle): Promise<void>;
	send(request: TRequest): Promise<unknown>;
	onEvent(listener: (event: TEvent) => void): DisposableLike;
	disconnect(): Promise<void>;
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
	readonly processManager: ProcessManager;
	readonly openCodeClient: OpenCodeClient;
	readonly sessionReferenceStore: SessionReferenceStore;
	readonly diagnostics: DiagnosticSink;
}
