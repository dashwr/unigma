/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import { REMOTE_SSH_AUTHORITY_PREFIX, parseRemoteSshAuthority } from '../remoteSshAuthority.js';
import { renderRemoteSshTarget } from '../remoteSshTarget.js';

test('exposes the authority prefix fixed by the contract', () => {
	assert.equal(REMOTE_SSH_AUTHORITY_PREFIX, 'ssh-remote');
});

test('accepts an ssh_config alias', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+build-vps'), {
		ok: true,
		target: { kind: 'alias', alias: 'build-vps' }
	});
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+vps01'), {
		ok: true,
		target: { kind: 'alias', alias: 'vps01' }
	});
});

test('reports a bare token as an alias, leaving ssh_config resolution to OpenSSH', () => {
	// `build.example.com` may be a Host entry or a plain hostname; this module
	// must not resolve it, so it stays an opaque alias.
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+build.example.com'), {
		ok: true,
		target: { kind: 'alias', alias: 'build.example.com' }
	});
});

test('accepts canonical user@host:port targets', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy@build.example.com:2222'), {
		ok: true,
		target: { kind: 'canonical', user: 'deploy', host: 'build.example.com', port: 2222 }
	});
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy@build.example.com'), {
		ok: true,
		target: { kind: 'canonical', user: 'deploy', host: 'build.example.com' }
	});
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy@203.0.113.7'), {
		ok: true,
		target: { kind: 'canonical', user: 'deploy', host: '203.0.113.7' }
	});
});

test('accepts a bracketed IPv6 literal with and without a port', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy@[2001:db8::1]:22'), {
		ok: true,
		target: { kind: 'canonical', user: 'deploy', host: '2001:db8::1', port: 22 }
	});
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+[2001:db8::1]'), {
		ok: true,
		target: { kind: 'canonical', host: '2001:db8::1' }
	});
});

test('decodes a percent-encoded target exactly once', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy%40build.example.com%3A2222'), {
		ok: true,
		target: { kind: 'canonical', user: 'deploy', host: 'build.example.com', port: 2222 }
	});
});

test('rejects an absent, empty or foreign authority', () => {
	assert.deepEqual(parseRemoteSshAuthority(undefined), { ok: false, rejection: 'authority-empty' });
	assert.deepEqual(parseRemoteSshAuthority(''), { ok: false, rejection: 'authority-empty' });
	assert.deepEqual(parseRemoteSshAuthority(42), { ok: false, rejection: 'authority-empty' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote'), { ok: false, rejection: 'authority-prefix-mismatch' });
	assert.deepEqual(parseRemoteSshAuthority('test+host'), { ok: false, rejection: 'authority-prefix-mismatch' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+'), { ok: false, rejection: 'target-empty' });
});

test('rejects a target that OpenSSH would read as an option', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+-oStrictHostKeyChecking%3Dno'), { ok: false, rejection: 'target-option-like' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+-J%20jump'), { ok: false, rejection: 'target-option-like' });
});

test('rejects shell, whitespace and control characters', () => {
	for (const target of [
		'ssh-remote+host%20-oProxyCommand%3Dfoo',
		'ssh-remote+host%3Bid',
		'ssh-remote+host%26%26id',
		'ssh-remote+host%7Cid',
		'ssh-remote+host%60id%60',
		'ssh-remote+host%24(id)',
		'ssh-remote+host%0Aid',
		'ssh-remote+host%00',
		'ssh-remote+host%2Fpath',
		'ssh-remote+host%5Cshare'
	]) {
		assert.deepEqual(parseRemoteSshAuthority(target), { ok: false, rejection: 'target-unsafe-character' }, target);
	}
});

test('rejects material that would smuggle a secret into the authority', () => {
	// `user:password@host` is a URI shape the contract forbids: the authority
	// identifies a connection and never carries a credential.
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy%3Ahunter2@example.com'), { ok: false, rejection: 'target-user-invalid' });
});

test('rejects malformed percent encoding', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+host%ZZ'), { ok: false, rejection: 'target-encoding-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+host%'), { ok: false, rejection: 'target-encoding-invalid' });
});

test('rejects a malformed shape, user, host or port', () => {
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+a@b@c'), { ok: false, rejection: 'target-shape-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+.alias'), { ok: false, rejection: 'target-shape-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+@example.com'), { ok: false, rejection: 'target-user-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy@'), { ok: false, rejection: 'target-host-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+deploy@-example.com'), { ok: false, rejection: 'target-host-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+2001:db8::1'), { ok: false, rejection: 'target-host-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+example.com:0'), { ok: false, rejection: 'target-port-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+example.com:70000'), { ok: false, rejection: 'target-port-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+example.com:022'), { ok: false, rejection: 'target-port-invalid' });
	assert.deepEqual(parseRemoteSshAuthority('ssh-remote+example.com:ssh'), { ok: false, rejection: 'target-port-invalid' });
});

test('rejects an oversized authority before decoding it', () => {
	assert.deepEqual(parseRemoteSshAuthority(`ssh-remote+${'a'.repeat(256)}`), { ok: false, rejection: 'target-too-long' });
});

test('never returns anything beyond the parsed identifier', () => {
	const parsed = parseRemoteSshAuthority('ssh-remote+deploy@build.example.com:2222');
	assert.equal(parsed.ok, true);
	assert.deepEqual(Object.keys(parsed), ['ok', 'target']);
});

test('renders aliases as the exact OpenSSH destination argument', () => {
	assert.equal(renderRemoteSshTarget({ kind: 'alias', alias: 'build-vps' }), 'build-vps');
	assert.equal(renderRemoteSshTarget({ kind: 'canonical', user: 'deploy', host: 'build.example.com', port: 2222 }), 'deploy@build.example.com:2222');
	assert.equal(renderRemoteSshTarget({ kind: 'canonical', host: '2001:db8::1', port: 22 }), '[2001:db8::1]:22');
});
