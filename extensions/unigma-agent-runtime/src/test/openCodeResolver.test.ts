/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { resolveOpenCodeCommand } from '../infrastructure/openCodeResolver';

const candidate = (command: string, exists = true, executable = true) => ({ command, exists, executable });

suite('OpenCode command resolver', () => {
	test('prefers the embedded executable over configured and PATH candidates', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			embedded: candidate('/app/opencode/bin/opencode'),
			configured: candidate('/home/user/opencode'),
			path: candidate('/usr/bin/opencode'),
		}), { kind: 'embedded', command: '/app/opencode/bin/opencode' });
	});

	test('uses the explicit configured candidate when the bundle is absent', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			configured: candidate('/home/user/opencode'),
			path: candidate('/usr/bin/opencode'),
		}), { kind: 'configured', command: '/home/user/opencode' });
	});

	test('uses PATH only when higher-precedence candidates are absent', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({ path: candidate('/usr/bin/opencode') }), { kind: 'path', command: '/usr/bin/opencode' });
	});

	test('does not hide a broken embedded executable with PATH', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			embedded: candidate('/app/opencode/bin/opencode', true, false),
			path: candidate('/usr/bin/opencode'),
		}), { kind: 'unavailable', code: 'embedded-not-executable' });
	});

	test('fails closed when no candidate is executable', () => {
		assert.deepStrictEqual(resolveOpenCodeCommand({
			embedded: candidate('/app/opencode/bin/opencode', false),
			path: candidate('/usr/bin/opencode', true, false),
		}), { kind: 'unavailable', code: 'no-executable-candidate' });
	});
});
