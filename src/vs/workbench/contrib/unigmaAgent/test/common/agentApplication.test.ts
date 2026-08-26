/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
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

test('application accepts a registered session', () => {
	const application = new AgentApplication();
	application.registerSession('session-1');
	assert.deepEqual(application.accept({ requestId: 'request-1', type: 'input', sessionId: 'session-1' }), { accepted: true });
});

test('local MCP, plugin, and rule gates refuse untrusted or invalid input', () => {
	for (const kind of ['mcp', 'plugin', 'rule'] as const) {
		assert.deepEqual(evaluateLocalIntegration({ kind, workspaceTrusted: false, approved: true, configurationValid: true }), { accepted: false, code: 'workspaceUntrusted' });
		assert.deepEqual(evaluateLocalIntegration({ kind, workspaceTrusted: true, approved: true, configurationValid: false }), { accepted: false, code: 'configurationInvalid' });
	}
});

test('fixture matrix has an explicit transport and no supported provider', () => {
	assert.deepEqual(OPENCODE_FIXTURE_MATRIX.requiredPaths, ['/global/health', '/doc', '/path', '/event']);
	assert.deepEqual(OPENCODE_FIXTURE_MATRIX.supportedProviders, []);
});
