/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { RuntimePorts } from '../application/runtimePorts';

/**
 * T-020 declares the infrastructure composition boundary only. T-021, T-022, and T-023
 * provide the adapters; no adapter is constructed during extension activation here.
 */
export interface RuntimeInfrastructure {
	readonly ports: RuntimePorts;
}
