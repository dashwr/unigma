/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ChatReferenceTransferData } from '../../../../../../platform/dnd/browser/dnd.js';
import { isSelfChatReferenceDrop, resolveChatReferenceDropEntry } from '../../../browser/widget/chatReferenceDrop.js';

suite('ChatDragAndDrop - resolveChatReferenceDropEntry', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	// The opaque *backend* chat URI carried in the payload — the value that ends
	// up on the entry — is deliberately distinct from the *client* resource used
	// only for identity guards.
	const backendResource = 'copilotcli-chat://backend/chat-1';
	const droppedClientResource = 'vscode-chat-session://local/session-a';
	const ownClientResource = 'vscode-chat-session://local/session-b';

	const data: ChatReferenceTransferData = {
		chatResource: backendResource,
		clientResource: droppedClientResource,
		title: 'Design chat',
	};

	test('resolves to a range-less chat-reference entry built from the opaque backend resource and title', () => {
		const chatResource = URI.parse(backendResource);
		assert.deepStrictEqual(
			resolveChatReferenceDropEntry(data, ownClientResource),
			{
				kind: 'chatReference',
				id: `chat-reference:${chatResource.toString()}`,
				name: 'Design chat',
				value: chatResource,
				endTurn: undefined,
				range: undefined,
				_meta: undefined,
			}
		);
	});

	test('a target without a client resource yields no entry', () => {
		assert.strictEqual(resolveChatReferenceDropEntry(data, undefined), undefined);
	});

	test('a self-reference (dropped onto its own input) yields no entry', () => {
		assert.strictEqual(resolveChatReferenceDropEntry(data, droppedClientResource), undefined);
	});

	test('a malformed payload yields no entry rather than throwing', () => {
		// `URI.parse` throws on an illegal scheme even in its non-strict mode, and
		// the `dataTransfer` payload is ultimately untrusted.
		const malformed = 'sch eme:/nope';
		assert.deepStrictEqual(
			{
				badClientResource: resolveChatReferenceDropEntry({ ...data, clientResource: malformed }, ownClientResource),
				badChatResource: resolveChatReferenceDropEntry({ ...data, chatResource: malformed }, ownClientResource),
				badOwnResource: resolveChatReferenceDropEntry(data, malformed),
			},
			{ badClientResource: undefined, badChatResource: undefined, badOwnResource: undefined }
		);
	});
});

suite('ChatDragAndDrop - isSelfChatReferenceDrop', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	// Client (sessions-window) chat resources — the workbench compares these by
	// identity and never parses them.
	const sessionA = 'vscode-chat-session://local/session-a';
	const sessionAPeer = 'vscode-chat-session://local/session-a#peer-1';
	const sessionB = 'vscode-chat-session://local/session-b';

	test('treats a chat dropped onto its own input as a self-reference', () => {
		assert.strictEqual(isSelfChatReferenceDrop(sessionA, sessionA), true);
	});

	test('a peer chat of the same session is not a self-reference', () => {
		assert.strictEqual(isSelfChatReferenceDrop(sessionAPeer, sessionA), false);
	});

	test('a chat from another session is not a self-reference', () => {
		assert.strictEqual(isSelfChatReferenceDrop(sessionB, sessionA), false);
	});
});
