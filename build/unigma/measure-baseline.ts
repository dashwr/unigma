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
import { pathToFileURL } from 'node:url';

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
 *
 * The four names below were read from the source that registers them, not
 * guessed from the convention of their neighbours — `extension-host`
 * (`extensionHostStarter.ts`), `shared-process` (`sharedProcess.ts`),
 * `pty-host` (`electronPtyHostStarter.ts`) and `file-watcher`
 * (`watcherClient.ts`). `window [N] (title)` comes from `mapProcessToName`.
 * `zygote` and `utility-network-service` are Chromium's own and land in
 * `other`, which is why `other` is reported rather than dropped.
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
	// Zero is the other impossible value, and the ceiling gate could not see
	// it. Run `34051073811` published `extension-host` and `shared-process`
	// with `memory-mb.median=0` next to `spread=130`: a process that is in the
	// table is running, and a running process does not occupy zero megabytes.
	// Whatever produced those rows, the column was not measuring them, and a
	// median of zero is exactly the kind of figure that gets quoted later as if
	// it meant something.
	const zeroed = samples.filter(sample => sample.memoryMb === 0).map(sample => sample.role);
	if (zeroed.length > 0) {
		return `unreported: ${[...new Set(zeroed)].sort().join(', ')} appeared in the process table reporting 0 MB, which no running process does`;
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
	 * How many probes it took. Reported because it is the quantisation itself:
	 * runs that took the same number of probes produce a small spread whatever
	 * the product did between them.
	 */
	readonly probes: number;
	/**
	 * The longest gap observed between two consecutive readiness probes. It is
	 * the upper bound on how much `readyMs` overshoots the moment the window
	 * actually appeared, because the window can come up right after a probe and
	 * go unnoticed until the next one.
	 */
	readonly probeIntervalMs: number;
	readonly samples: readonly ProcessSample[];
	/**
	 * The product's own clock, first log line to window-ready. Absent when the
	 * log carries no parseable timestamp.
	 */
	readonly logReadyMs?: number;
	/** The renderer enumeration probe, or the reason it could not run. */
	readonly rendererProbe?: RendererProbe | string;
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
function collectLogFiles(logsDir: string): { readonly path: string; readonly mtimeMs: number }[] {
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
	return files;
}

/**
 * The line the main process writes when the renderer calls back to say it is
 * up: `WindowImpl.setReady`, `windowImpl.ts:764`, at trace level — which is why
 * the launch passes `--log=trace`. It is the product's own statement about the
 * event this baseline is trying to time, and reading it costs a file read
 * rather than a second launch of the executable.
 */
const LOG_READY = /window#load: window reported ready \(id: \d+\)/;

/** The spdlog prefix the product writes ahead of every line. */
const LOG_TIMESTAMP = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})/;

/** Concatenates the product's log files so readiness can be read from them. */
function readProductLogText(logsDir: string): string {
	const parts: string[] = [];
	for (const file of collectLogFiles(logsDir)) {
		try {
			parts.push(readFileSync(file.path, 'utf8'));
		} catch {
			// A log can be rotated while the product is running.
			continue;
		}
	}
	return parts.join('\n');
}

/**
 * The interval the product's own clock puts between its first log line and the
 * line that reports the window ready.
 *
 * Reported alongside `ready-ms` because it is independent of this harness: it
 * has no polling quantisation and no process-spawn cost in it. It measures a
 * strictly shorter interval than `ready-ms` — the first log line is already
 * some way into startup — so the two are not interchangeable, and a large
 * disagreement between them is a signal that the wall-clock number is picking
 * up something other than the product.
 */
function logReadyMs(text: string): number | undefined {
	const lines = text.split('\n');
	let first: number | undefined;
	let ready: number | undefined;
	for (const line of lines) {
		const stamp = LOG_TIMESTAMP.exec(line);
		if (!stamp) {
			continue;
		}
		const at = Date.parse(stamp[1].replace(' ', 'T'));
		if (Number.isNaN(at)) {
			continue;
		}
		if (first === undefined || at < first) {
			first = at;
		}
		if (ready === undefined && LOG_READY.test(line)) {
			ready = at;
		}
	}
	return first === undefined || ready === undefined ? undefined : ready - first;
}

