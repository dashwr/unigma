/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Testable stateful contract mirror; the runtime owns operational request and session state. */
export interface AgentApplicationCommand {
	readonly requestId: string;
	readonly type: string;
	readonly sessionId?: string;
}

export interface AgentApplicationError {
	readonly code: 'duplicateRequestId' | 'sessionNotFound';
	readonly message: string;
	readonly retryable: boolean;
}

export type AgentApplicationResult =
	| { readonly accepted: true }
	| { readonly accepted: false; readonly error: AgentApplicationError };

/** Holds only transient identifiers; session data remains owned by the runtime. */
export class AgentApplication {
	private readonly _requestIds = new Set<string>();
	private readonly _sessionIds = new Set<string>();

	public registerSession(sessionId: string): void {
		this._sessionIds.add(sessionId);
	}

	public removeSession(sessionId: string): void {
		this._sessionIds.delete(sessionId);
	}

	public accept(command: AgentApplicationCommand): AgentApplicationResult {
		if (this._requestIds.has(command.requestId)) {
			return { accepted: false, error: { code: 'duplicateRequestId', message: 'This request was already handled.', retryable: false } };
		}

		this._requestIds.add(command.requestId);
		if (command.sessionId !== undefined && !this._sessionIds.has(command.sessionId)) {
			return { accepted: false, error: { code: 'sessionNotFound', message: 'The requested session is not available.', retryable: false } };
		}

		return { accepted: true };
	}
}
