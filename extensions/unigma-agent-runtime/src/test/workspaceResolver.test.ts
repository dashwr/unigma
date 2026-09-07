/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { resolveWorkspace, type WorkspaceHost } from '../infrastructure/workspaceResolver';

const uri = 'file:///workspace/project';
const transportUri = 'vscode-remote://ssh-remote+fixture/workspace/project';
const remote: WorkspaceHost = {
	remoteName: 'ssh-remote',
	remoteAuthority: 'ssh-remote+fixture',
	isWorkspaceHost: true,
	folders: [{ uri, transportUri }],
};

suite('Workspace resolver', () => {
	test('maps the exact remote open folder to its host-local identity', () => {
		assert.deepStrictEqual(resolveWorkspace(transportUri, remote), { uri });
	});

	test('rejects another authority, folder, query, fragment and file shortcut', () => {
		for (const value of [transportUri.replace('+fixture', '+other'), `${transportUri}/child`, `${transportUri}?x`, `${transportUri}#x`, uri]) {
			assert.strictEqual(resolveWorkspace(value, remote), undefined);
		}
	});

	test('rejects a local extension host in a remote window and incomplete host identity', () => {
		for (const host of [
			{ ...remote, isWorkspaceHost: false },
			{ ...remote, remoteAuthority: undefined },
			{ ...remote, remoteAuthority: 'ssh-remote+' },
			{ ...remote, remoteName: undefined },
			{ ...remote, remoteName: 'other' },
		]) {
			assert.strictEqual(resolveWorkspace(transportUri, host), undefined);
		}
	});

	test('keeps local folders local and refuses unopened or remote folders', () => {
		const local: WorkspaceHost = { remoteName: undefined, remoteAuthority: undefined, isWorkspaceHost: false, folders: [{ uri, transportUri: uri }] };
		assert.deepStrictEqual(resolveWorkspace(uri, local), { uri });
		assert.strictEqual(resolveWorkspace(transportUri, local), undefined);
		assert.strictEqual(resolveWorkspace(`${uri}/other`, local), undefined);
	});

	test('rejects virtual folders even when the wire identity matches', () => {
		assert.strictEqual(resolveWorkspace(transportUri, { ...remote, folders: [{ uri: 'virtual:/project', transportUri }] }), undefined);
	});
});
