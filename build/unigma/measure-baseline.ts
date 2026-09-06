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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname, platform, release, tmpdir, totalmem } from 'node:os';
import { join, resolve } from 'node:path';

/** A row of `--status`: `CPU %`, `Mem MB`, `PID`, `Process`. */
const PROCESS_ROW = /^\s*([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+)\s+(.+?)\s*$/;

/**
 * The header the product actually prints above the process table, from
 * `DiagnosticsService.formatProcessList`.
 *
 * This used to be `/Process Info/`, which the product never prints: that string
 * exists only as a source comment in `electron-main/main.ts`. The harness was
 * therefore unable to succeed on any run, and reported every launch as one that
 * "did not answer --status" while `--status` was answering with a full process
 * table. Matching the header by its columns keeps a rename upstream loud.
 */
const STATUS_READY = /CPU %\s+Mem MB\s+PID\s+Process/;

/**
 * The process roles the baseline separates, named as `--status` actually names
 * them. The previous mapping was written from the module names — `main`,
 * `extensionHost`, `ptyHost` — and none of the three appears in the output: run
 * `34036136102` printed `unigma`, `zygote`, `window [1] (unigma)`,
 * `utility-network-service`, `shared-process`, `file-watcher [1]` and
 * `extension-host [1]`. It also merged the extension host with the shared
 * process into one row, which is exactly the silent merge the mapping is
 * supposed to prevent.
 *
 * The main process is the row named after `applicationName`, so it is resolved
 * from the package rather than hard-coded.
 */
const ROLES: ReadonlyArray<{ readonly role: string; readonly match: RegExp }> = [
	{ role: 'renderer', match: /^window\b/ },
	{ role: 'extension-host', match: /^extension-host\b/ },
	{ role: 'shared-process', match: /^shared-process\b/ },
	{ role: 'pty-host', match: /^pty-host\b/ },
	{ role: 'file-watcher', match: /^file-watcher\b/ }
];

/**
 * The memory column of `--status` used to be scaled by `totalmem() / 100` twice
 * — `ps.ts` already converts the percentage `ps` reports into bytes, and
 * `formatProcessItem` applied that same conversion again — so it was not
 * megabytes on Linux or macOS. The product side is fixed, and the column is
 * published again.
 *
 * It is published behind a plausibility gate rather than on trust. The harness
 * cannot tell a correct megabyte figure from a wrong one by looking at it, but
 * it can tell that the product's processes do not add up to more memory than
 * the machine has. If they do, the number is refused with what was observed,
 * because a baseline that publishes an impossible figure is worse than one that
 * publishes none.
 */
function memoryRefusal(samples: readonly ProcessSample[]): string | undefined {
	const totalMb = totalmem() / 1024 / 1024;
	const sum = samples.reduce((total, sample) => total + sample.memoryMb, 0);
	if (!samples.every(sample => Number.isFinite(sample.memoryMb) && sample.memoryMb >= 0)) {
		return 'unreported: the --status memory column contained a value that is not a number';
	}
	if (sum > totalMb) {
		return `unreported: the product's processes reported ${Math.round(sum)} MB together, more than the ${Math.round(totalMb)} MB this machine has, so the column is not megabytes`;
	}
	return undefined;
}

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
	/**
	 * The longest gap observed between two consecutive readiness probes. It is
	 * the upper bound on how much `readyMs` overshoots the moment the window
	 * actually appeared, because the window can come up right after a probe and
	 * go unnoticed until the next one.
	 */
	readonly probeIntervalMs: number;
	readonly samples: readonly ProcessSample[];
}

interface Options {
	readonly executable: string;
	readonly applicationName: string;
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

	const resolved = resolve(executable);
	return {
		executable: resolved,
		// The main process row is named after `applicationName`; reading it from
		// the package keeps a rebranded build from losing its own main process.
		applicationName: productField(resolve(resolved, '..'), 'applicationName', 'unigma'),
		scenario,
		repeat,
		folder: folder ? resolve(folder) : undefined,
		out: values.get('out') ? resolve(values.get('out')!) : undefined,
		timeoutMs: Number(values.get('timeout') ?? '120000')
	};
}

