/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert';
import test from 'node:test';
import { AUTHORIZED, classifyEvent, inspectProvider } from './smoke-opencode-provider.ts';

/**
 * The shape `/provider` actually returned from the pinned binary, reduced to
 * the fields the smoke reads. It was captured with a **deliberately invalid**
 * key, which is the point: this is what "connected" looks like when the
 * credential is worthless.
 */
function providerResponse(overrides: { readonly connected?: string[]; readonly source?: string; readonly models?: string[] } = {}): unknown {
	const models: Record<string, unknown> = {};
	for (const id of overrides.models ?? [AUTHORIZED.model, 'google/gemma-4-31b-it:free']) {
		models[id] = { id, providerID: AUTHORIZED.provider };
	}
	return {
		connected: overrides.connected ?? ['opencode', AUTHORIZED.provider],
		default: {},
		all: [
			{ id: 'subconscious', source: 'custom', env: ['SUBCONSCIOUS_API_KEY'], models: {} },
			{ id: AUTHORIZED.provider, name: 'OpenRouter', source: overrides.source ?? 'env', env: [AUTHORIZED.variable], models }
		]
	};
}

test('the authorised model is recognised in the response the binary really returns', () => {
	const inspected = inspectProvider(providerResponse());
	assert.deepEqual(inspected, { connected: true, sourceIsEnvironment: true, modelPresent: true });
});

test('a provider listed as connected without the authorised model is not a match', () => {
	// The failure that matters most: the free tier drops a model and the run
	// must say so rather than reach for a neighbour.
	const inspected = inspectProvider(providerResponse({ models: ['google/gemma-4-31b-it:free'] }));
	assert.equal(inspected.connected, true);
	assert.equal(inspected.modelPresent, false);
});

test('a credential that did not come from the environment is reported as such', () => {
	// `source` other than `env` means something wrote the credential to disk.
	// The product does not manage credentials, so this has to be visible.
	const inspected = inspectProvider(providerResponse({ source: 'file' }));
	assert.equal(inspected.sourceIsEnvironment, false);
});

test('a response that is not the expected shape yields no false positive', () => {
	for (const value of [undefined, null, 'openrouter', [], {}, { connected: 'openrouter' }]) {
		assert.deepEqual(inspectProvider(value), { connected: false, sourceIsEnvironment: false, modelPresent: false });
	}
});

test('an error from the provider is classified apart from a product failure', () => {
	assert.equal(classifyEvent({ type: 'session.error', properties: { sessionID: 's1' } }, 's1'), 'refused-by-provider');
});

test('events belonging to another session are ignored', () => {
	// A single OpenCode process can hold more than one session; concluding from
	// somebody else's event would report an answer this smoke never received.
	assert.equal(classifyEvent({ type: 'session.idle', properties: { sessionID: 'other' } }, 's1'), undefined);
	assert.equal(classifyEvent({ type: 'session.error', properties: { sessionID: 'other' } }, 's1'), undefined);
});

test('message parts count as progress, and idle is the terminal event', () => {
	assert.equal(classifyEvent({ type: 'message.part.updated', properties: { sessionID: 's1' } }, 's1'), 'progress');
	assert.equal(classifyEvent({ type: 'message.updated', properties: { sessionID: 's1' } }, 's1'), 'progress');
	assert.equal(classifyEvent({ type: 'session.idle', properties: { sessionID: 's1' } }, 's1'), 'answered');
});

test('an event without a session id is not attributed to this session', () => {
	// `server.connected` carries no sessionID; it must not end the wait.
	assert.equal(classifyEvent({ type: 'server.connected' }, 's1'), undefined);
});

test('the authorised pair is an exact id, with no alias and no fallback', () => {
	assert.equal(AUTHORIZED.provider, 'openrouter');
	assert.match(AUTHORIZED.model, /^[a-z0-9-]+\/[^/]+:free$/);
	assert.equal(AUTHORIZED.variable, 'OPENROUTER_API_KEY');
});
