/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Baseline measurement for the packaged product.
 *
 * This measures a package, never the development tree: compiling on demand
 * measures the compiler. It also refuses to invent numbers for a scenario the
 * product cannot reach yet — an absent scenario is reported as absent, with the
 * reason, instead of being simulated.
 *
 * No telemetry is involved. Everything here comes from the process table the
 * product already exposes through `--status`.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, platform, release, tmpdir, totalmem } from 'node:os';
import { join, resolve } from 'node:path';

/** A row of `--status`: `CPU %`, `Mem MB`, `PID`, `Process`. */
const PROCESS_ROW = /^\s*([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+)\s+(.+?)\s*$/;
const STATUS_READY = /Process Info/;

/**
 * The four process roles the baseline has to separate. `--status` names them
 * differently from the command line, so the mapping is explicit: a rename
 * upstream should break this loudly instead of silently merging two roles.
 */
const ROLES: ReadonlyArray<{ readonly role: string; readonly match: RegExp }> = [
	{ role: 'main', match: /^main$/ },
	{ role: 'renderer', match: /^window\b/ },
	{ role: 'extension-host', match: /extensionHost|shared-process/ },
	{ role: 'pty-host', match: /ptyHost/ }
];

type ScenarioName = 'clean-profile' | 'idle-folder' | 'agent-session' | 'ssh-session';

/**
 * Scenarios the product cannot reach yet, with the reason. They are reported as
 * absent so a partial baseline can never be read as a complete one.
 */
const BLOCKED_SCENARIOS: ReadonlyMap<ScenarioName, string> = new Map([
	['agent-session', 'no provider or model is authorised yet, so no agent session can be started'],
	['ssh-session', 'the remote window matrix has not been collected yet']
]);

interface ProcessSample {
	readonly role: string;
	readonly process: string;
	readonly pid: number;
	readonly cpuPercent: number;
	readonly memoryMb: number;
}

interface Run {
	readonly readyMs: number;
	readonly samples: readonly ProcessSample[];
}

interface Options {
	readonly executable: string;
	readonly scenario: ScenarioName;
	readonly repeat: number;
	readonly folder?: string;
	readonly out?: string;
	readonly timeoutMs: number;
}

function fail(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

function parseOptions(argv: readonly string[]): Options {
	const values = new Map<string, string>();
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith('--')) {
			fail(`unexpected argument: ${arg}`);
		}
		const eq = arg.indexOf('=');
		if (eq > 0) {
			values.set(arg.slice(2, eq), arg.slice(eq + 1));
		} else {
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--')) {
				fail(`missing value for ${arg}`);
			}
			values.set(arg.slice(2), next);
			i++;
		}
	}

	const executable = values.get('exe');
	if (!executable) {
		fail('usage: measure-baseline --exe <packaged executable> --scenario <name> [--repeat n] [--folder path] [--out file]');
	}
	if (!existsSync(executable)) {
		fail(`executable not found: ${executable}`);
	}

	const scenario = (values.get('scenario') ?? 'clean-profile') as ScenarioName;
	if (!['clean-profile', 'idle-folder', 'agent-session', 'ssh-session'].includes(scenario)) {
		fail(`unknown scenario: ${scenario}`);
	}

	const repeat = Number(values.get('repeat') ?? '3');
	if (!Number.isInteger(repeat) || repeat < 1) {
		fail('--repeat must be a positive integer');
	}

	const folder = values.get('folder');
	if (scenario === 'idle-folder' && !folder) {
		fail('scenario idle-folder needs --folder');
	}

	return {
		executable: resolve(executable),
		scenario,
		repeat,
		folder: folder ? resolve(folder) : undefined,
		out: values.get('out') ? resolve(values.get('out')!) : undefined,
		timeoutMs: Number(values.get('timeout') ?? '120000')
	};
}

function roleOf(processName: string): string {
	for (const { role, match } of ROLES) {
		if (match.test(processName)) {
			return role;
		}
	}
	return 'other';
}

function parseStatus(text: string): ProcessSample[] {
	const samples: ProcessSample[] = [];
	let inTable = false;
	for (const line of text.split(/\r?\n/)) {
		if (STATUS_READY.test(line)) {
			inTable = true;
			continue;
		}
		if (!inTable) {
			continue;
		}
		const row = PROCESS_ROW.exec(line);
		if (!row) {
			continue;
		}
		samples.push({
			cpuPercent: Number(row[1]),
			memoryMb: Number(row[2]),
			pid: Number(row[3]),
			process: row[4],
			role: roleOf(row[4])
		});
	}
	return samples;
}

function sleep(ms: number): Promise<void> {
	return new Promise(done => setTimeout(done, ms));
}

