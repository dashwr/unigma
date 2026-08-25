/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { WorkspaceStateSessionReferenceStore } from '../infrastructure/sessionReferenceStore';

class MemoryState {
	private readonly values = new Map<string, unknown>();

	public get<T>(key: string): T | undefined {
		return this.values.get(key) as T | undefined;
	}

	public async update(key: string, value: unknown): Promise<void> {
		if (value === undefined) {
			this.values.delete(key);
		} else {
			this.values.set(key, value);
		}
	}
}

suite('Unigma agent session reference store', () => {
	test('isolates, validates, and removes references by workspace', async () => {
		const state = new MemoryState();
		const store = new WorkspaceStateSessionReferenceStore(state);
		const firstWorkspace = { uri: 'file:///tmp/one' };
		const secondWorkspace = { uri: 'file:///tmp/two' };

		await store.write({ sessionId: 'session-one', workspaceUri: firstWorkspace.uri });
		assert.deepStrictEqual(await store.read(firstWorkspace), { sessionId: 'session-one', workspaceUri: firstWorkspace.uri });
		assert.strictEqual(await store.read(secondWorkspace), undefined);

		await store.remove(firstWorkspace);
		assert.strictEqual(await store.read(firstWorkspace), undefined);

		await assert.rejects(
			store.write({ sessionId: 'session-two', workspaceUri: secondWorkspace.uri, prompt: 'must not persist' } as never),
			/invalid/,
		);
	});

	test('ignores persisted values with extra fields or another workspace', async () => {
		const state = new MemoryState();
		const store = new WorkspaceStateSessionReferenceStore(state);
		const workspace = { uri: 'file:///tmp/one' };

		await state.update('unigma.agent.session.file%3A%2F%2F%2Ftmp%2Fone', {
			sessionId: 'session-one',
			workspaceUri: workspace.uri,
			extra: 'not allowed',
		});
		assert.strictEqual(await store.read(workspace), undefined);

		await state.update('unigma.agent.session.file%3A%2F%2F%2Ftmp%2Fone', {
			sessionId: 'session-two',
			workspaceUri: 'file:///tmp/two',
		});
		assert.strictEqual(await store.read(workspace), undefined);
	});
});
