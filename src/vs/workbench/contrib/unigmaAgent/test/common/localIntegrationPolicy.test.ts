/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { evaluateLocalIntegration, type LocalIntegrationRequest } from '../../common/localIntegrationPolicy.js';

const localMcp: LocalIntegrationRequest = {
	kind: 'mcp',
	workspaceTrusted: true,
	approved: true,
	origin: 'workspaceConfiguration',
	path: 'insideWorkspace',
	schema: 'valid',
	command: 'directExecutable',
	dependency: 'none',
	url: 'notApplicable',
	oauth: 'notApplicable',
	precedence: 'explained',
};

test('preflight accepts approved local MCP, plugin, rule, and loopback MCP metadata', () => {
	assert.deepEqual(evaluateLocalIntegration(localMcp), {
		accepted: true,
		metadata: { kind: 'mcp', origin: 'workspaceConfiguration', path: 'insideWorkspace', approval: 'approved' },
	});

	assert.equal(evaluateLocalIntegration({ ...localMcp, kind: 'plugin', origin: 'workspacePluginDirectory', command: 'none' }).accepted, true);
	assert.equal(evaluateLocalIntegration({ ...localMcp, kind: 'rule', origin: 'workspaceRule', command: 'none' }).accepted, true);
	assert.equal(evaluateLocalIntegration({ ...localMcp, command: 'none', url: 'loopbackHttp', oauth: 'none' }).accepted, true);
});

test('preflight refuses deterministic unsafe facts without returning configuration', () => {
	const cases: ReadonlyArray<readonly [Partial<LocalIntegrationRequest>, string]> = [
		[{ workspaceTrusted: false }, 'workspaceUntrusted'],
		[{ origin: 'unknown' }, 'unknownOrigin'],
		[{ origin: 'remote' }, 'unknownOrigin'],
		[{ precedence: 'ambiguous' }, 'ambiguousPrecedence'],
		[{ path: 'outsideApprovedScope' }, 'pathOutsideApprovedScope'],
		[{ path: 'externalSymlink' }, 'externalSymlink'],
		[{ schema: 'invalid' }, 'configurationInvalid'],
		[{ command: 'installer' }, 'installerCommand'],
		[{ kind: 'plugin', origin: 'workspacePluginDirectory', command: 'none', dependency: 'npmPackage' }, 'npmPlugin'],
		[{ dependency: 'startupInstall' }, 'startupInstallation'],
		[{ command: 'none', url: 'insecure', oauth: 'none' }, 'insecureUrl'],
		[{ command: 'none', url: 'https', oauth: 'silent' }, 'silentOAuth'],
		[{ approved: false }, 'permissionDenied'],
	];

	for (const [change, code] of cases) {
		const decision = evaluateLocalIntegration({ ...localMcp, ...change });
		assert.equal(decision.accepted, false);
		if (!decision.accepted) {
			assert.equal(decision.code, code);
			assert.deepEqual(Object.keys(decision.metadata).sort(), ['approval', 'kind', 'origin', 'path']);
		}
	}
});
