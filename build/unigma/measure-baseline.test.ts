/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
		assert.match(result.stderr, /did not report a renderer within 3000 ms/);
		assert.match(result.stderr, /roles seen: none/);
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

/**
 * The process table `--status` really prints, copied from run `34036136102`.
 * The header is the product's own, not the `Process Info` string the harness
 * used to look for, and the names are the ones the product uses rather than the
 * module names. Keeping the real shape here is what makes this a regression
 * test: the previous harness could not succeed against it.
 */
const REAL_STATUS_TABLE = [
	'Version:          unigma 1.134.0',
	'OS Version:       Linux x64 6.6.0',
	'CPUs:             stand-in (8 x 2400)',
	'',
	'CPU %\tMem MB\t   PID\tProcess',
	'    0\t   412\t 20262\tunigma',
	'    0\t    18\t 20263\t     zygote',
	'    3\t   289\t 20424\twindow [1] (unigma)',
	'    0\t    41\t 20323\t   utility-network-service',
	'    1\t   142\t 20480\tshared-process',
	'    0\t    33\t 20481\tfile-watcher [1]',
	'    2\t   198\t 20510\textension-host [1]'
].join('\n');

test('a product that answers --status the way the real one does is measured', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma', commit: 'stand-in-commit' }));
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) {',
			`\tprocess.stdout.write(${JSON.stringify(REAL_STATUS_TABLE)} + "\\n");`,
			'\tprocess.exit(0);',
			'}',
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const out = join(root, 'report.txt');
		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '20000', '--out', out]);
		assert.equal(result.status, 0, result.stderr);
		const report = readFileSync(out, 'utf8');

		assert.match(report, /commit=stand-in-commit/);
		assert.match(report, /application-name=unigma/);
		assert.match(report, /ready-ms\.median=[0-9]+/);
		// Every role the real table contains has to be found, and the main
		// process is the row named after applicationName rather than "main".
		for (const role of ['main', 'renderer', 'extension-host', 'shared-process', 'file-watcher']) {
			assert.ok(report.includes(`process.${role}.present=yes`), `${role} missing from:\n${report}`);
		}
		assert.match(report, /process\.pty-host\.present=no/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('the report publishes memory when the processes fit in the machine', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma' }));
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) {',
			`\tprocess.stdout.write(${JSON.stringify(REAL_STATUS_TABLE)} + "\\n");`,
			'\tprocess.exit(0);',
			'}',
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const out = join(root, 'report.txt');
		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '20000', '--out', out]);
		assert.equal(result.status, 0, result.stderr);
		const report = readFileSync(out, 'utf8');

		assert.doesNotMatch(report, /^memory=unreported/m);
		assert.match(report, /process\.main\.memory-mb\.median=412/);
		assert.match(report, /process\.renderer\.memory-mb\.median=289/);
		// zygote and utility-network-service have no role of their own and must
		// still be visible rather than silently dropped from the totals.
		assert.match(report, /process\.other\.present=yes/);
		assert.match(report, /process\.other\.memory-mb\.median=59/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('a product whose window never comes up is not measured, and says how far it got', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma' }));
		// The shape of run 34043447622: the main process answers, the window is
		// not there yet. Returning here is what made that run report
		// renderer.present=no while calling itself a startup baseline.
		const withoutWindow = [
			'CPU %\tMem MB\t   PID\tProcess',
			'    4\t   412\t 20262\tunigma',
			'    0\t   142\t 20480\tshared-process'
		].join('\n');
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) {',
			`\tprocess.stdout.write(${JSON.stringify(withoutWindow)} + "\\n");`,
			'\tprocess.exit(0);',
			'}',
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '3000']);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /did not report a renderer within 3000 ms/);
		assert.match(result.stderr, /roles seen: main, shared-process/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('the report states which event ready-ms measures', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma' }));
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) {',
			`\tprocess.stdout.write(${JSON.stringify(REAL_STATUS_TABLE)} + "\\n");`,
			'\tprocess.exit(0);',
			'}',
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const out = join(root, 'report.txt');
		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '20000', '--out', out]);
		assert.equal(result.status, 0, result.stderr);
		const report = readFileSync(out, 'utf8');
		assert.match(report, /ready-definition=first --status reporting a renderer row/);
		// The resolution has to be measured, not the sleep constant echoed back:
		// each probe relaunches the executable, which costs more than the sleep.
		const resolution = Number(/ready-resolution-ms=([0-9]+)/.exec(report)?.[1]);
		assert.ok(resolution > 0, `resolution not observed in:\n${report}`);
		assert.match(report, /ready-ms\.note=overstates by at most one probe interval/);
		// The shape of the sample, not only its width: a spread hides whether the
		// runs clustered, and the probe count is the quantisation made visible.
		assert.match(report, /ready-ms\.min=[0-9]+/);
		assert.match(report, /ready-ms\.max=[0-9]+/);
		assert.match(report, /ready-probes\.min=[0-9]+/);
		assert.match(report, /ready-probes\.max=[0-9]+/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('memory is refused when the processes do not fit in the machine', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma' }));
		// The shape the double conversion produced: eleven-digit "megabytes".
		const impossible = [
			'CPU %\tMem MB\t   PID\tProcess',
			'    0\t1463166029\t 20262\tunigma',
			'    3\t32189652638\t 20424\twindow [1] (unigma)'
		].join('\n');
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) {',
			`\tprocess.stdout.write(${JSON.stringify(impossible)} + "\\n");`,
			'\tprocess.exit(0);',
			'}',
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const out = join(root, 'report.txt');
		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '20000', '--out', out]);
		assert.equal(result.status, 0, result.stderr);
		const report = readFileSync(out, 'utf8');

		assert.match(report, /^memory=unreported: .*more than the .* MB this machine has/m);
		assert.doesNotMatch(report, /process\..*memory-mb/);
		// CPU and presence survive a refused memory column.
		assert.match(report, /process\.renderer\.cpu-percent\.median=3/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('a failed measurement writes the reason into the evidence file too', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma' }));
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) { process.stdout.write("Version: stand-in\\n"); process.exit(0); }',
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const out = join(root, 'report.txt');
		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '3000', '--out', out]);
		assert.equal(result.status, 1);
		// The CI log is not where a baseline is read from later; the uploaded
		// evidence has to say a measurement was attempted and why it did not
		// happen, in the same shape a blocked scenario uses.
		const report = readFileSync(out, 'utf8');
		assert.match(report, /^scenario=clean-profile$/m);
		assert.match(report, /^measured=absent$/m);
		assert.match(report, /^absent-reason=.*did not report a renderer/m);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('the launch disables the trust dialog, which would hold startup under Xvfb', () => {
	const root = mkdtempSync(join(tmpdir(), 'unigma-baseline-test-'));
	try {
		const executable = join(root, 'unigma');
		const seen = join(root, 'args.txt');
		mkdirSync(join(root, 'resources', 'app'), { recursive: true });
		writeFileSync(join(root, 'resources', 'app', 'product.json'), JSON.stringify({ applicationName: 'unigma' }));
		writeFileSync(executable, [
			'#!/usr/bin/env node',
			'const { writeFileSync } = require("node:fs");',
			'const argv = process.argv.slice(2);',
			'if (argv.includes("--status")) {',
			`\tprocess.stdout.write(${JSON.stringify(REAL_STATUS_TABLE)} + "\\n");`,
			'\tprocess.exit(0);',
			'}',
			`writeFileSync(${JSON.stringify(seen)}, argv.join("\\n"));`,
			'setTimeout(() => { }, 60000);'
		].join('\n') + '\n');
		chmodSync(executable, 0o700);

		const result = run(['--exe', executable, '--scenario', 'clean-profile', '--repeat', '1', '--timeout', '20000']);
		assert.equal(result.status, 0, result.stderr);
		assert.match(readFileSync(seen, 'utf8'), /^--disable-workspace-trust$/m);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
