/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type AgentFeedbackKindValue = 'user' | 'codeReview' | 'prReview';
export type AgentFeedbackAuthorValue = 'user' | 'agent' | 'prReviewer' | 'unknown';

export function authorForFeedbackKind(kind: AgentFeedbackKindValue | undefined): AgentFeedbackAuthorValue {
	switch (kind) {
		case 'user': return 'user';
		case 'codeReview': return 'agent';
		case 'prReview': return 'prReviewer';
		default: return 'unknown';
	}
}
