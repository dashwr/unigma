/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFileSync } from 'node:child_process';
import { appendFileSync, accessSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { RemoteSshProcess, createRemoteSshProcessRunner as CreateRemoteSshProcessRunner, openRemoteControlMaster as OpenRemoteControlMaster, openRemoteServer as OpenRemoteServer } from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { BootstrapManifest } from '../../extensions/unigma-remote-ssh/out/bootstrapManifest.js';
import type { buildRemoteStagingCleanupArguments as BuildCleanupArguments, buildRemoteStagingScriptDeliveryArguments as BuildDeliveryArguments, createRemotePayloadTarRunner as CreatePayloadTarRunner, stageRemotePayload as StageRemotePayload } from '../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js';
import type { buildRemoteStagingScript as BuildStagingScript } from '../../extensions/unigma-remote-ssh/out/remoteStagingScript.js';
import type { buildRemoteServerPathShellFragments as BuildServerPathFragments } from '../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js';

const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as { createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner; openRemoteControlMaster: typeof OpenRemoteControlMaster; openRemoteServer: typeof OpenRemoteServer };
const staging = require('../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js') as { buildRemoteStagingCleanupArguments: typeof BuildCleanupArguments; buildRemoteStagingScriptDeliveryArguments: typeof BuildDeliveryArguments; createRemotePayloadTarRunner: typeof CreatePayloadTarRunner; stageRemotePayload: typeof StageRemotePayload };
const script = require('../../extensions/unigma-remote-ssh/out/remoteStagingScript.js') as { buildRemoteStagingScript: typeof BuildStagingScript };
const plan = require('../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js') as { buildRemoteServerPathShellFragments: typeof BuildServerPathFragments };
const { createRemoteSshProcessRunner, openRemoteControlMaster, openRemoteServer } = transport;
const { buildRemoteStagingCleanupArguments, buildRemoteStagingScriptDeliveryArguments, createRemotePayloadTarRunner, stageRemotePayload } = staging;
const { buildRemoteStagingScript } = script;
const { buildRemoteServerPathShellFragments } = plan;

const COMMIT = /^[0-9a-f]{40}$/;
// Mirrors the probe sanitiser, so a host cannot widen the report by answering.
// The key carries a package-relative addon path and needs a separator; a value
// never does, which is what keeps an absolute path out of the report even if the
// answer was crafted rather than produced by the probe.
const NATIVE_LINE = /^(native\.[A-Za-z0-9.@/_+-]{1,140})=([A-Za-z0-9._+,:-]{1,160})$/;
const NATIVE_LINE_LIMIT = 256;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-vps-staging-smoke.txt'));
const tracePath = `${reportPath}.ssh-trace.log`;
const checks: Array<readonly [string, 'pass' | 'fail']> = [];
const keepStagedServer = process.env['UNIGMA_KEEP_STAGED'] === '1';
const facts: Array<readonly [string, string]> = [];

function check(name: string, passed: boolean): void { checks.push([name, passed ? 'pass' : 'fail']); }
function writeReport(status: 'pass' | 'fail'): void {
	const report = [...facts.map(([name, value]) => `${name}=${value}`), ...checks.map(([name, result]) => `check.${name}=${result}`), `smoke=${status}`].join('\n') + '\n';
	try { mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, report, { mode: 0o600 }); } catch { /* stdout is the fallback report */ }
	process.stdout.write(report);
}
function executable(name: string): string | undefined {
	for (const directory of (process.env.PATH ?? '').split(':').filter(Boolean)) {
		const candidate = join(directory, name);
		try { accessSync(candidate, 1); return candidate; } catch { /* do not expose candidate paths */ }
	}
	return undefined;
}
function tracedRunner(): (arguments_: readonly string[]) => RemoteSshProcess {
	const realRunner = createRemoteSshProcessRunner();
	return arguments_ => {
		const process_ = realRunner(arguments_);
		process_.stderr.on('data', chunk => { try { appendFileSync(tracePath, chunk as Buffer); } catch { /* trace is best effort */ } });
		return process_;
	};
}
/**
 * Traces the payload stream spawner as well.
 *
 * Only the ssh runner was traced, and the failure landed in the phase that uses
 * this one, so the trace file was empty exactly when it was needed.
 */
