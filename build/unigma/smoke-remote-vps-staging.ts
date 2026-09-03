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
import type { RemoteSshProcess, createRemoteSshProcessRunner as CreateRemoteSshProcessRunner, openRemoteServer as OpenRemoteServer } from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { BootstrapManifest } from '../../extensions/unigma-remote-ssh/out/bootstrapManifest.js';
import type { buildRemoteStagingCleanupArguments as BuildCleanupArguments, buildRemoteStagingScriptDeliveryArguments as BuildDeliveryArguments, createRemotePayloadTarRunner as CreatePayloadTarRunner, stageRemotePayload as StageRemotePayload } from '../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js';
import type { buildRemoteStagingScript as BuildStagingScript } from '../../extensions/unigma-remote-ssh/out/remoteStagingScript.js';

const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as { createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner; openRemoteServer: typeof OpenRemoteServer };
const staging = require('../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js') as { buildRemoteStagingCleanupArguments: typeof BuildCleanupArguments; buildRemoteStagingScriptDeliveryArguments: typeof BuildDeliveryArguments; createRemotePayloadTarRunner: typeof CreatePayloadTarRunner; stageRemotePayload: typeof StageRemotePayload };
const script = require('../../extensions/unigma-remote-ssh/out/remoteStagingScript.js') as { buildRemoteStagingScript: typeof BuildStagingScript };
const { createRemoteSshProcessRunner, openRemoteServer } = transport;
const { buildRemoteStagingCleanupArguments, buildRemoteStagingScriptDeliveryArguments, createRemotePayloadTarRunner, stageRemotePayload } = staging;
const { buildRemoteStagingScript } = script;

const COMMIT = /^[0-9a-f]{40}$/;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-vps-staging-smoke.txt'));
const tracePath = `${reportPath}.ssh-trace.log`;
const checks: Array<readonly [string, 'pass' | 'fail']> = [];

function check(name: string, passed: boolean): void { checks.push([name, passed ? 'pass' : 'fail']); }
function writeReport(status: 'pass' | 'fail'): void {
	const report = [...checks.map(([name, result]) => `check.${name}=${result}`), `smoke=${status}`].join('\n') + '\n';
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
	// The transport correctly treats an existing executable as a server to start,
	// so a second smoke run gets a ready session instead of the staging session it
	// expects. Remove that version first through the same guarded staging script.
	const initiallyOpened = await openRemoteServer({ destination, commit: payload.commit, retainControlMasterOnServerUnavailable: true, timeoutMs: 30_000 }, { allocateLocalPort: () => 49152, spawn: runner });
	let initialCleanupSession: { readonly controlPath: string; dispose(): Promise<void> } | undefined;
	if ((initiallyOpened as { readonly ok?: boolean }).ok === false) {
		initialCleanupSession = (initiallyOpened as { readonly stagingSession?: typeof initialCleanupSession }).stagingSession;
	} else {
		initialCleanupSession = initiallyOpened as { readonly controlPath: string; dispose(): Promise<void> };
	}
	if (!initialCleanupSession) {
		const failure = initiallyOpened as { readonly code?: string; readonly phase?: string };
		checks.push([`cleanup-initial.session.${failure.phase ?? 'unknown'}.${failure.code ?? 'unknown'}`, 'fail']);
		check('cleanup-initial', false);
		return;
	}
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
		const served = await openRemoteServer({ destination, commit: payload.commit, timeoutMs: 30_000 }, { allocateLocalPort: () => 49153, spawn: runner });
		if ((served as { readonly ok?: boolean }).ok === false) { check('activated-transport', false); return; }
		finalSession = served as { readonly controlPath: string; readonly endpoint: { readonly port: number }; dispose(): Promise<void> };
		check('activated-transport', true);
		const version = await new Promise<{ readonly code: number | undefined; readonly body: string }>((resolveRequest, reject) => {
			import('node:http').then(({ get }) => { const request = get({ host: '127.0.0.1', port: finalSession!.endpoint.port, path: '/version', timeout: 5_000 }, response => { const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(Buffer.from(chunk))); response.once('end', () => resolveRequest({ code: response.statusCode, body: Buffer.concat(chunks).toString('utf8') })); }); request.once('error', reject); request.once('timeout', () => request.destroy(new Error('version timeout'))); }).catch(reject);
		});
		check('version', version.code === 200 && version.body === payload.commit);
		await finalSession.dispose(); finalSession = undefined;
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
		await stagingSession.dispose();
		stagingSession = undefined;
		cleaned = true;
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