/**
 * Launches the product against a throwaway profile and waits until it answers
 * `--status`. Answering is the readiness signal: it means the main process is
 * up and the window has an IPC handle, which is the closest observable event to
 * "the window responds" that does not require instrumenting the product.
 */
async function measureOnce(options: Options, profile: string): Promise<Run> {
	const userDataDir = join(profile, 'user-data');
	const extensionsDir = join(profile, 'extensions');
	mkdirSync(userDataDir, { recursive: true });
	mkdirSync(extensionsDir, { recursive: true });

	const args = ['--user-data-dir', userDataDir, '--extensions-dir', extensionsDir, '--new-window'];
	if (options.folder) {
		args.push(options.folder);
	}

	const started = Date.now();
	const child: ChildProcess = spawn(options.executable, args, { stdio: 'ignore', detached: false });
	let exited = false;
	child.on('exit', () => { exited = true; });

	try {
		while (Date.now() - started < options.timeoutMs) {
			if (exited) {
				throw new Error('the product exited before it answered --status');
			}
			const status = spawnSync(options.executable, ['--user-data-dir', userDataDir, '--extensions-dir', extensionsDir, '--status'], {
				encoding: 'utf8',
				timeout: 30000
			});
			if (status.status === 0 && STATUS_READY.test(status.stdout ?? '')) {
				const samples = parseStatus(status.stdout);
				if (samples.length > 0) {
					return { readyMs: Date.now() - started, samples };
				}
			}
			await sleep(500);
		}
		throw new Error(`the product did not answer --status within ${options.timeoutMs} ms`);
	} finally {
		if (!exited) {
			child.kill();
			await sleep(2000);
			if (!exited) {
				child.kill('SIGKILL');
			}
		}
	}
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function spread(values: readonly number[]): number {
	return Math.max(...values) - Math.min(...values);
}

function commitOf(executableDir: string): string {
	const product = join(executableDir, 'resources', 'app', 'product.json');
	if (!existsSync(product)) {
		return 'unknown';
	}
	try {
		const parsed = JSON.parse(readFileSync(product, 'utf8'));
		return typeof parsed.commit === 'string' ? parsed.commit : 'unknown';
	} catch {
		return 'unknown';
	}
}

function report(options: Options, runs: readonly Run[]): string {
	const lines: string[] = [];
	lines.push(`scenario=${options.scenario}`);
	lines.push(`executable=${options.executable}`);
	lines.push(`commit=${commitOf(resolve(options.executable, '..'))}`);
	lines.push(`platform=${platform()}-${process.arch}`);
	lines.push(`os-release=${release()}`);
	lines.push(`host=${hostname()}`);
	lines.push(`total-memory-mb=${Math.round(totalmem() / 1024 / 1024)}`);
	lines.push(`node=${process.version}`);
	lines.push(`repetitions=${runs.length}`);

	const readyValues = runs.map(run => run.readyMs);
	lines.push(`ready-ms.median=${median(readyValues)}`);
	lines.push(`ready-ms.spread=${spread(readyValues)}`);

	for (const { role } of ROLES) {
		const memory = runs.map(run => run.samples.filter(sample => sample.role === role).reduce((sum, sample) => sum + sample.memoryMb, 0));
		const cpu = runs.map(run => run.samples.filter(sample => sample.role === role).reduce((sum, sample) => sum + sample.cpuPercent, 0));
		const present = memory.some(value => value > 0);
		lines.push(`process.${role}.present=${present ? 'yes' : 'no'}`);
		if (present) {
			lines.push(`process.${role}.memory-mb.median=${median(memory)}`);
			lines.push(`process.${role}.memory-mb.spread=${spread(memory)}`);
			lines.push(`process.${role}.cpu-percent.median=${median(cpu)}`);
		}
	}

	return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));

	const blocked = BLOCKED_SCENARIOS.get(options.scenario);
	if (blocked) {
		const text = [
			`scenario=${options.scenario}`,
			'measured=absent',
			`absent-reason=${blocked}`
		].join('\n') + '\n';
		process.stdout.write(text);
		if (options.out) {
			writeFileSync(options.out, text, 'utf8');
		}
		return;
	}

	const runs: Run[] = [];
	for (let i = 0; i < options.repeat; i++) {
		const profile = mkdtempSync(join(tmpdir(), 'unigma-baseline-'));
		try {
			runs.push(await measureOnce(options, profile));
		} finally {
			rmSync(profile, { recursive: true, force: true });
		}
	}

	const text = report(options, runs);
	process.stdout.write(text);
	if (options.out) {
		writeFileSync(options.out, text, 'utf8');
	}
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
