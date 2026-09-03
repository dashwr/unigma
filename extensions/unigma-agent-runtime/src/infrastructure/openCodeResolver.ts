/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface OpenCodeCandidate {
	readonly command: string;
	readonly exists: boolean;
	readonly executable: boolean;
}

export interface OpenCodeCandidates {
	readonly embedded?: OpenCodeCandidate;
	readonly configured?: OpenCodeCandidate;
	readonly path?: OpenCodeCandidate;
}

export type OpenCodeResolution =
	| { readonly kind: 'embedded'; readonly command: string }
	| { readonly kind: 'configured'; readonly command: string }
	| { readonly kind: 'path'; readonly command: string }
	| { readonly kind: 'unavailable'; readonly code: 'embedded-not-executable' | 'configured-not-executable' | 'no-executable-candidate' };

/**
 * Resolves the bundled runtime before any user-provided or development command.
 * The package is the reproducible product input; an explicit command is only a
 * deliberate override, and PATH is retained last for development compatibility.
 */
export function resolveOpenCodeCommand(candidates: OpenCodeCandidates): OpenCodeResolution {
	if (candidates.embedded?.exists) {
		return candidates.embedded.executable
			? { kind: 'embedded', command: candidates.embedded.command }
			: { kind: 'unavailable', code: 'embedded-not-executable' };
	}

	if (candidates.configured?.exists) {
		return candidates.configured.executable
			? { kind: 'configured', command: candidates.configured.command }
			: { kind: 'unavailable', code: 'configured-not-executable' };
	}

	if (candidates.path?.exists && candidates.path.executable) {
		return { kind: 'path', command: candidates.path.command };
	}

	return { kind: 'unavailable', code: 'no-executable-candidate' };
}
