/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve(import.meta.dirname, 'measure-baseline.ts');

function run(arguments_: readonly string[]) {
	return spawnSync(process.execPath, ['--experimental-strip-types', script, ...arguments_], { encoding: 'utf8' });
}

/**
 * A file that exists is enough for the argument gate: these cases never reach
 * the measurement itself, and pointing at a real product would make the test
 * depend on a package being built.
 */
function withStandInExecutable(body: (executable: string, root: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		writeFileSync(executable, '');
		body(executable, root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test('refuses to measure without an executable', () => {
	const result = run([]);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /usage: measure-baseline/);
});

test('refuses an executable that is not on disk', () => {
	const result = run(['--exe', join(tmpdir(), 'unigma-absent-executable'), '--scenario', 'clean-profile']);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /executable not found/);
});

test('reports a blocked scenario as absent instead of measuring something else', () => {
	withStandInExecutable((executable, root) => {
		const out = join(root, 'baseline.txt');
		const result = run(['--exe', executable, '--scenario', 'agent-session', '--out', out]);

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /^scenario=agent-session$/m);
		assert.match(result.stdout, /^measured=absent$/m);
		assert.match(result.stdout, /^absent-reason=.+$/m);
		// A blocked scenario must not report a number of any kind, because a
		// reader scanning for medians would take one as a measurement.
		assert.doesNotMatch(result.stdout, /\.median=/);
		assert.equal(readFileSync(out, 'utf8'), result.stdout);
	});
});

test('reports every blocked scenario with its own reason', () => {
	withStandInExecutable(executable => {
		const reasons = new Set<string>();
		for (const scenario of ['agent-session', 'ssh-session']) {
			const result = run(['--exe', executable, '--scenario', scenario]);
			assert.equal(result.status, 0, result.stderr);
			const reason = /^absent-reason=(.+)$/m.exec(result.stdout)?.[1];
			assert.ok(reason, `${scenario} reported no reason`);
			reasons.add(reason);
		}
		// One shared reason would mean the blocked list stopped describing why
		// each scenario is out of reach.
		assert.equal(reasons.size, 2);
	});
});

test('refuses a scenario it does not know', () => {
	withStandInExecutable(executable => {
		const result = run(['--exe', executable, '--scenario', 'whatever']);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /unknown scenario/);
	});
});

test('refuses a repeat count that cannot produce a median', () => {
	withStandInExecutable(executable => {
		for (const repeat of ['0', '-1', '2.5', 'many']) {
			const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', repeat]);
			assert.equal(result.status, 1, `--repeat ${repeat} was accepted`);
			assert.match(result.stderr, /--repeat must be a positive integer/);
		}
	});
});

test('refuses arguments it cannot attribute to an option', () => {
	withStandInExecutable(executable => {
		const stray = run(['--exe', executable, 'clean-profile']);
		assert.equal(stray.status, 1);
		assert.match(stray.stderr, /unexpected argument/);

		const dangling = run(['--exe', executable, '--scenario']);
		assert.equal(dangling.status, 1);
		assert.match(dangling.stderr, /missing value for --scenario/);
	});
});

/**
 * A stand-in for the packaged product: it answers `--status` the way the real
 * one did in run `33950524239` — exit 0, a header, no `Process Info` — and
 * writes a line to `--logsPath` before staying up. That is the shape of the
 * failure the baseline could not diagnose, and reproducing it here is cheap
 * because it needs no package.
 */
function writeStandInProduct(root: string): string {
	const executable = join(root, 'unigma');
	writeFileSync(executable, [
		'#!/usr/bin/env node',
		'const { mkdirSync, writeFileSync } = require("node:fs");',
		'const { join } = require("node:path");',
		'const argv = process.argv.slice(2);',
		'if (argv.includes("--status")) {',
		'\tprocess.stdout.write("Version: stand-in\\nOS Version: stand-in\\nCPUs: 1\\n");',
		'\tprocess.exit(0);',
		'}',
		'const logsPath = (argv.find(a => a.startsWith("--logsPath=")) ?? "").slice("--logsPath=".length);',
		'if (logsPath) {',
		'\tmkdirSync(logsPath, { recursive: true });',
		'\twriteFileSync(join(logsPath, "main.log"), "the stand-in never opened a window\\n");',
		'}',
		'setTimeout(() => { }, 60000);'
	].join('\n') + '\n');
	chmodSync(executable, 0o700);
	return executable;
}

test('a launch that never answers --status carries the product log, not only the stopwatch', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const result = run(['--exe', writeStandInProduct(root), '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '3000']);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /did not answer --status within 3000 ms/);
		assert.match(result.stderr, /launched process still running/);
		assert.match(result.stderr, /product logs: main\.log: the stand-in never opened a window/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('a launch that dies carries the product log too', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const { mkdirSync, writeFileSync } = require("node:fs");',
			'const { join } = require("node:path");',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) { process.stdout.write("Version: stand-in\\n"); process.exit(0); }',
			'const logsPath = (argv.find(a => a.startsWith("--logsPath=")) ?? "").slice("--logsPath=".length);',
			'mkdirSync(logsPath, { recursive: true });',
			'writeFileSync(join(logsPath, "main.log"), "refused the profile\\n");',
			'process.exit(3);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);
		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '10000']);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /exited before it answered --status/);
		assert.match(result.stderr, /product logs: main\.log: refused the profile/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
