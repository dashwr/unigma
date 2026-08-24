/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/** UI-facing seam for the future internal agent RPC; it intentionally has no transport. */
export interface IUnigmaAgentRuntime {
	readonly _serviceBrand: undefined;

	start(): Promise<void>;
}

export const IUnigmaAgentRuntime = createDecorator<IUnigmaAgentRuntime>('unigmaAgentRuntime');

/** Explicit T-030 placeholder. It never starts a process or connects anywhere. */
export class UnigmaAgentRuntimePlaceholder implements IUnigmaAgentRuntime {
	declare readonly _serviceBrand: undefined;

	async start(): Promise<void> {
		throw new Error('The unigma agent runtime is not available yet.');
	}
}
