/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface DisposableLike {
	dispose(): void;
}

export type RuntimeState = 'idle' | 'demanded' | 'disposed';

export type RuntimeDemandSource = 'command' | 'rpc';

export interface RuntimeDemand {
	readonly source: RuntimeDemandSource;
	readonly requestId?: string;
}

export type RuntimeResourceOwner = 'unigma-agent-runtime';

/** An opaque handle whose ownership must be established before it can be stopped. */
export interface OwnedProcessHandle {
	readonly owner: RuntimeResourceOwner;
	readonly id: string;
}

export interface WorkspaceReference {
	readonly uri: string;
}

export interface SessionReference {
	readonly sessionId: string;
	readonly workspaceUri: string;
}

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

/** Deliberately excludes prompts, diffs, file contents, credentials, and transport data. */
export interface DiagnosticRecord {
	readonly level: DiagnosticLevel;
	readonly code: string;
	readonly requestId?: string;
	readonly sessionId?: string;
}