function roleOf(processName: string, applicationName: string): string {
	if (processName === applicationName) {
		return 'main';
	}
	for (const { role, match } of ROLES) {
		if (match.test(processName)) {
			return role;
		}
	}
	return 'other';
}

function parseStatus(text: string, applicationName: string): ProcessSample[] {
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
			role: roleOf(row[4], applicationName)
		});
	}
	return samples;
}

function sleep(ms: number): Promise<void> {
	return new Promise(done => setTimeout(done, ms));
}

/**
 * Quotes the first lines of a captured stream so a failure message carries the
 * reason with it. Bounded on purpose: this text ends up in a CI log, and an
 * unbounded splice of a product's output is how a log stops being readable.
 */
function describeOutput(text: string, label = 'launch'): string {
	// The last lines, not the first: a launch that never becomes ready stops
	// somewhere, and the opening banner says nothing about where. The first
	// diagnosable run quoted four startup lines and left the actual stall out.
	const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).slice(-6);
	return lines.length === 0 ? '' : `; ${label}: ${lines.join(' | ')}`;
}

/**
 * Quotes the tail of the product's own logs. `--status` answering `exit=0` with
 * a header and no `Process Info` means no instance was found on that profile,
 * and that sentence reads the same whether the window never opened, the main
 * process refused the profile or a modal is holding startup. Only the product's
 * log separates those, so a failed measurement carries it.
 */
function describeProductLogs(logsDir: string, limit = 8): string {
	const files: { readonly path: string; readonly mtimeMs: number }[] = [];
	const walk = (directory: string, depth: number): void => {
		if (depth > 3) {
			return;
		}
		let entries: string[];
		try {
			entries = readdirSync(directory);
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(directory, entry);
			try {
				const stats = statSync(path);
				if (stats.isDirectory()) {
					walk(path, depth + 1);
				} else if (entry.endsWith('.log')) {
					files.push({ path, mtimeMs: stats.mtimeMs });
				}
			} catch {
				continue;
			}
		}
	};
	walk(logsDir, 0);
	if (files.length === 0) {
		return '; product logs: none written';
	}
	// Newest first: the file the launch was still writing when it stalled is the
	// one that says where it stopped.
	files.sort((a, b) => b.mtimeMs - a.mtimeMs);
	const parts: string[] = [];
	for (const file of files.slice(0, 3)) {
		let text: string;
		try {
			text = readFileSync(file.path, 'utf8');
		} catch {
			continue;
		}
		const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).slice(-limit);
		if (lines.length > 0) {
			parts.push(`${file.path.slice(logsDir.length + 1)}: ${lines.join(' | ')}`);
		}
	}
	return parts.length === 0 ? '; product logs: empty' : `; product logs: ${parts.join(' // ')}`;
}

/**
 * The role whose presence defines readiness.
 *
 * Answering `--status` at all is not readiness: the first run to get real
 * numbers (`34043447622`) returned as soon as any row appeared, and reported
 * `renderer.present=no` in both scenarios — it had measured the moment the main
 * process started answering, before the window existed. In `idle-folder` even
 * the extension host and the shared process were still absent. A startup
 * baseline that stops before the window is up is measuring the wrong event.
 */
const READY_ROLE = 'renderer';

/**
 * How long the loop sleeps between readiness probes.
 *
 * This is **not** the resolution of `ready-ms`. Each probe launches the product
 * executable again to ask `--status`, which costs far more than the sleep, so
 * the real gap between two probes is the sleep plus that launch. Reporting the
 * sleep as the resolution understated it, and run `34045994035` showed the
 * consequence: `clean-profile` came back with a spread of 21 ms across three
 * repetitions, which does not mean the product starts that consistently — it
 * means all three needed the same number of probes. The resolution is measured
 * per run and reported from observation instead.
 */
const POLL_SLEEP_MS = 250;

/**
 * Launches the product against a throwaway profile and waits until `--status`
 * reports a window. The renderer row is the closest observable event to "the
 * window responds" that does not require instrumenting the product; the main
 * process answering is strictly earlier than that.
 */