function describeProductLogs(logsDir: string, limit = 8): string {
	const files = collectLogFiles(logsDir);
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
 * Why readiness is no longer polled with `--status`.
 *
 * `--status` is not a passive read of a running instance. `main.ts:436` reaches
 * the diagnostics path only after connecting to that profile's IPC handle; when
 * the handle is not listening yet, the same executable goes down the
 * claim-instance path instead, prints the `statusWarning` at `main.ts:469` and
 * terminates. So every probe was a full second launch of the product against
 * the profile being measured, racing the instance it was supposed to observe.
 *
 * That single fact explains three separate observations that had been recorded
 * as unrelated:
 *
 * - the resolution. Run `34047514749` measured a real gap of 2596 ms between
 *   probes on a 6408 ms measurement, because the gap is a process launch, not
 *   the 250 ms sleep.
 * - `34043447622` reporting `renderer.present=no` in both scenarios.
 * - the `idle-folder` failure in `34047514749`: `connect ENOENT` on the
 *   profile's `-main.sock` followed by `Lifecycle#kill()` is the probe failing
 *   to find the handle and shutting itself down — the signature of the race,
 *   and the scenario that opens a folder is the one that leaves the handle
 *   unlistened for longest.
 *
 * Reading the product's own log removes the second process entirely. `--status`
 * is still used, once, after readiness, for the memory samples it is the only
 * source of — at that point the handle is up and the race is over.
 */
const READY_MARKER_NOTE = 'log marker, not --status polling';

/**
 * How long the loop sleeps between readiness probes.
 *
 * A probe is now a read of the product's log files, so the gap between two
 * probes really is about this sleep — unlike the previous design, where each
 * probe launched the executable and the measured gap reached 2596 ms on a
 * 6408 ms measurement (`34047514749`). The resolution is still measured per run
 * and published from observation rather than assumed from this constant: the
 * constant is what the harness asks for, and `ready-resolution-ms` is what it
 * got.
 */
const POLL_SLEEP_MS = 100;


/**
 * Why the process table has no window row, measured instead of guessed.
 *
 * Run `34052368433` logged a ready window in every repetition and then printed
 * a table with no `window` line. A read of the source narrowed the cause to a
 * single point without settling it:
 *
 * - the row can only come from two places, and **both require the renderer PID
 *   to be a node of the tree `listProcesses(mainPID)` returns** —
 *   `diagnosticsService.ts:525` renames it from `info.windows`, and `findName`
 *   at `ps.ts:69` falls back to the literal `window` for `--type=renderer`.
 *   `formatProcessItem` only prints nodes already in the tree, so the absence
 *   of both forms means the PID is not in the tree, not that it was misnamed.
 * - the tree is fragile by construction: `addToTree` (`ps.ts:21-24`) keeps a
 *   process only if it is the root or if its `ppid` is **already in the map**
 *   when its line is read, in the order `ps` happened to print. A process whose
 *   parent is not in the tree, or whose line arrives before its parent's, is
 *   dropped in silence along with its whole subtree.
 * - two earlier hypotheses are refuted. Not Xvfb: `getAllWindowsExcludingOffscreen`
 *   only filters `info.windows`, and a filtered window would still print as
 *   `window` through `findName`. Not collection timing: `setReady` is only
 *   reached from an IPC the workbench sends from inside the renderer, and the
 *   `--status` call comes after it.
 *
 * What remains is enumeration, and this probe measures it. It runs the exact
 * command `ps.ts:223` runs and reports three facts, each of which eliminates a
 * different possibility. It reads; it changes nothing.
 *
 * **Nothing here is published raw.** No PID, no command line, no path — a
 * renderer's argv carries the workspace. Only counts and categories.
 */
const PS_ARGS = ['-ax', '-o', 'pid=,ppid=,pcpu=,pmem=,command='];

export interface RendererProbe {
	/** How many processes carry `--type=renderer`. Zero means there is no renderer to find. */
	readonly renderers: number;
	/**
	 * Whether each renderer's `ppid` chain reaches the launched process.
	 * `out-of-tree` is the reparenting case; `in-tree` means the chain is
	 * intact and the drop happened for another reason.
	 */
	readonly parentage: 'in-tree' | 'out-of-tree' | 'mixed' | 'no-renderer';
	/**
	 * Whether every renderer line appears **after** its parent's line. `ps.ts`
	 * builds the tree in one pass, so a child printed before its parent is
	 * discarded even when the chain is perfectly valid. This is the one fact
	 * that tests the ordering dependency directly.
	 */
	readonly ordering: 'after-parent' | 'before-parent' | 'parent-absent' | 'no-renderer';
}

interface PsRow { readonly pid: number; readonly ppid: number; readonly index: number; readonly renderer: boolean }

/** Parses the same output `parsePsOutput` reads, keeping only what the probe reports on. */
export function parsePsRows(stdout: string): readonly PsRow[] {
	const rows: PsRow[] = [];
	for (const line of stdout.split('\n')) {
		const match = /^\s*([0-9]+)\s+([0-9]+)\s+[0-9.]+\s+[0-9.]+\s+(.*)$/.exec(line);
		if (!match) {
			continue;
		}
		rows.push({ pid: Number(match[1]), ppid: Number(match[2]), index: rows.length, renderer: match[3].includes('--type=renderer') });
	}
	return rows;
}

/** Answers the three questions from the rows, without quoting any of them. */
export function inspectRenderers(rows: readonly PsRow[], rootPid: number): RendererProbe {
	const byPid = new Map(rows.map(row => [row.pid, row]));
	const renderers = rows.filter(row => row.renderer);
	if (renderers.length === 0) {
		return { renderers: 0, parentage: 'no-renderer', ordering: 'no-renderer' };
	}
	const reaches = (row: PsRow): boolean => {
		const seen = new Set<number>();
		let current: PsRow | undefined = row;
		while (current && !seen.has(current.pid)) {
			if (current.pid === rootPid) {
				return true;
			}
			seen.add(current.pid);
			current = byPid.get(current.ppid);
		}
		return false;
	};
	const inTree = renderers.filter(reaches).length;
	const parentage = inTree === renderers.length ? 'in-tree' : inTree === 0 ? 'out-of-tree' : 'mixed';

	let ordering: RendererProbe['ordering'] = 'after-parent';
	for (const renderer of renderers) {
		const parent = byPid.get(renderer.ppid);
		if (!parent) {
			ordering = 'parent-absent';
			break;
		}
		if (parent.index > renderer.index) {
			ordering = 'before-parent';
			break;
		}
	}
	return { renderers: renderers.length, parentage, ordering };
}

/** Runs the probe. Any failure is reported as such, never as an absent renderer. */
function probeRenderers(rootPid: number): RendererProbe | string {
	if (platform() === 'win32') {
		return 'unreported: the probe reads the same ps output ps.ts reads, which is not the Windows path';
	}
	const result = spawnSync('ps', PS_ARGS, { encoding: 'utf8', timeout: 15000, env: { ...process.env, LC_NUMERIC: 'en_US.UTF-8' } });
	if (result.status !== 0 || typeof result.stdout !== 'string') {
		return 'unreported: ps did not answer';
	}
	const rows = parsePsRows(result.stdout);
	if (rows.length === 0) {
		return 'unreported: ps answered nothing this probe could parse';
	}
	return inspectRenderers(rows, rootPid);
}

/**
 * Launches the product against a throwaway profile and waits until the product
 * logs that the window reported ready. See `READY_MARKER_NOTE` for why this is
 * read from the log instead of polled with `--status`.
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

	let previousProbeAt = started;
	let probeIntervalMs = 0;
	let probes = 0;
	try {
		while (Date.now() - started < options.timeoutMs) {
			if (exited) {
				throw new Error(`the product exited before it reported a window${describeOutput(launchOutput)}${describeProductLogs(logsDir)}`);
			}
			probes++;
			const probeAt = Date.now();
			probeIntervalMs = Math.max(probeIntervalMs, probeAt - previousProbeAt);
			previousProbeAt = probeAt;
			const text = readProductLogText(logsDir);
			if (LOG_READY.test(text)) {
				const readyMs = Date.now() - started;
				// One `--status`, after readiness, for the only thing the log
				// does not carry. It is allowed to fail without discarding the
				// measurement: memory is published as a refusal in that case,
				// and `ready-ms` stands on the log alone.
				const status = spawnSync(options.executable, ['--user-data-dir', userDataDir, '--extensions-dir', extensionsDir, '--status'], {
					encoding: 'utf8',
					timeout: 30000
				});
				const samples = status.status === 0 && STATUS_READY.test(status.stdout ?? '')
					? parseStatus(status.stdout, options.applicationName)
					: [];
				// Taken at the same moment as `--status`, so the two describe
				// the same process tree. Asking later would measure a different
				// one and answer nothing.
				const rendererProbe = probeRenderers(child.pid ?? -1);
				return { readyMs, probes, probeIntervalMs, samples, logReadyMs: logReadyMs(text), rendererProbe };
			}
			await sleep(POLL_SLEEP_MS);
		}
		// Whether the launched process was still alive separates "the window never
		// came up" from "the instance is up but never said so", and the previous
		// failure could not tell those apart.
		throw new Error(`the product did not log a ready window within ${options.timeoutMs} ms (launched process ${exited ? 'exited' : 'still running'})${describeOutput(launchOutput)}${describeProductLogs(logsDir)}`);
	} finally {
		if (!exited) {
			child.kill();
			// Wait for the process to actually go, rather than for a fixed
			// interval: a launch that is slow to exit and a launch that ignores
			// SIGTERM look identical to a sleep, and the next repetition starts
			// on a profile the previous one may still hold.
			const deadline = Date.now() + 5000;
			while (!exited && Date.now() < deadline) {
				await sleep(50);
			}
			if (!exited) {
				child.kill('SIGKILL');
				const hard = Date.now() + 2000;
				while (!exited && Date.now() < hard) {
					await sleep(50);
				}
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
	lines.push(`ready-definition=first product log line reporting a ready window (${READY_MARKER_NOTE})`);
	// Minimum and maximum, not only the spread: two runs at the extremes and one
	// in the middle read the same as three clustered runs when only the
	// difference is published.
	lines.push(`ready-ms.min=${Math.min(...readyValues)}`);
	lines.push(`ready-ms.max=${Math.max(...readyValues)}`);
	lines.push(`ready-probes.min=${Math.min(...runs.map(run => run.probes))}`);
	lines.push(`ready-probes.max=${Math.max(...runs.map(run => run.probes))}`);
	// Observed, not assumed: the sleep between probes is the smaller half of the
	// gap, and quoting it alone made a spread look like precision it did not
	// have.
	lines.push(`ready-resolution-ms=${Math.max(...runs.map(run => run.probeIntervalMs))}`);
	lines.push('ready-ms.note=overstates by at most one probe interval; a spread below that interval means the runs took the same number of probes, not that startup varied less');
	// Published only when every run produced it, so the line never mixes runs
	// that had the product's own clock with runs that did not.
	const logReady = runs.map(run => run.logReadyMs);
	if (logReady.every((value): value is number => typeof value === 'number')) {
		lines.push(`ready-log-ms.min=${Math.min(...logReady)}`);
		lines.push(`ready-log-ms.max=${Math.max(...logReady)}`);
		lines.push('ready-log-ms.note=the product\'s own clock, first log line to ready window; strictly shorter than ready-ms because startup is already under way when the first line is written, so it is a cross-check and not a replacement');
	} else {
		lines.push('ready-log-ms=unreported: at least one run wrote no parseable log timestamp');
	}
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

	// Run `34051073811` logged a ready window in every repetition and then
	// reported `renderer.present=no` in both scenarios. Those two statements
	// cannot both describe the same process tree, and nothing in the report
	// said which one to doubt. The names the table actually printed are what
	// separates "the mapping missed the row" from "the row was not there".
	//
	// First token only: `mapProcessToName` renders a window as
	// `window [N] (title)`, and the title can carry a workspace path. The role
	// question is answered by the word `window`; the rest is not published.
	const namesSeen = new Set<string>();
	for (const run of runs) {
		for (const sample of run.samples) {
			namesSeen.add(sample.process.split(/[\s[(]/)[0]);
		}
	}
	lines.push(`process.names-seen=${[...namesSeen].sort().join(' ') || 'none'}`);

	// The probe that separates the three remaining possibilities for the
	// missing window row. Published from the first run only: five repetitions
	// of the same answer add nothing, and a disagreement between them would
	// mean something changed mid-scenario, which the count makes visible.
	const probe = runs[0]?.rendererProbe;
	if (typeof probe === 'string') {
		lines.push(`renderer-probe=${probe}`);
	} else if (probe) {
		const agreed = runs.every(run => typeof run.rendererProbe === 'object' && run.rendererProbe?.parentage === probe.parentage && run.rendererProbe?.ordering === probe.ordering);
		lines.push(`renderer-probe.count=${probe.renderers}`);
		lines.push(`renderer-probe.parentage=${probe.parentage}`);
		lines.push(`renderer-probe.ordering=${probe.ordering}`);
		lines.push(`renderer-probe.repetitions-agree=${agreed ? 'yes' : 'no'}`);
		lines.push('renderer-probe.note=counts and categories only; no pid, no command line, no path, because a renderer argv carries the workspace');
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

// Guarded so the pure helpers above can be imported by a test without
// launching a product. Every other test in the suite spawns this file as a
// process, which is right for the end-to-end report and wrong for a parser.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(error => fail(error instanceof Error ? error.message : String(error)));
}