function tracedPayloadTarRunner(): ReturnType<typeof createRemotePayloadTarRunner> {
	const realRunner = createRemotePayloadTarRunner();
	return ((arguments_: readonly string[]) => {
		const process_ = realRunner(arguments_ as never) as RemoteSshProcess;
		process_.stderr.on('data', chunk => { try { appendFileSync(tracePath, chunk as Buffer); } catch { /* trace is best effort */ } });
		return process_;
	}) as ReturnType<typeof createRemotePayloadTarRunner>;
}
function payloadFromStore(workDirectory: string): { readonly server: string; readonly opencode: string; readonly license: string; readonly commit: string } {
	const store = process.env['UNIGMA_ARTIFACT_ROOT'] ?? join(homedir(), '.local', 'share', 'unigma-artifacts');
	const serverTree = join(store, 'unigma-server-latest');
	const opencode = join(store, 'opencode-latest', 'bin', 'opencode');
	const license = join(store, 'opencode-latest', 'LICENSE-opencode.txt');
	const provenance = join(serverTree, 'PROVENANCE.txt');
	if (!existsSync(provenance) || !existsSync(opencode) || !existsSync(license)) { throw new Error('artifact store is incomplete'); }
	const commit = readFileSync(provenance, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='))?.slice(7) ?? '';
	if (!COMMIT.test(commit)) { throw new Error('artifact store commit is invalid'); }
	const resolved = realpathSync(serverTree);
	const archive = join(workDirectory, 'store-server.tar.gz');
	execFileSync(executable('tar') ?? 'tar', ['--owner=0', '--group=0', '-czf', archive, '-C', dirname(resolved), basename(resolved)]);
	return { server: archive, opencode, license, commit };
}
interface CommandResult { readonly code: number | null; readonly output: string }
function runCommand(runner: (arguments_: readonly string[]) => RemoteSshProcess, arguments_: readonly string[], input = ''): Promise<CommandResult> {
	const process_ = runner(arguments_);
	const output: Buffer[] = [];
	process_.stdout.on('data', chunk => output.push(Buffer.from(chunk as Uint8Array)));
	return new Promise(resolveCommand => {
		let settled = false;
		const finish = (code: number | null): void => {
			if (settled) { return; }
			settled = true;
			clearTimeout(timer);
			resolveCommand({ code, output: Buffer.concat(output).toString('utf8') });
		};
		const timer = setTimeout(() => { try { process_.kill('SIGTERM'); } catch { /* close event remains authoritative */ } finish(null); }, 30_000);
		process_.on('error', () => finish(null));
		process_.on('close', code => finish(code));
		try { process_.stdin.end(input); } catch { finish(null); }
	});
}
async function cleanupRemoteVersion(runner: (arguments_: readonly string[]) => RemoteSshProcess, destination: string, controlPath: string, commit: string, generatedScript: string): Promise<{ readonly delivery: CommandResult; readonly cleanup: CommandResult; readonly status: string }> {
	const input = { destination, controlPath, commit };
	const delivery = await runCommand(runner, buildRemoteStagingScriptDeliveryArguments(input), generatedScript);
	const cleanup = await runCommand(runner, buildRemoteStagingCleanupArguments(input));
	return { delivery, cleanup, status: /"status":"([a-z-]+)"/.exec(cleanup.output)?.[1] ?? 'none' };
}
function shellQuote(value: string): string {
	const quote = String.fromCharCode(39);
	return `${quote}${value.split(quote).join(`${quote}\\${quote}${quote}`)}${quote}`;
}
/**
 * Asks the packaged Node whether the shipped addons actually dlopen on that host.
 *
 * The activated server printed `ERR_DLOPEN_FAILED` for `@vscode/spdlog` and kept
 * answering `/version`, because `spdlogLog.ts` swallows the failure and there is
 * no alternative logger: remote logging is then lost in silence. `/version` and
 * the distribution audit both pass in that state, so the only witness that can
 * separate a glibc mismatch from an ABI mismatch from a missing file is the
 * packaged runtime asking its own loader, on the machine that has the problem.
 */
const NATIVE_PROBE_SOURCE = [
	'const fs = require("node:fs");',
	'const path = require("node:path");',
	'const childProcess = require("node:child_process");',
	// Every line leaving the host goes through this one filter, so no absolute
	// path, hostname or environment value can reach the report even if a loader
	// message embeds one.
	'const KEY_UNSAFE = /[^A-Za-z0-9.@\\/_+-]/g;',
	'const VALUE_UNSAFE = /[^A-Za-z0-9._+,:-]/g;',
	'const emit = (key, value) => {',
	'\tconst line = String(key).replace(KEY_UNSAFE, "_").slice(0, 140) + "=" + String(value).replace(VALUE_UNSAFE, "_").slice(0, 160);',
	// Written synchronously so a crashing addon cannot take the already collected
	// evidence with it.
	'\ttry { fs.writeSync(1, line + "\\n"); } catch { /* the report line is best effort */ }',
	'};',
	'const VERSION_TOKEN = /(?:GLIBC|GLIBCXX|CXXABI|NODE_MODULE_VERSION)[_ ]?[0-9]+(?:\\.[0-9]+)*/g;',
	'const LIBRARY_TOKEN = /[A-Za-z0-9_+.-]+\\.so(?:\\.[0-9]+)*/g;',
	// Loader evidence outranks the self-register message on purpose: an addon can
	// report both, and only the loader categories say the host is at fault.
	'const classify = (text) => {',
	'\tif (/NODE_MODULE_VERSION/.test(text)) { return "abi-mismatch"; }',
	'\tif (/wrong ELF class|Exec format error|cannot execute binary file/i.test(text)) { return "wrong-arch"; }',
	'\tif (/invalid ELF header/i.test(text)) { return "invalid-elf"; }',
	'\tif (/version .{0,2}(?:GLIBC|GLIBCXX|CXXABI)_/.test(text)) { return "version-mismatch"; }',
	'\tif (/undefined symbol/i.test(text)) { return "missing-symbol"; }',
	'\tif (/cannot open shared object file|not found/i.test(text)) { return "missing-library"; }',
	'\tif (/did not self-register/i.test(text)) { return "not-self-registered"; }',
	'\treturn "unknown";',
	'};',
	// The loader message names the soname and the version it wanted; `ldd` names
	// what the host can actually resolve. `-r` is deliberately absent: it reports
	// the `napi_*` symbols that Node itself provides as undefined, which would
	// make every healthy addon look broken. Only whitelisted tokens are kept.
	'const inspect = (file) => {',
	'\ttry { return childProcess.execFileSync("ldd", ["--", file], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] }); }',
	'\tcatch (error) { return String((error && error.stdout) || "") + String((error && error.stderr) || ""); }',
	'};',
	'const tokens = (text) => {',
	'\tconst found = [];',
	'\tconst add = (value) => { const token = String(value).slice(0, 32); if (token && found.length < 3 && found.indexOf(token) < 0) { found.push(token); } };',
	'\tconst symbol = /undefined symbol: ([A-Za-z0-9_]+)/.exec(text);',
	'\tif (symbol) { add(symbol[1]); }',
	'\tfor (const token of text.match(VERSION_TOKEN) || []) { add(token); }',
	'\tfor (const line of text.split("\\n")) {',
	'\t\tif (/not found|cannot open shared object/.test(line)) { for (const token of line.match(LIBRARY_TOKEN) || []) { add(token); } }',
	'\t}',
	'\treturn found.join(",");',
	'};',
	// npm records the platform, architecture and libc a package is built for, so
	// the tree itself says which addons this host is expected to load. Reading it
	// keeps a musl prebuild shipped beside its glibc sibling from being reported
	// as a host defect.
	'const allows = (list, value) => {',
	'\tif (!Array.isArray(list) || list.length === 0) { return true; }',
	'\tconst entries = list.filter((entry) => typeof entry === "string");',
	'\tif (entries.filter((entry) => entry.charAt(0) === "!").map((entry) => entry.slice(1)).indexOf(value) >= 0) { return false; }',
	'\tconst allowed = entries.filter((entry) => entry.charAt(0) !== "!");',
	'\treturn allowed.length === 0 || allowed.indexOf(value) >= 0;',
	'};',
	'try {',
	'\tconst base = fs.realpathSync(process.argv[1]);',
	'\tlet header = {};',
	'\ttry { header = process.report.getReport().header || {}; } catch { header = {}; }',
	'\tconst libc = header.glibcVersionRuntime ? "glibc" : "musl";',
	'\temit("native.node.modules", process.versions.modules);',
	'\temit("native.node.arch", process.arch);',
	'\temit("native.node.platform", process.platform);',
	'\temit("native.node.packaged", process.execPath === path.join(base, "node"));',
	'\temit("native.libc", libc);',
	'\temit("native.glibc.runtime", header.glibcVersionRuntime || "unknown");',
	'\temit("native.glibc.compiler", header.glibcVersionCompiler || "unknown");',
	'\tconst addons = [];',
	'\tconst walk = (directory, depth) => {',
	'\t\tif (depth > 20 || addons.length >= 256) { return; }',
	'\t\tlet entries = [];',
	'\t\ttry { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }',
	'\t\tfor (const entry of entries) {',
	// A symlink can leave the activated directory, and the probe must only speak
	// about what this version actually shipped.
	'\t\t\tif (entry.isSymbolicLink()) { continue; }',
	'\t\t\tconst full = path.join(directory, entry.name);',
	'\t\t\tif (entry.isDirectory()) { walk(full, depth + 1); } else if (entry.isFile() && /\\.node$/.test(entry.name)) { addons.push(full); }',
	'\t\t}',
	'\t};',
	'\twalk(base, 0);',
	'\taddons.sort();',
	'\tconst manifestFor = (file) => {',
	'\t\tlet directory = path.dirname(file);',
	'\t\twhile (directory.length >= base.length) {',
	'\t\t\tconst manifest = path.join(directory, "package.json");',
	'\t\t\tif (fs.existsSync(manifest)) {',
	'\t\t\t\ttry { return { directory: directory, json: JSON.parse(fs.readFileSync(manifest, "utf8")) }; } catch { return { directory: directory, json: {} }; }',
	'\t\t\t}',
	'\t\t\tconst parent = path.dirname(directory);',
	'\t\t\tif (parent === directory) { break; }',
	'\t\t\tdirectory = parent;',
	'\t\t}',
	'\t\treturn { directory: base, json: {} };',
	'\t};',
	'\tlet skipped = 0;',
	'\tconst checked = [];',
	'\tfor (const file of addons) {',
	'\t\tconst found = manifestFor(file);',
	'\t\tif (!allows(found.json.os, process.platform) || !allows(found.json.cpu, process.arch) || !allows(found.json.libc, libc)) { skipped = skipped + 1; continue; }',
	'\t\tconst inside = path.relative(found.directory, file).split(path.sep).join("/");',
	'\t\tconst named = typeof found.json.name === "string" && found.directory !== base;',
	'\t\tchecked.push({ file: file, id: named ? found.json.name + "/" + inside : path.relative(base, file).split(path.sep).join("/") });',
	'\t}',
	'\temit("native.addons.found", addons.length);',
	'\temit("native.addons.skipped", skipped);',
	'\temit("native.addons.checked", checked.length);',
	// Each `require` runs in its own child of the same packaged Node. A truncated
	// or mismatched addon does not raise an exception, it kills the process with
	// SIGSEGV or SIGBUS, and in a single process the first such addon would hide
	// every module after it, `@vscode/spdlog` included.
	'\tconst load = (file) => {',
	'\t\ttry {',
	'\t\t\tchildProcess.execFileSync(process.execPath, ["-e", "require(process.argv[1]);", "--", file], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "ignore", "pipe"] });',
	'\t\t\treturn { ok: true, code: "", text: "", crashed: false, timedOut: false };',
	'\t\t} catch (error) {',
	'\t\t\tconst signal = (error && error.signal) || "";',
	'\t\t\tconst timedOut = Boolean(error) && error.code === "ETIMEDOUT";',
	'\t\t\tconst text = String((error && error.stderr) || "");',
	'\t\t\tconst reported = /ERR_[A-Z0-9_]+/.exec(text);',
	'\t\t\tconst status = error && error.status !== undefined && error.status !== null ? String(error.status) : "UNKNOWN";',
	'\t\t\tconst code = timedOut ? "ETIMEDOUT" : (reported ? reported[0] : (signal || ("EXIT_" + status)));',
	'\t\t\treturn { ok: false, code: code, text: text, crashed: Boolean(signal) && !timedOut, timedOut: timedOut };',
	'\t\t}',
	'\t};',
	'\tfor (const entry of checked) {',
	'\t\tconst result = load(entry.file);',
	'\t\tif (result.ok) { emit("native.module." + entry.id, "loaded"); continue; }',
	'\t\tconst text = result.text + "\\n" + inspect(entry.file);',
	'\t\tconst reason = result.timedOut ? "timeout" : (result.crashed ? "crash" : classify(text));',
	'\t\tconst detail = tokens(text);',
	'\t\temit("native.module." + entry.id, "failed:" + String(result.code).slice(0, 32) + ":" + reason + (detail ? ":" + detail : ""));',
	'\t}',
	'\temit("native.probe", "ok");',
	'} catch (error) {',
	'\temit("native.probe", "error:" + String((error && error.code) || "unknown").slice(0, 32));',
	'}',
	// An addon that keeps a handle open would otherwise hold the SSH channel until
	// the caller times it out.
	'process.exit(0);'
].join('\n');
/** Runs the probe with the packaged Node of the activated version, writing nothing. */
function buildNativeProbeScript(commit: string): string {
	const paths = buildRemoteServerPathShellFragments();
	return [
		'set -u',
		'if [ -z "${HOME:-}" ]; then printf "%s\\n" "native.probe=home-invalid"; exit 0; fi',
		'BASE=$HOME',
		`COMMIT=${shellQuote(commit)}`,
		`VERSION_DIRECTORY=${paths.versionedDirectory}`,
		'NODE="$VERSION_DIRECTORY/node"',
		'if [ ! -x "$NODE" ]; then printf "%s\\n" "native.probe=node-missing"; exit 0; fi',
		// Remote stderr is discarded on purpose: an uncaught loader message would
		// otherwise carry absolute host paths into the trace artifact, and every
		// diagnosis the probe needs is already classified on stdout.
		`"$NODE" -e ${shellQuote(NATIVE_PROBE_SOURCE)} -- "$VERSION_DIRECTORY" 2>/dev/null`,
		'status=$?',
		'if [ "$status" -ne 0 ]; then printf "%s\\n" "native.probe=exit-$status"; fi',
		'exit 0',
		''
	].join('\n');
}
function buildNativeProbeArguments(destination: string, controlPath: string): readonly string[] {
	return ['-o', `ControlPath=${controlPath}`, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', destination, '--', '/bin/sh'];
}
/** Keeps only lines the probe could legitimately have produced. */
function parseNativeReport(output: string): ReadonlyMap<string, string> {
	const parsed = new Map<string, string>();
	for (const line of output.split('\n')) {
		const match = NATIVE_LINE.exec(line.trim());
		if (match && !match[1].includes('..') && parsed.size < NATIVE_LINE_LIMIT) { parsed.set(match[1], match[2]); }
	}
	return parsed;
}
function nativeReason(value: string): string {
	return value === 'loaded' ? 'loaded' : value.split(':')[2] ?? 'unknown';
}
async function probeNativeModules(runner: (arguments_: readonly string[]) => RemoteSshProcess, destination: string, controlPath: string, commit: string): Promise<void> {
	const probe = await runCommand(runner, buildNativeProbeArguments(destination, controlPath), buildNativeProbeScript(commit));
	const reported = parseNativeReport(probe.output);
	for (const entry of reported) { facts.push(entry); }
	const modules = [...reported].filter(([name]) => name.startsWith('native.module.'));
	// `Module did not self-register` is the one failure where the object and every
	// library it names resolved: the package simply ships an addon with no entry
	// point for this platform, as `@vscode/deviceid` does with `windows.node` on
	// Linux. That reproduces on the build machine, so failing on it would paint
	// every healthy host red. Every other category is the host loader refusing,
	// which is exactly what this probe exists to catch.
	const loaded = modules.filter(([, value]) => value === 'loaded').length;
	const unregistered = modules.filter(([, value]) => nativeReason(value) === 'not-self-registered').length;
	const rejected = modules.length - loaded - unregistered;
	facts.push(['native.modules.loaded', String(loaded)], ['native.modules.unregistered', String(unregistered)], ['native.modules.rejected', String(rejected)]);
	check('native-probe', probe.code === 0 && reported.get('native.probe') === 'ok');
	// The packaged runtime is the only one whose ABI matches the shipped addons,
	// so a probe run by some other Node on the host would prove nothing.
	check('native-probe-packaged-node', reported.get('native.node.packaged') === 'true');
	check('native-spdlog-checked', modules.some(([name]) => name.startsWith('native.module.@vscode/spdlog/')));
	// The logger is the module the incident is about, so it gets no category
	// exemption: it either loads or the smoke is red.
	check('native-spdlog-loaded', modules.some(([name, value]) => name.startsWith('native.module.@vscode/spdlog/') && value === 'loaded'));
	check('native-modules', modules.length > 0 && rejected === 0);
}
async function main(): Promise<void> {
	const destination = process.env['UNIGMA_VPS_ALIAS'];
	check('destination-required', typeof destination === 'string' && destination.length > 0);
	if (!destination) { return; }
	const ssh = executable('ssh');
	check('ssh', ssh !== undefined);
	if (!ssh) { return; }
	const workDirectory = join(repoRoot, '.build', 'remote-vps-staging');
	rmSync(workDirectory, { recursive: true, force: true });
	mkdirSync(workDirectory, { recursive: true });
	mkdirSync(dirname(tracePath), { recursive: true });
	writeFileSync(tracePath, '', { mode: 0o600 });
	const runner = tracedRunner();
	const payload = payloadFromStore(workDirectory);
	const payloadDirectory = join(workDirectory, 'payload');
	execFileSync(process.execPath, ['--experimental-strip-types', join(repoRoot, 'build/unigma/make-payload.ts'), '--server', payload.server, '--opencode', payload.opencode, '--output', payloadDirectory, '--client-commit', payload.commit, '--server-commit', payload.commit, '--target', 'linux-x64', '--opencode-license', payload.license]);
	const manifest = JSON.parse(readFileSync(join(payloadDirectory, 'manifest.json'), 'utf8')) as BootstrapManifest;
	const generated = buildRemoteStagingScript({ commit: payload.commit, manifest, retention: 1 });
	if (!generated.valid) { throw new Error('staging script generation failed'); }
	// Cleanup must work whether a prior version starts, is broken, or is absent;
	// the bare master makes no server-path writes before the guarded script runs.
	const initiallyOpened = await openRemoteControlMaster({ destination, timeoutMs: 30_000 }, { allocateLocalPort: () => 49152, spawn: runner });
	if ((initiallyOpened as { readonly ok?: boolean }).ok === false) {
		const failure = initiallyOpened as { readonly code?: string; readonly phase?: string };
		checks.push([`cleanup-initial.session.${failure.phase ?? 'unknown'}.${failure.code ?? 'unknown'}`, 'fail']);
		check('cleanup-initial', false);
		return;
	}
	const initialCleanupSession = initiallyOpened as { readonly controlPath: string; dispose(): Promise<void> };
	let initialCleanupPassed = false;
	try {
		const initialCleanup = await cleanupRemoteVersion(runner, destination, initialCleanupSession.controlPath, payload.commit, generated.script);
		checks.push([`cleanup-initial.delivery-exit.${initialCleanup.delivery.code}`, initialCleanup.delivery.code === 0 ? 'pass' : 'fail']);
		checks.push([`cleanup-initial.exit.${initialCleanup.cleanup.code}`, initialCleanup.cleanup.code === 0 ? 'pass' : 'fail']);
		checks.push([`cleanup-initial.status.${initialCleanup.status}`, initialCleanup.status === 'cleanup-complete' ? 'pass' : 'fail']);
		initialCleanupPassed = initialCleanup.delivery.code === 0 && initialCleanup.cleanup.code === 0 && initialCleanup.status === 'cleanup-complete';
		check('cleanup-initial', initialCleanupPassed);
	} finally {
		await initialCleanupSession.dispose().catch(() => undefined);
	}
	if (!initialCleanupPassed) {
		return;
	}
	const opened = await openRemoteServer({ destination, commit: payload.commit, retainControlMasterOnServerUnavailable: true, timeoutMs: 30_000 }, { allocateLocalPort: () => 49152, spawn: runner });
	const opening = opened as { readonly ok?: boolean; readonly code?: string; readonly phase?: string; readonly stagingSession?: { readonly controlPath: string; dispose(): Promise<void> } };
	check('staging-session', opening.ok === false && opening.code === 'ssh.remote-server-unavailable' && opening.stagingSession !== undefined);
	if (opening.ok !== false || opening.stagingSession === undefined) { return; }
	let stagingSession: { readonly controlPath: string; dispose(): Promise<void> } | undefined = opening.stagingSession;
	let finalSession: { readonly controlPath: string; readonly endpoint: { readonly port: number }; dispose(): Promise<void> } | undefined;
	let cleaned = false;
	try {
		const common = { destination, controlPath: stagingSession!.controlPath, commit: payload.commit, manifest, payloadDirectory, retention: 1, confirm: undefined as unknown as (summary: unknown) => boolean };
		const refused = await stageRemotePayload(common, { spawn: runner, spawnPayloadTar: tracedPayloadTarRunner() });
		check('confirmation-required', !refused.ok && refused.code === 'invalid-input');
		const rejected = await stageRemotePayload({ ...common, confirm: () => false }, { spawn: runner, spawnPayloadTar: tracedPayloadTarRunner() });
		check('confirmation-rejected', !rejected.ok && rejected.code === 'ssh.provisioning-denied' && rejected.phase === 'confirmation');
		const staged = await stageRemotePayload({ ...common, confirm: summary => summary.host === destination && summary.version === payload.commit && summary.totalSizeBytes === manifest.totalSizeBytes && /^[a-f0-9]{64}$/.test(summary.manifestHash) }, { spawn: runner, spawnPayloadTar: tracedPayloadTarRunner() });
		if (!staged.ok) {
			// Reporting only that staging failed has now cost four runner cycles
			// across these smokes. The phase and code are contract categories and
			// carry no destination, command or environment, so they are safe to keep.
			checks.push([`activated.${staged.phase}.${staged.code}`, 'fail']);
			check('activated', false);
			return;
		}
		check('activated', staged.status === 'activated');
		if (staged.status !== 'activated') {
			checks.push([`activated.status.${staged.status}`, 'fail']);
			return;
		}
		const repeated = await stageRemotePayload({ ...common, confirm: () => true }, { spawn: runner, spawnPayloadTar: tracedPayloadTarRunner() });
		check('idempotent', repeated.ok && repeated.status === 'already-activated');
		// Placed here because the versioned directory is only complete after
		// activation, and because every step from the transport onwards can return
		// early: collecting the native evidence first is what keeps a broken addon
		// from being hidden by a later failure, and it never short-circuits the
		// `/version` proof, so a run reports both defects instead of trading one
		// for the other.
		await probeNativeModules(runner, destination, stagingSession!.controlPath, payload.commit);
		const served = await openRemoteServer({ destination, commit: payload.commit, timeoutMs: 30_000 }, { allocateLocalPort: () => 49153, spawn: runner });
		if ((served as { readonly ok?: boolean }).ok === false) { check('activated-transport', false); return; }
		finalSession = served as { readonly controlPath: string; readonly endpoint: { readonly port: number }; dispose(): Promise<void> };
		check('activated-transport', true);
		const version = await new Promise<{ readonly code: number | undefined; readonly body: string }>((resolveRequest, reject) => {
			import('node:http').then(({ get }) => { const request = get({ host: '127.0.0.1', port: finalSession!.endpoint.port, path: '/version', timeout: 5_000 }, response => { const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(Buffer.from(chunk))); response.once('end', () => resolveRequest({ code: response.statusCode, body: Buffer.concat(chunks).toString('utf8') })); }); request.once('error', reject); request.once('timeout', () => request.destroy(new Error('version timeout'))); }).catch(reject);
		});
		check('version', version.code === 200 && version.body === payload.commit);
		await finalSession.dispose(); finalSession = undefined;
		if (keepStagedServer) {
			// The remote-window workflow consumes this activated version in its next
			// step; its always-run cleanup step owns removal after that window closes.
			check('staged-for-follow-up', true);
		} else {
			const finalCleanup = await cleanupRemoteVersion(runner, destination, stagingSession!.controlPath, payload.commit, generated.script);
			const delivery = finalCleanup.delivery;
			const result = finalCleanup.cleanup;
			// The maintainer asked for nothing to be left on that host, so a failed
			// cleanup has to say which half failed and what the host answered.
			checks.push([`cleanup.delivery-exit.${delivery.code}`, delivery.code === 0 ? 'pass' : 'fail']);
			checks.push([`cleanup.exit.${result.code}`, result.code === 0 ? 'pass' : 'fail']);
			const status = finalCleanup.status;
			checks.push([`cleanup.status.${status}`, status === 'cleanup-complete' ? 'pass' : 'fail']);
			check('cleanup', delivery.code === 0 && result.code === 0 && status === 'cleanup-complete');
		}
		await stagingSession.dispose();
		stagingSession = undefined;
		cleaned = keepStagedServer;
	} finally {
		if (finalSession) { await finalSession.dispose().catch(() => undefined); }
		if (!cleaned && stagingSession) {
			const cleanup = await cleanupRemoteVersion(runner, destination, stagingSession.controlPath, payload.commit, generated.script).catch(() => ({ delivery: { code: null, output: '' }, cleanup: { code: null, output: '' }, status: 'none' }));
			check('cleanup-on-error', cleanup.delivery.code === 0 && cleanup.cleanup.code === 0 && cleanup.status === 'cleanup-complete');
		}
		if (stagingSession) { await stagingSession.dispose().catch(() => undefined); }
		rmSync(workDirectory, { recursive: true, force: true });
	}
}

try { await main(); const passed = checks.length > 0 && checks.every(([, status]) => status === 'pass'); writeReport(passed ? 'pass' : 'fail'); if (!passed) { process.exitCode = 1; } } catch { check('unexpected-error', false); writeReport('fail'); process.exitCode = 1; }