async function measureOnce(options: Options, profile: string): Promise<Run> {
	const userDataDir = join(profile, 'user-data');
	const extensionsDir = join(profile, 'extensions');
	mkdirSync(userDataDir, { recursive: true });
	mkdirSync(extensionsDir, { recursive: true });

	// The first measurement attempt launched the product with nothing but the
	// throwaway directories and never saw `Process Info`, on a run whose stderr
	// was empty. These are the flags the remote window smoke uses to reach a
	// window under the same Xvfb, minus anything that would change what is being
	// measured: they only remove the first-run surfaces and the network work an
	// unattended launch must not wait for. They are part of the scenario
	// definition, so a baseline taken with them is not comparable to one taken
	// without them.
	const logsDir = join(profile, 'logs');
	const crashesDir = join(profile, 'crashes');
	mkdirSync(logsDir, { recursive: true });
	mkdirSync(crashesDir, { recursive: true });
	const args = [
		'--user-data-dir', userDataDir,
		'--extensions-dir', extensionsDir,
		'--skip-release-notes',
		'--skip-welcome',
		'--disable-telemetry',
		'--disable-experiments',
		'--disable-updates',
		// Part of the scenario, not a convenience: the workspace trust dialog is
		// a first-run surface that holds startup until someone answers it, and
		// nobody is there to answer under Xvfb. The smoke that reaches a window
		// solves the same problem by seeding trust into shared storage. A
		// baseline taken with this flag is not comparable to one taken without.
		'--disable-workspace-trust',
		// The smoke that is known to reach a window diagnoses itself from the
		// product's own log files, not from stdout: an Electron launch says
		// almost nothing on the pipes, and the run that produced `exit=0` with
		// no `Process Info` had an empty stderr. Tracing costs nothing here,
		// because these logs are read only when readiness never arrives.
		'--log=trace',
		`--logsPath=${logsDir}`,
		`--crash-reporter-directory=${crashesDir}`,
		'--new-window'
	];
	if (options.folder) {
		args.push(options.folder);
	}

	const started = Date.now();
	// The launched process keeps its own output: when readiness never arrives,
	// the reason is almost always on its stderr, and discarding it turns a
	// diagnosable failure into a stopwatch that only says "no".
	const child: ChildProcess = spawn(options.executable, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
	let exited = false;
	let launchOutput = '';
	const keep = (chunk: Buffer | string) => { launchOutput = (launchOutput + String(chunk)).slice(-4000); };
	child.stdout?.on('data', keep);
	child.stderr?.on('data', keep);
	child.on('exit', () => { exited = true; });

	let lastCode: number | null = null;
	let lastOutput = '';
	const rolesSeen = new Set<string>();
	let previousProbeAt = started;
	let probeIntervalMs = 0;
	try {
		while (Date.now() - started < options.timeoutMs) {
			if (exited) {
				throw new Error(`the product exited before it answered --status${describeOutput(launchOutput)}${describeProductLogs(logsDir)}`);
			}
			const probeAt = Date.now();
			probeIntervalMs = Math.max(probeIntervalMs, probeAt - previousProbeAt);
			previousProbeAt = probeAt;
			const status = spawnSync(options.executable, ['--user-data-dir', userDataDir, '--extensions-dir', extensionsDir, '--status'], {
				encoding: 'utf8',
				timeout: 30000
			});
			lastCode = status.status;
			lastOutput = `${status.stdout ?? ''}${status.stderr ?? ''}`;
			if (status.status === 0 && STATUS_READY.test(status.stdout ?? '')) {
				const samples = parseStatus(status.stdout, options.applicationName);
				if (samples.some(sample => sample.role === READY_ROLE)) {
					return { readyMs: Date.now() - started, probeIntervalMs, samples };
				}
				// Keep the roles seen so a timeout can say how far startup got
				// instead of repeating that nothing answered.
				for (const sample of samples) {
					rolesSeen.add(sample.role);
				}
			}
			await sleep(POLL_SLEEP_MS);
		}
		// Whether the launched process was still alive separates "the window never
		// came up" from "the instance is up but does not answer", and the previous
		// failure could not tell those apart.
		const seen = rolesSeen.size === 0 ? 'none' : [...rolesSeen].sort().join(', ');
		throw new Error(`the product did not report a ${READY_ROLE} within ${options.timeoutMs} ms (roles seen: ${seen}; last --status exit=${lastCode ?? 'none'}; launched process ${exited ? 'exited' : 'still running'})${describeOutput(lastOutput, 'status')}${describeOutput(launchOutput)}${describeProductLogs(logsDir)}`);
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

function productField(executableDir: string, field: string, fallback: string): string {
	const product = join(executableDir, 'resources', 'app', 'product.json');
	if (!existsSync(product)) {
		return fallback;
	}
	try {
		const parsed = JSON.parse(readFileSync(product, 'utf8'));
		return typeof parsed[field] === 'string' ? parsed[field] : fallback;
	} catch {
		return fallback;
	}
}

function report(options: Options, runs: readonly Run[]): string {
	const lines: string[] = [];
	lines.push(`scenario=${options.scenario}`);
	lines.push(`executable=${options.executable}`);
	lines.push(`commit=${productField(resolve(options.executable, '..'), 'commit', 'unknown')}`);
	lines.push(`application-name=${options.applicationName}`);
	lines.push(`platform=${platform()}-${process.arch}`);
	lines.push(`os-release=${release()}`);
	lines.push(`host=${hostname()}`);
	lines.push(`total-memory-mb=${Math.round(totalmem() / 1024 / 1024)}`);
	lines.push(`node=${process.version}`);
	lines.push(`repetitions=${runs.length}`);

	const readyValues = runs.map(run => run.readyMs);
	lines.push(`ready-definition=first --status reporting a ${READY_ROLE} row`);
	// Observed, not assumed: the sleep between probes is the smaller half of the
	// gap, and quoting it alone made a spread look like precision it did not
	// have.
	lines.push(`ready-resolution-ms=${Math.max(...runs.map(run => run.probeIntervalMs))}`);
	lines.push('ready-ms.note=overstates by at most one probe interval; a spread below that interval means the runs took the same number of probes, not that startup varied less');
	lines.push(`ready-ms.median=${median(readyValues)}`);
	lines.push(`ready-ms.spread=${spread(readyValues)}`);

	const refusal = runs.map(run => memoryRefusal(run.samples)).find(reason => reason !== undefined);
	if (refusal) {
		lines.push(`memory=${refusal}`);
	}

	// `main` is matched by name from the package rather than by pattern, and
	// `other` collects what the product prints but the mapping does not name —
	// `zygote` and `utility-network-service` in the observed table. Reporting it
	// keeps those processes from being invisible in a memory total.
	for (const role of ['main', ...ROLES.map(entry => entry.role), 'other']) {
		const cpu = runs.map(run => run.samples.filter(sample => sample.role === role).reduce((sum, sample) => sum + sample.cpuPercent, 0));
		const memory = runs.map(run => run.samples.filter(sample => sample.role === role).reduce((sum, sample) => sum + sample.memoryMb, 0));
		const present = runs.some(run => run.samples.some(sample => sample.role === role));
		lines.push(`process.${role}.present=${present ? 'yes' : 'no'}`);
		if (present) {
			lines.push(`process.${role}.cpu-percent.median=${median(cpu)}`);
			if (!refusal) {
				lines.push(`process.${role}.memory-mb.median=${median(memory)}`);
				lines.push(`process.${role}.memory-mb.spread=${spread(memory)}`);
			}
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
		} catch (error) {
			// The evidence artifact has to carry the reason too. Failing with the
			// message only on stderr leaves the uploaded logs silent about a
			// measurement that was attempted and did not happen, and the CI log
			// is not where a baseline is read from later.
			const reason = error instanceof Error ? error.message : String(error);
			const text = [
				`scenario=${options.scenario}`,
				'measured=absent',
				`absent-reason=${reason.replace(/\n/g, ' ')}`
			].join('\n') + '\n';
			if (options.out) {
				writeFileSync(options.out, text, 'utf8');
			}
			process.stdout.write(text);
			throw error;
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
