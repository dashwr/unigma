/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	openSshProbeEnv,
	parseOpenSshVersion,
	probeOpenSshClient,
	type OpenSshVersionRun
} from '../openSshClient.js';

function runner(result: OpenSshVersionRun) {
	return async () => result;
}

test('parses the portable OpenSSH banner', () => {
	assert.deepEqual(parseOpenSshVersion('OpenSSH_10.5p1, OpenSSL 3.6.3 9 Jun 2026'), {
		major: 10,
		minor: 5,
		portable: 'p1',
		banner: 'OpenSSH_10.5p1'
	});
});

test('parses the Windows and non-portable banners', () => {
	assert.deepEqual(parseOpenSshVersion('OpenSSH_for_Windows_9.5p1, LibreSSL 3.8.2'), {
		major: 9,
		minor: 5,
		portable: 'p1',
		banner: 'OpenSSH_for_Windows_9.5p1'
	});
	assert.deepEqual(parseOpenSshVersion('OpenSSH_9.9, LibreSSL 3.9.0'), {
		major: 9,
		minor: 9,
		banner: 'OpenSSH_9.9'
	});
});

test('retains only the OpenSSH token, never the rest of the banner', () => {
	const version = parseOpenSshVersion('OpenSSH_10.5p1, OpenSSL 3.6.3 9 Jun 2026');
	assert.equal(version?.banner.includes('OpenSSL'), false);
	assert.deepEqual(Object.keys(version!).sort(), ['banner', 'major', 'minor', 'portable']);
});

test('does not recognise a non-OpenSSH client', () => {
	assert.equal(parseOpenSshVersion('Dropbear v2022.83'), undefined);
	assert.equal(parseOpenSshVersion('plink: Release 0.80'), undefined);
	assert.equal(parseOpenSshVersion(''), undefined);
});

test('reports the client as available from the stderr banner', async () => {
	const probe = await probeOpenSshClient(runner({ status: 'ok', stdout: '', stderr: 'OpenSSH_10.5p1, OpenSSL 3.6.3 9 Jun 2026\n' }));
	assert.deepEqual(probe, { available: true, version: { major: 10, minor: 5, portable: 'p1', banner: 'OpenSSH_10.5p1' } });
});

test('falls back to stdout when a build prints the banner there', async () => {
	const probe = await probeOpenSshClient(runner({ status: 'ok', stdout: 'OpenSSH_9.6p1\n', stderr: '' }));
	assert.equal(probe.available, true);
});

test('fails closed for every unavailable outcome', async () => {
	for (const status of ['not-found', 'not-executable', 'timed-out'] as const) {
		assert.deepEqual(await probeOpenSshClient(runner({ status })), { available: false, reason: status });
	}
	assert.deepEqual(
		await probeOpenSshClient(runner({ status: 'ok', stdout: '', stderr: 'Dropbear v2022.83' })),
		{ available: false, reason: 'unrecognized-implementation' }
	);
	assert.deepEqual(
		await probeOpenSshClient(runner({ status: 'ok', stdout: '', stderr: '' })),
		{ available: false, reason: 'unrecognized-implementation' }
	);
});

test('the probe environment carries only executable lookup entries', () => {
	const env = openSshProbeEnv({
		PATH: '/usr/bin',
		PATHEXT: '.EXE',
		SystemRoot: 'C:\\Windows',
		SSH_AUTH_SOCK: '/run/agent.sock',
		SSH_ASKPASS: '/usr/bin/askpass',
		GITHUB_TOKEN: 'must-not-be-copied',
		AWS_SECRET_ACCESS_KEY: 'must-not-be-copied',
		HOME: '/home/user'
	});

	assert.deepEqual(env, { PATH: '/usr/bin', PATHEXT: '.EXE', SystemRoot: 'C:\\Windows' });
	assert.equal(Object.values(env).includes('must-not-be-copied'), false);
});

test('the probe environment stays empty when nothing is allowlisted', () => {
	assert.deepEqual(openSshProbeEnv({ SSH_AUTH_SOCK: '/run/agent.sock' }), {});
});
