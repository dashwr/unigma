/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AgentCatalogEntry } from './agentProtocol.js';

export type UnigmaAgentInputTrigger = 'reference' | 'command';
export type UnigmaAgentInputAction = 'submit' | 'newline' | 'dismiss' | 'none';

export interface UnigmaAgentInputMatch {
	readonly trigger: UnigmaAgentInputTrigger;
	readonly marker: '@' | '/';
	readonly filter: string;
	/** Text before the active trigger, including all user-authored spacing. */
	readonly text: string;
	readonly entries: readonly AgentCatalogEntry[];
}

function isEscaped(value: string, index: number): boolean {
	let backslashes = 0;
	for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) {
		backslashes++;
	}
	return backslashes % 2 === 1;
}

/** Parses only a trigger in the final whitespace-delimited input token. */
export function parseUnigmaAgentInput(value: string, entries: readonly AgentCatalogEntry[] = []): UnigmaAgentInputMatch | undefined {
	let markerIndex = -1;
	let marker: '@' | '/' | undefined;
	for (let index = value.length - 1; index >= 0; index--) {
		const character = value[index];
		if ((character === '@' || character === '/') && !isEscaped(value, index)
			&& (index === 0 || /\s/.test(value[index - 1]))) {
			markerIndex = index;
			marker = character;
			break;
		}
		if (/\s/.test(character)) {
			break;
		}
	}
	if (marker === undefined) {
		return undefined;
	}

	const trigger = marker === '@' ? 'reference' : 'command';
	const kind = marker === '@' ? 'command' : 'skill';
	const filter = value.slice(markerIndex + 1);
	const normalizedFilter = filter.toLocaleLowerCase();
	return {
		trigger,
		marker,
		filter,
		text: value.slice(0, markerIndex),
		entries: entries.filter(entry => entry.kind === kind
			&& (entry.id.toLocaleLowerCase().includes(normalizedFilter) || entry.name.toLocaleLowerCase().includes(normalizedFilter))),
	};
}

export function getUnigmaAgentInputAction(key: string, shiftKey = false): UnigmaAgentInputAction {
	if (key === 'Escape') {
		return 'dismiss';
	}
	if (key === 'Enter') {
		return shiftKey ? 'newline' : 'submit';
	}
	return 'none';
}
