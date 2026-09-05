/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { observedExitCodes, sanitizedEvidenceLines, type Observations } from './remote-window-evidence.ts';

const NOTHING_OBSERVED: Observations = {
	resolverSuccess: false,
	resolverError: false,
	resolvedAuthorityConsumed: false,
	connectionTokenHandshake: false,
	trustBlocked: false,
	tokenFailure: false,
	extensionHostHandshake: false
};

/**
 * A workbench log that failed, written the way a real one is: the contract
 * words are surrounded by the host, the account, both filesystems and the
 * stderr of the remote shell. Every line here except the vocabulary is
 * material that must never reach a published artifact.
 */
const HOSTILE_LOG = [
	'[2026-09-04 03:11:02.114] [renderer] connecting to ssh-remote+unigma-vps',
	'ssh: connect to host 203.0.113.47 port 22: Connection refused',
	'debug1: /home/dasher/.ssh/config line 12: Applying options for unigma-vps',
	'root@203.0.113.47: Permission denied (publickey).',
	'[handshake] ssh.remote-server-unavailable reason=missing-version exit=255',
	'staging dir /root/.unigma-server/bin/471d84ad9e72 not found',
	'Error: EACCES: permission denied, open \'/home/dasher/projects/secret-client/.env\''
].join('\n');

describe('remote window evidence', () => {
	it('publishes contract vocabulary and nothing else from a hostile log', () => {
		const lines = sanitizedEvidenceLines(NOTHING_OBSERVED, true, HOSTILE_LOG);
		const text = lines.join('\n');

		assert.ok(lines.includes('observed=ssh.remote-server-unavailable'));
		assert.ok(lines.includes('observed-phase=handshake'));
		assert.ok(lines.includes('observed-reason=missing-version'));
		assert.ok(lines.includes('observed-exit=255'));

		for (const secret of ['203.0.113.47', 'dasher', 'root@', '.ssh/config', 'secret-client', '.env', 'Permission denied', 'publickey', '471d84ad9e72']) {
			assert.ok(!text.includes(secret), `evidence leaked ${secret}`);
		}
	});

	it('emits one line per observation and never invents an absent one', () => {
		const lines = sanitizedEvidenceLines(NOTHING_OBSERVED, true, HOSTILE_LOG);

		// Every published line must be a whole line of allowed shape, so a
		// partial match cannot smuggle a suffix past the assertions above.
		for (const line of lines) {
			assert.match(line, /^(observed=ssh\.[a-z-]+|observed-phase=[a-z-]+|observed-reason=[a-z-]+|observed-exit=\d{1,3}|category=ssh\.[a-z-]+)$/);
		}

		assert.ok(!lines.some(line => line.startsWith('remote ExtensionHost handshake')));
		assert.ok(!lines.some(line => line.includes('returned after')));
	});

	it('reports the two consumption categories only when the resolver was attempted', () => {
		const attempted = sanitizedEvidenceLines(NOTHING_OBSERVED, true, '');
		assert.deepStrictEqual([...attempted], ['category=ssh.resolved-authority-consumed', 'category=ssh.connection-token-handshake']);

		// Without an attempt there is nothing to say: a missing handshake is not
		// a failed handshake, and reporting it as one would make every skipped
		// run look like a broken one.
		assert.deepStrictEqual([...sanitizedEvidenceLines(NOTHING_OBSERVED, false, '')], []);
	});

	it('says unknown instead of guessing a duration it did not read', () => {
		const lines = sanitizedEvidenceLines({ ...NOTHING_OBSERVED, resolverSuccess: true, resolvedAuthorityConsumed: true, connectionTokenHandshake: true, extensionHostHandshake: true }, true, '');

		assert.ok(lines.includes('resolveAuthority(ssh-remote) returned after unknown ms'));
		assert.ok(lines.includes('remote ExtensionHost handshake finished after unknown ms'));
	});

	it('takes only a bounded number as an exit status', () => {
		assert.deepStrictEqual([...observedExitCodes('exit=255 exit=1')], ['1', '255']);
		assert.deepStrictEqual([...observedExitCodes('exit=255 exit=255')], ['255']);

		// A longer run of digits is not an exit status, and a word is not a
		// number: both would be host-chosen text riding on a trusted key.
		assert.deepStrictEqual([...observedExitCodes('exit=1234')], []);
		assert.deepStrictEqual([...observedExitCodes('exit=/home/dasher')], []);
		assert.deepStrictEqual([...observedExitCodes('unexpected=255')], []);
	});
});
