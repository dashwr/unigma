/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The base context the runtime adds to every prompt.
 *
 * OpenCode already assembles the environment block, the project instruction
 * files and the tool descriptions; duplicating any of that would only spend
 * tokens. What OpenCode cannot know is who is calling it, so this preamble
 * states the caller, the folder the session is bound to and how attachments
 * were produced. It is deliberately short and free of prompt engineering.
 */
export interface SessionContextInput {
	/** Canonical folder URI on the executing host. */
	readonly workspaceUri: string;
	/** Present only when the session runs on a remote host. */
	readonly remoteAuthority?: string;
	/** Number of editor references attached to this prompt. */
	readonly attachmentCount: number;
}

export function composeSessionContext(input: SessionContextInput): string {
	const lines = [
		'You are called from unigma, a code editor. The user reads your answer in an editor panel, not in a terminal.',
		`The session is bound to the folder ${input.workspaceUri} on the host that runs you.`,
	];
	if (input.remoteAuthority) {
		lines.push(`That host is remote (${input.remoteAuthority}); paths and commands refer to it, never to the user's machine.`);
	}
	if (input.attachmentCount > 0) {
		lines.push(input.attachmentCount === 1
			? 'One attachment is a real file reference from the open editor; read it instead of guessing its contents.'
			: `${input.attachmentCount} attachments are real file references from the open editor; read them instead of guessing their contents.`);
	}
	return lines.join('\n');
}
