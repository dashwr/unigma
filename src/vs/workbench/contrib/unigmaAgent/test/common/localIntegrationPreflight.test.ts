/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { McpServerType } from '../../../../../platform/mcp/common/mcpPlatformTypes.js';
import { LocalMcpServerScope } from '../../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { evaluateWorkbenchLocalIntegrationPreflight, evaluateWorkbenchMcpPreflight, type WorkbenchLocalIntegrationSource, type WorkbenchMcpIntegrationSource } from '../../common/localIntegrationPreflight.js';

function source(overrides: Partial<WorkbenchMcpIntegrationSource> = {}): WorkbenchMcpIntegrationSource {
	return {
		name: 'demo',
		scope: LocalMcpServerScope.Workspace,
		config: { type: McpServerType.LOCAL, command: 'node' },
		location: URI.file('/workspace/.vscode/mcp.json'),
		approved: true,
		...overrides,
	};
}

function localSource(overrides: Partial<WorkbenchLocalIntegrationSource> = {}): WorkbenchLocalIntegrationSource {
	return {
		kind: 'plugin',
		name: 'demo-plugin',
		origin: 'workspacePluginDirectory',
		path: 'insideWorkspace',
		schema: 'valid',
		command: 'none',
		dependency: 'none',
		url: 'notApplicable',
		oauth: 'notApplicable',
		approved: true,
		...overrides,
	};
}

suite('Workbench local integration preflight', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('accepts an approved direct workspace MCP', () => {
		assert.deepStrictEqual(evaluateWorkbenchMcpPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [source()],
		}), { accepted: true });
	});

	test('rejects an untrusted workspace', () => {
		assert.deepStrictEqual(evaluateWorkbenchMcpPreflight({
			workspaceTrusted: false,
			workspaceUri: URI.file('/workspace'),
			servers: [source()],
		}), { accepted: false, code: 'workspaceUntrusted' });
	});

	test('rejects a server without explicit approval', () => {
		assert.deepStrictEqual(evaluateWorkbenchMcpPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [source({ approved: false })],
		}), { accepted: false, code: 'permissionDenied' });
	});

	test('covers explicitly approved local plugins and rules', () => {
		assert.deepStrictEqual(evaluateWorkbenchLocalIntegrationPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [],
			sources: [localSource()],
		}), { accepted: true });
		assert.deepStrictEqual(evaluateWorkbenchLocalIntegrationPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [],
			sources: [localSource({ kind: 'rule', name: 'workspace-rule', origin: 'workspaceRule' })],
		}), { accepted: true });
	});

	test('rejects unsafe plugin and rule source classifications', () => {
		assert.deepStrictEqual(evaluateWorkbenchLocalIntegrationPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [],
			sources: [localSource({ dependency: 'npmPackage' })],
		}), { accepted: false, code: 'npmPlugin' });
		assert.deepStrictEqual(evaluateWorkbenchLocalIntegrationPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [],
			sources: [localSource({ kind: 'rule', origin: 'remote', name: 'remote-rule' })],
		}), { accepted: false, code: 'unknownOrigin' });
	});

	test('rejects startup when plugin and rule inventory is incomplete', () => {
		assert.deepStrictEqual(evaluateWorkbenchLocalIntegrationPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [source()],
			sourceInventoryComplete: false,
		}), { accepted: false, code: 'unknownOrigin' });
	});

	test('rejects installer commands', () => {
		assert.deepStrictEqual(evaluateWorkbenchMcpPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [source({ config: { type: McpServerType.LOCAL, command: 'npx', args: ['-y', 'server'] } })],
		}), { accepted: false, code: 'installerCommand' });
	});

	test('rejects remote-user precedence and duplicate names', () => {
		assert.deepStrictEqual(evaluateWorkbenchMcpPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [source({ scope: LocalMcpServerScope.RemoteUser })],
		}), { accepted: false, code: 'unknownOrigin' });
		assert.deepStrictEqual(evaluateWorkbenchMcpPreflight({
			workspaceTrusted: true,
			workspaceUri: URI.file('/workspace'),
			servers: [source(), source({ scope: LocalMcpServerScope.User })],
		}), { accepted: false, code: 'ambiguousPrecedence' });
	});
});
