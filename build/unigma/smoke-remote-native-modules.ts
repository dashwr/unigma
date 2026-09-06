/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Asks an already activated remote server whether its native addons load.
 *
 * The staging smoke answers the same question, but only after deleting the
 * activated version and pushing a payload again. That is the wrong instrument
 * for a host that is already prepared: it writes, it needs the confirmation
 * flow, and a failure there says nothing about the version the window used.
 * This smoke opens a control master, runs the probe with the packaged Node of
 * the requested commit and writes nothing on the host.
 */

import { accessSync, appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { RemoteSshProcess, createRemoteSshProcessRunner as CreateRemoteSshProcessRunner, openRemoteServer as OpenRemoteServer } from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { buildRemoteServerPathShellFragments as BuildServerPathFragments } from '../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js';
import { buildNativeProbeArguments, buildNativeProbeScript, parseNativeReport, summarizeNativeReport } from './remote-native-probe.ts';

const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as { createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner; openRemoteServer: typeof OpenRemoteServer };
const plan = require('../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js') as { buildRemoteServerPathShellFragments: typeof BuildServerPathFragments };
const { createRemoteSshProcessRunner, openRemoteServer } = transport;
const { buildRemoteServerPathShellFragments } = plan;

const COMMIT = /^[0-9a-f]{40}$/;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-native-modules-smoke.txt'));
const tracePath = `${reportPath}.ssh-trace.log`;
const checks: Array<readonly [string, 'pass' | 'fail']> = [];
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
 * The commit has to name the version the host actually activated.
 *
 * Probing whatever the local store points at would silently move the question
 * to another tree, which is the mistake the window smoke already paid for.
 */
function requestedCommit(): string | undefined {
	const explicit = process.env['UNIGMA_ARTIFACT_COMMIT'];
	if (explicit) { return COMMIT.test(explicit) ? explicit : undefined; }
	const store = process.env['UNIGMA_ARTIFACT_ROOT'] ?? join(homedir(), '.local', 'share', 'unigma-artifacts');
	const provenance = join(store, 'unigma-server-latest', 'PROVENANCE.txt');
	if (!existsSync(provenance)) { return undefined; }
	const commit = readFileSync(provenance, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='))?.slice(7) ?? '';
	return COMMIT.test(commit) ? commit : undefined;
}
function runCommand(runner: (arguments_: readonly string[]) => RemoteSshProcess, arguments_: readonly string[], input = ''): Promise<{ readonly code: number | null; readonly output: string }> {
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
		const timer = setTimeout(() => { try { process_.kill('SIGTERM'); } catch { /* close event remains authoritative */ } finish(null); }, 120_000);
		process_.on('error', () => finish(null));
		process_.on('close', code => finish(code));
		try { process_.stdin.end(input); } catch { finish(null); }
	});
}

async function main(): Promise<void> {
	const destination = process.env['UNIGMA_VPS_ALIAS'];
	check('destination-required', typeof destination === 'string' && destination.length > 0);
	if (!destination) { return; }
	check('ssh', executable('ssh') !== undefined);
	if (!executable('ssh')) { return; }
	const commit = requestedCommit();
	check('commit-required', commit !== undefined);
	if (!commit) { return; }
	facts.push(['probe.commit', commit]);
	mkdirSync(dirname(tracePath), { recursive: true });
	writeFileSync(tracePath, '', { mode: 0o600 });
	const runner = tracedRunner();
	// The same call the staging smoke uses before probing. A bare control master
	// left the probe without a socket to reuse, and ssh then fell back to a
	// direct connection that answered nothing; going through the transport keeps
	// this smoke on the path that is already exercised elsewhere, and it also
	// says whether the activated version is answering at all.
	const opened = await openRemoteServer({ destination, commit, retainControlMasterOnServerUnavailable: true, timeoutMs: 30_000 }, { allocateLocalPort: () => 49154, spawn: runner });
	const result = opened as { readonly ok?: boolean; readonly code?: string; readonly phase?: string; readonly controlPath?: string; readonly stagingSession?: { readonly controlPath: string; dispose(): Promise<void> }; dispose?(): Promise<void> };
	const session = result.ok === false
		? result.stagingSession
		: (result as { readonly controlPath: string; dispose(): Promise<void> });
	facts.push(['server.reachable', String(result.ok !== false)]);
	if (result.ok === false) { facts.push([`server.unavailable.${result.phase ?? 'unknown'}`, result.code ?? 'unknown']); }
	check('session', session !== undefined);
	if (!session) { return; }
	try {
		const probe = await runCommand(runner, buildNativeProbeArguments(destination, session.controlPath), buildNativeProbeScript(commit, buildRemoteServerPathShellFragments().versionedDirectory));
		const summary = summarizeNativeReport(parseNativeReport(probe.output), probe.code);
		for (const entry of summary.facts) { facts.push(entry); }
		for (const [name, passed] of summary.checks) { check(name, passed); }
	} finally {
		// The control master is the only thing this smoke created anywhere, and
		// the activated version stays exactly as it was found.
		await session.dispose().catch(() => undefined);
	}
}

try { await main(); const passed = checks.length > 0 && checks.every(([, status]) => status === 'pass'); writeReport(passed ? 'pass' : 'fail'); if (!passed) { process.exitCode = 1; } } catch { check('unexpected-error', false); writeReport('fail'); process.exitCode = 1; }
