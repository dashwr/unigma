/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { test } from 'node:test';

const script = resolve(import.meta.dirname, 'audit-service-only.ts');

function audit(executable: string): { readonly status: number; readonly stdout: string; readonly stderr: string } {
	const result = spawnSync(process.execPath, ['--experimental-strip-types', script, '--exe', executable], {
		encoding: 'utf8',
	});
	return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Builds a stand-in for the audited binary. It is a shell script, so the
 * content rule always reports it: no toolchain here can produce a real ELF,
 * and pretending otherwise would test a fixture instead of the rule.
 */
function withFake(body: string, run: (executable: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), 'unigma-service-only-'));
	try {
		const executable = join(root, 'opencode');
		writeFileSync(executable, `#!/bin/sh\n${body}\n`);
		chmodSync(executable, 0o755);
		run(executable);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

/** Refuses everything except --version, which is what the profile should do. */
const WELL_BEHAVED = `
case "$1" in
	--version) echo "1.18.23"; exit 0 ;;
	serve)
		shift
		while [ $# -gt 0 ]; do
			case "$1" in
				--port) shift 2 ;;
				--hostname)
					[ "$2" = "127.0.0.1" ] || exit 2
					shift 2
					;;
				*) exit 2 ;;
			esac
		done
		exit 0
		;;
	*) exit 2 ;;
esac`;

function failures(stdout: string): string[] {
	return stdout
		.split('\n')
		.filter((line) => line.startsWith('failure='))
		.map((line) => line.slice('failure='.length));
}

test('a profile that refuses every removed surface reports only the fixture', () => {
	withFake(WELL_BEHAVED, (executable) => {
		const result = audit(executable);
		const found = failures(result.stdout);
		// The shell stand-in cannot satisfy the ELF rule, and that rule firing
		// is itself the assertion that a wrapper never passes as a binary.
		assert.deepStrictEqual(found, ['binary does not start with the ELF magic']);
		assert.match(result.stdout, /checked=13/);
		assert.match(result.stdout, /service-only=fail/);
		assert.strictEqual(result.status, 1);
	});
});

test('a command D-023 removes is reported by name when it is accepted', () => {
	withFake(
		`
case "$1" in
	--version) echo "1.18.23"; exit 0 ;;
	web) exit 0 ;;
	upgrade) exit 0 ;;
	*) exit 2 ;;
esac`,
		(executable) => {
			const found = failures(audit(executable).stdout);
			assert.ok(found.some((line) => line === 'removed-command web was accepted with status 0'));
			assert.ok(found.some((line) => line === 'removed-command upgrade was accepted with status 0'));
			assert.ok(!found.some((line) => line.includes('removed-command tui')));
		},
	);
});

test('a hostname beyond loopback is a finding even when everything else is refused', () => {
	withFake(
		`
case "$1" in
	--version) echo "1.18.23"; exit 0 ;;
	serve) exit 0 ;;
	*) exit 2 ;;
esac`,
		(executable) => {
			const found = failures(audit(executable).stdout);
			assert.ok(found.some((line) => line.includes('serve --hostname 0.0.0.0 was accepted')));
			assert.ok(found.some((line) => line.includes('serve --hostname :: was accepted')));
			assert.ok(found.some((line) => line.includes('serve --mdns was accepted')));
			assert.ok(found.some((line) => line.includes('serve --cors was accepted')));
		},
	);
});

test('a binary that cannot answer --version is reported instead of assumed working', () => {
	withFake('exit 3', (executable) => {
		const found = failures(audit(executable).stdout);
		assert.ok(found.some((line) => line === 'version --version answered with status 3'));
	});
});

test('the embedded web ui leaves a marker that the audit reads', () => {
	withFake(`${WELL_BEHAVED}\n# opencode-web-ui.gen`, (executable) => {
		const found = failures(audit(executable).stdout);
		assert.ok(found.some((line) => line === 'embedded-ui binary still contains opencode-web-ui.gen'));
	});
});

test('refusal by signal is not read as refusal', () => {
	withFake(
		`
case "$1" in
	--version) echo "1.18.23"; exit 0 ;;
	tui) kill -TERM $$ ;;
	*) exit 2 ;;
esac`,
		(executable) => {
			const found = failures(audit(executable).stdout);
			assert.ok(found.some((line) => line.startsWith('removed-command tui was accepted')));
		},
	);
});

test('malformed arguments are refused', () => {
	const missing = spawnSync(process.execPath, ['--experimental-strip-types', script], { encoding: 'utf8' });
	assert.strictEqual(missing.status, 1);
	assert.match(missing.stderr, /missing --exe/);

	const unexpected = spawnSync(process.execPath, ['--experimental-strip-types', script, 'stray'], {
		encoding: 'utf8',
	});
	assert.strictEqual(unexpected.status, 1);
	assert.match(unexpected.stderr, /unexpected argument stray/);

	const absent = spawnSync(
		process.execPath,
		['--experimental-strip-types', script, '--exe', join(tmpdir(), 'unigma-absent-binary')],
		{ encoding: 'utf8' },
	);
	assert.strictEqual(absent.status, 1);
	assert.match(absent.stderr, /executable not found/);
});
