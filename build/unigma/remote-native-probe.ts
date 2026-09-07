/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Native addon evidence collected from the host that runs the server.
 *
 * The probe used to live inside the staging smoke, which meant the only way to
 * learn whether the shipped addons load was to delete the activated version and
 * push a payload again. Keeping it here lets an already activated server be
 * asked the same question without writing anything to the host.
 */

// Mirrors the probe sanitiser, so a host cannot widen the report by answering.
// The key carries a package-relative addon path and needs a separator; a value
// never does, which is what keeps an absolute path out of the report even if the
// answer was crafted rather than produced by the probe.
const NATIVE_LINE = /^(native\.[A-Za-z0-9.@/_+-]{1,140})=([A-Za-z0-9._+,:-]{1,160})$/;
const NATIVE_LINE_LIMIT = 256;

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
export function buildNativeProbeScript(commit: string, versionedDirectory: string): string {
	return [
		'set -u',
		'if [ -z "${HOME:-}" ]; then printf "%s\\n" "native.probe=home-invalid"; exit 0; fi',
		'BASE=$HOME',
		`COMMIT=${shellQuote(commit)}`,
		`VERSION_DIRECTORY=${versionedDirectory}`,
		'NODE="$VERSION_DIRECTORY/node"',
		// Two read-only tests, reported as facts and never as a gate. The
		// runtime looks for the bundle the desktop package writes,
		// `<appRoot>/opencode/bin/opencode`, but `build/gulpfile.reh.ts` ships
		// no OpenCode at all and the payload lands it beside the server
		// executable instead, as `<appRoot>/bin/opencode`. Which of the two the
		// activated version actually has was read from source until now; this
		// asks the host.
		'if [ -x "$VERSION_DIRECTORY/opencode/bin/opencode" ]; then printf "%s\\n" "native.opencode.desktop-layout=executable"; elif [ -e "$VERSION_DIRECTORY/opencode/bin/opencode" ]; then printf "%s\\n" "native.opencode.desktop-layout=present"; else printf "%s\\n" "native.opencode.desktop-layout=absent"; fi',
		'if [ -x "$VERSION_DIRECTORY/bin/opencode" ]; then printf "%s\\n" "native.opencode.server-layout=executable"; elif [ -e "$VERSION_DIRECTORY/bin/opencode" ]; then printf "%s\\n" "native.opencode.server-layout=present"; else printf "%s\\n" "native.opencode.server-layout=absent"; fi',
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

export function buildNativeProbeArguments(destination: string, controlPath: string): readonly string[] {
	return ['-o', `ControlPath=${controlPath}`, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', destination, '--', '/bin/sh'];
}

/** Keeps only lines the probe could legitimately have produced. */
export function parseNativeReport(output: string): ReadonlyMap<string, string> {
	const parsed = new Map<string, string>();
	for (const line of output.split('\n')) {
		const match = NATIVE_LINE.exec(line.trim());
		if (match && !match[1].includes('..') && parsed.size < NATIVE_LINE_LIMIT) { parsed.set(match[1], match[2]); }
	}
	return parsed;
}

export function nativeReason(value: string): string {
	return value === 'loaded' ? 'loaded' : value.split(':')[2] ?? 'unknown';
}

export interface NativeProbeSummary {
	readonly facts: ReadonlyArray<readonly [string, string]>;
	readonly checks: ReadonlyArray<readonly [string, boolean]>;
	readonly loaded: number;
	readonly unregistered: number;
	readonly rejected: number;
}

/**
 * Turns a probe answer into the same facts and checks both smokes report.
 *
 * `Module did not self-register` is the one failure where the object and every
 * library it names resolved: the package simply ships an addon with no entry
 * point for this platform, as `@vscode/deviceid` does with `windows.node` on
 * Linux. That reproduces on the build machine, so failing on it would paint
 * every healthy host red. Every other category is the host loader refusing,
 * which is exactly what this probe exists to catch.
 */
export function summarizeNativeReport(reported: ReadonlyMap<string, string>, exitCode: number | null): NativeProbeSummary {
	const modules = [...reported].filter(([name]) => name.startsWith('native.module.'));
	const loaded = modules.filter(([, value]) => value === 'loaded').length;
	const unregistered = modules.filter(([, value]) => nativeReason(value) === 'not-self-registered').length;
	const rejected = modules.length - loaded - unregistered;
	return {
		facts: [...reported, ['native.modules.loaded', String(loaded)] as const, ['native.modules.unregistered', String(unregistered)] as const, ['native.modules.rejected', String(rejected)] as const],
		checks: [
			['native-probe', exitCode === 0 && reported.get('native.probe') === 'ok'],
			// The packaged runtime is the only one whose ABI matches the shipped
			// addons, so a probe run by some other Node on the host proves nothing.
			['native-probe-packaged-node', reported.get('native.node.packaged') === 'true'],
			['native-spdlog-checked', modules.some(([name]) => name.startsWith('native.module.@vscode/spdlog/'))],
			// The logger is the module the incident is about, so it gets no
			// category exemption: it either loads or the smoke is red.
			['native-spdlog-loaded', modules.some(([name, value]) => name.startsWith('native.module.@vscode/spdlog/') && value === 'loaded')],
			['native-modules', modules.length > 0 && rejected === 0]
		],
		loaded,
		unregistered,
		rejected
	};
}
