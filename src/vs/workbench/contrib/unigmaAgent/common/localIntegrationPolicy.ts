/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type LocalIntegrationKind = 'mcp' | 'plugin' | 'rule';

/** Sanitized policy input; configuration contents and credentials never cross this boundary. */
export interface LocalIntegrationRequest {
	readonly kind: LocalIntegrationKind;
	readonly workspaceTrusted: boolean;
	readonly approved: boolean;
	readonly configurationValid: boolean;
}

export type LocalIntegrationDecision =
	| { readonly accepted: true }
	| { readonly accepted: false; readonly code: 'workspaceUntrusted' | 'permissionDenied' | 'configurationInvalid' };

/** Applies the common trust/configuration gates before any integration can be loaded. */
export function evaluateLocalIntegration(request: LocalIntegrationRequest): LocalIntegrationDecision {
	if (!request.workspaceTrusted) {
		return { accepted: false, code: 'workspaceUntrusted' };
	}

	if (!request.configurationValid) {
		return { accepted: false, code: 'configurationInvalid' };
	}

	if (!request.approved) {
		return { accepted: false, code: 'permissionDenied' };
	}

	return { accepted: true };
}
