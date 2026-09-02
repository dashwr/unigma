/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getUnigmaAgentInputAction, parseUnigmaAgentInput } from '../../common/agentInput.js';

suite('Unigma agent input parser', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('parses a final @ reference without treating commands as agents', () => {
		assert.deepStrictEqual(parseUnigmaAgentInput('explain this @main', [
			{ id: 'main', name: 'Main agent', description: 'agent', kind: 'command' },
			{ id: 'deploy', name: 'Deploy', description: 'skill', kind: 'skill' },
		]), {
			trigger: 'reference', marker: '@', filter: 'main', text: 'explain this ',
			entries: [],
		});
	});

	test('parses a final / skill and filters sanitized entries', () => {
		assert.deepStrictEqual(parseUnigmaAgentInput('run /build', [
			{ id: 'build', name: 'Build', description: 'build it', kind: 'skill' },
			{ id: 'review', name: 'Review', description: 'review it', kind: 'skill' },
			{ id: 'build', name: 'Build command', description: 'command', kind: 'command' },
		]), {
			trigger: 'command', marker: '/', filter: 'build', text: 'run ',
			entries: [{ id: 'build', name: 'Build', description: 'build it', kind: 'skill' }],
		});
	});

	test('does not trigger when absent, escaped, or not final', () => {
		assert.strictEqual(parseUnigmaAgentInput('plain text'), undefined);
		assert.strictEqual(parseUnigmaAgentInput('escaped \\@agent'), undefined);
		assert.strictEqual(parseUnigmaAgentInput('@agent then text'), undefined);
	});

	test('maps keyboard escape and enter actions without consuming shift-enter', () => {
		assert.strictEqual(getUnigmaAgentInputAction('Escape'), 'dismiss');
		assert.strictEqual(getUnigmaAgentInputAction('Enter'), 'submit');
		assert.strictEqual(getUnigmaAgentInputAction('Enter', true), 'newline');
		assert.strictEqual(getUnigmaAgentInputAction('Tab'), 'none');
	});
});
