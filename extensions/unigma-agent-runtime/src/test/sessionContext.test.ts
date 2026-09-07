/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { composeSessionContext } from '../application/sessionContext';

const workspaceUri = 'file:///workspace/project';

suite('composeSessionContext', () => {
	test('states the caller and the bound folder without repeating what OpenCode already knows', () => {
		const context = composeSessionContext({ workspaceUri, attachmentCount: 0 });

		assert.ok(context.includes('unigma'));
		assert.ok(context.includes(workspaceUri));
		// OpenCode assembles the environment, the instruction files and the tool
		// list on its own; repeating them here would only spend tokens.
		assert.ok(!context.includes('AGENTS.md'));
		assert.ok(!/\btool\b/i.test(context));
		assert.strictEqual(context.split('\n').length, 2);
	});

	test('names the remote host so paths are never read as local', () => {
		const context = composeSessionContext({ workspaceUri, remoteAuthority: 'ssh-remote+unigma-vps', attachmentCount: 0 });

		assert.ok(context.includes('ssh-remote+unigma-vps'));
		assert.ok(context.includes('remote'));
	});

	test('mentions attachments only when the prompt carries them', () => {
		const none = composeSessionContext({ workspaceUri, attachmentCount: 0 });
		const one = composeSessionContext({ workspaceUri, attachmentCount: 1 });
		const many = composeSessionContext({ workspaceUri, attachmentCount: 3 });

		assert.ok(!none.includes('attachment'));
		assert.ok(one.includes('One attachment'));
		assert.ok(many.includes('3 attachments'));
	});
});
