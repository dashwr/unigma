/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { AgentApplication } from '../../common/agentApplication.js';
import { evaluateLocalIntegration } from '../../common/localIntegrationPolicy.js';
import { OPENCODE_FIXTURE_MATRIX } from '../../common/openCodeFixtureMatrix.js';

test('application produces DuplicateRequestId and SessionNotFound without command contents', () => {
	const application = new AgentApplication();

	const missing = application.accept({ requestId: 'request-missing', type: 'input', sessionId: 'missing-session' });
	assert.deepEqual(missing, { accepted: false, error: { code: 'sessionNotFound', message: 'The requested session is not available.', retryable: false } });

	const duplicate = application.accept({ requestId: 'request-missing', type: 'input', sessionId: 'missing-session' });
	assert.deepEqual(duplicate, { accepted: false, error: { code: 'duplicateRequestId', message: 'This request was already handled.', retryable: false } });
});

test('application registers, removes, and retries sessions with a new requestId', () => {
	const application = new AgentApplication();
	application.registerSession('session-1');
	assert.deepEqual(application.accept({ requestId: 'request-1', type: 'input', sessionId: 'session-1' }), { accepted: true });
	application.removeSession('session-1');
	assert.deepEqual(application.accept({ requestId: 'request-2', type: 'input', sessionId: 'session-1' }), { accepted: false, error: { code: 'sessionNotFound', message: 'The requested session is not available.', retryable: false } });
	application.registerSession('session-1');
	assert.deepEqual(application.accept({ requestId: 'request-3', type: 'input', sessionId: 'session-1' }), { accepted: true });
});

test('application accepts one concurrent requestId', async () => {
	const application = new AgentApplication();
	const results = await Promise.all(Array.from({ length: 4 }, () => Promise.resolve(application.accept({ requestId: 'request-1', type: 'start' }))));
	assert.deepEqual(results.filter(result => result.accepted), [{ accepted: true }]);
	assert.strictEqual(results.filter(result => !result.accepted).length, 3);
});

test('local MCP, plugin, and rule gates refuse untrusted or invalid input', () => {
	const base = {
		workspaceTrusted: true,
		approved: true,
		path: 'insideWorkspace' as const,
		schema: 'valid' as const,
		command: 'directExecutable' as const,
		dependency: 'none' as const,
		url: 'notApplicable' as const,
		oauth: 'notApplicable' as const,
		precedence: 'explained' as const,
	};
	for (const [kind, origin] of [
		['mcp', 'workspaceConfiguration'],
		['plugin', 'workspacePluginDirectory'],
		['rule', 'workspaceRule'],
	] as const) {
		const metadata = { kind, origin, path: 'insideWorkspace', approval: 'approved' } as const;
		assert.deepEqual(evaluateLocalIntegration({ ...base, kind, origin, workspaceTrusted: false }), { accepted: false, code: 'workspaceUntrusted', metadata: { ...metadata, approval: 'approved' } });
		assert.deepEqual(evaluateLocalIntegration({ ...base, kind, origin, schema: 'invalid' }), { accepted: false, code: 'configurationInvalid', metadata });
	}
});

test('fixture matrix has an explicit transport and no supported provider', () => {
	assert.deepEqual(OPENCODE_FIXTURE_MATRIX.requiredProbes, [
		{ method: 'GET', path: '/doc' },
	]);
	assert.deepEqual(OPENCODE_FIXTURE_MATRIX.requiredOperations, [
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
	]);
	assert.deepEqual(OPENCODE_FIXTURE_MATRIX.supportedProviders, []);
});
