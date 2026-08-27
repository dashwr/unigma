/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Fixture-only transport contract. It is intentionally not an OpenCode version
 * allowlist and advertises no provider or model support.
 */
export const OPENCODE_FIXTURE_MATRIX = {
	profile: 'http-sse-fixture-v1',
	transport: 'loopback-http-sse',
	protocol: 'OpenAPI 3.1 with SSE event envelope { type, properties }',
	requiredProbes: [
		{ method: 'GET', path: '/doc' },
	] as const,
	requiredOperations: [
		{ method: 'GET', path: '/global/health' },
		{ method: 'GET', path: '/path' },
		{ method: 'GET', path: '/event' },
		{ method: 'GET', path: '/session' },
		{ method: 'POST', path: '/session' },
		{ method: 'GET', path: '/session/status' },
		{ method: 'GET', path: '/session/{}' },
		{ method: 'GET', path: '/session/{}/message' },
		{ method: 'POST', path: '/session/{}/prompt_async' },
		{ method: 'POST', path: '/session/{}/abort' },
		{ method: 'GET', path: '/session/{}/diff' },
		{ method: 'POST', path: '/session/{}/permissions/{}' },
		{ method: 'GET', path: '/provider' },
		{ method: 'GET', path: '/config/providers' },
	] as const,
	supportedProviders: [] as readonly string[],
} as const;
