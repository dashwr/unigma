/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SessionReferenceStore } from '../application/runtimePorts';
import type { SessionReference, WorkspaceReference } from '../domain/runtime';

export interface WorkspaceStateMemento {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
}

const SESSION_REFERENCE_KEY_PREFIX = 'unigma.agent.session.';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSessionReference(value: unknown): value is SessionReference {
	return isRecord(value)
		&& Object.keys(value).every(key => key === 'sessionId' || key === 'workspaceUri')
		&& typeof value.sessionId === 'string'
		&& value.sessionId.length > 0
		&& typeof value.workspaceUri === 'string'
		&& value.workspaceUri.length > 0;
}

/** Stores only the session/workspace reference allowed by the local-first model. */
export class WorkspaceStateSessionReferenceStore implements SessionReferenceStore {
	private readonly state: WorkspaceStateMemento;

	public constructor(state: WorkspaceStateMemento) {
		this.state = state;
	}

	public async read(workspace: WorkspaceReference): Promise<SessionReference | undefined> {
		const value = this.state.get<unknown>(this.key(workspace));
		if (!isSessionReference(value) || value.workspaceUri !== workspace.uri) {
			return undefined;
		}

		return { sessionId: value.sessionId, workspaceUri: value.workspaceUri };
	}

	public async write(reference: SessionReference): Promise<void> {
		if (!isSessionReference(reference)) {
			throw new Error('Session reference is invalid.');
		}

		await this.state.update(this.key({ uri: reference.workspaceUri }), {
			sessionId: reference.sessionId,
			workspaceUri: reference.workspaceUri,
		});
	}

	public async remove(workspace: WorkspaceReference): Promise<void> {
		await this.state.update(this.key(workspace), undefined);
	}

	private key(workspace: WorkspaceReference): string {
		return `${SESSION_REFERENCE_KEY_PREFIX}${encodeURIComponent(workspace.uri)}`;
	}
}
