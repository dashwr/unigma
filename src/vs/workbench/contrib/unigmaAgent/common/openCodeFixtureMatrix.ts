/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
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
	requiredPaths: ['/global/health', '/doc', '/path', '/event'] as const,
	supportedProviders: [] as readonly string[],
} as const;
