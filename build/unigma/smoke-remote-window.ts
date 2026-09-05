/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { accessSync, constants as fsConstants, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = /^[0-9a-f]{40}$/;
const ALIAS = /^[A-Za-z0-9._-]+$/;
const RESOLVER_SUCCESS = /resolveAuthority\(ssh-remote\) returned '[^']*' after ([0-9]+) ms/;
const RESOLVER_ERROR = /resolveAuthority\(ssh-remote\) returned an error after ([0-9]+) ms/;
const RESOLVED_AUTHORITY_CONSUMED = /\[remote-connection\]\[Management\s*\][^\n]*2\/6\. socketFactory\.connect\(\) was successful\./;
const CONNECTION_TOKEN_ACCEPTED = /\[remote-connection\]\[Management\s*\][^\n]*4\/6\. received SignRequest control message\./;
const EXTENSION_HOST_HANDSHAKE = /ExtensionHost\s*\][^\n]*handshake finished, connection is up and running after ([0-9]+) ms/;
const WORKSPACE_TRUST = /ssh\.workspace-blocked|workspace is not trusted/i;
const CONNECTION_TOKEN_FAILURE = /Unauthorized client refused|auth mismatch|handshake timed out|received error control message when negotiating connection|VSCODE_CONNECTION_ERROR|Unexpected handshake message/;
const WORKSPACE_TRUST_STORAGE_KEY = 'content.trust.model.key';
const STORAGE_TARGETS_KEY = '__$__targetStorageMarker';
const STORAGE_MACHINE_TARGET = '1';
const PYTHON_SQLITE_SEED = `
import sqlite3
import sys

database, key, value, targets_key, targets_value = sys.argv[1:6]
connection = sqlite3.connect(database)
try:
\tconnection.execute("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)")
\tconnection.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (key, value))
\tconnection.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (targets_key, targets_value))
\tconnection.commit()
\trow = connection.execute("SELECT value FROM ItemTable WHERE key = ?", (key,)).fetchone()
\ttargets_row = connection.execute("SELECT value FROM ItemTable WHERE key = ?", (targets_key,)).fetchone()
\tif row is None or row[0] != value or targets_row is None or targets_row[0] != targets_value:
\t\traise RuntimeError("seed verification failed")
finally:
\tconnection.close()
`;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-window-smoke.txt'));
const evidencePath = `${reportPath}.workbench.log`;
const checks: Array<readonly [string, 'pass' | 'fail' | 'info']> = [];
const facts: Array<readonly [string, string]> = [];

interface Observations {
	readonly resolverSuccess: boolean;
	readonly resolverError: boolean;
	readonly resolvedAuthorityConsumed: boolean;
	readonly connectionTokenHandshake: boolean;
	readonly trustBlocked: boolean;
	readonly tokenFailure: boolean;
	readonly extensionHostHandshake: boolean;
	readonly resolverElapsed?: string;
	readonly resolverErrorElapsed?: string;
	readonly handshakeElapsed?: string;
}

interface ArtifactPair {
	readonly desktopDirectory: string;
	readonly serverDirectory: string;
	readonly desktopCommit: string;
	readonly serverCommit: string;
}

function check(name: string, passed: boolean): void {
	checks.push([name, passed ? 'pass' : 'fail']);
}

function info(name: string): void {
	checks.push([name, 'info']);
}

function writeReport(status: 'pass' | 'fail'): void {
	const report = [
		...facts.map(([name, value]) => `${name}=${value}`),
		...checks.map(([name, result]) => `check.${name}=${result}`),
		`smoke=${status}`,
	].join('\n') + '\n';
	try {
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, report, { mode: 0o600 });

	} catch {
		// Stdout remains the workflow-visible report when the requested path is unavailable.

	}
	process.stdout.write(report);
}

function readProvenanceCommit(directory: string): string {
	const provenance = join(directory, 'PROVENANCE.txt');
	if (!existsSync(provenance)) {
		return '';

	}
	try {
		return readFileSync(provenance, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='))?.slice('commit='.length) ?? '';

	} catch {
		return '';

	}
}

function artifactPair(): ArtifactPair {
	const store = process.env['UNIGMA_ARTIFACT_ROOT'] ?? join(homedir(), '.local', 'share', 'unigma-artifacts');
	const desktopDirectory = join(store, 'unigma-latest');
	const serverDirectory = join(store, 'unigma-server-latest');
	return {
		desktopDirectory,
		serverDirectory,
		desktopCommit: readProvenanceCommit(desktopDirectory),
		serverCommit: readProvenanceCommit(serverDirectory),

	};
}

function isExecutable(file: string): boolean {
	try {
		return statSync(file).isFile() && (accessSync(file, fsConstants.X_OK), true);

	} catch {
		return false;

	}
}

function walkLogs(directory: string, output: string[]): void {
	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });

	} catch {
		return;

	}
	for (const entry of entries) {
		if (entry.isSymbolicLink()) {
			continue;

		}
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			walkLogs(path, output);

		} else if (entry.isFile() && output.length < 64) {
			try {
				output.push(readFileSync(path, { encoding: 'utf8', flag: 'r' }).slice(0, 4 * 1024 * 1024));

			} catch {
				// A log can be rotated while the workbench is running.

			}

		}

	}
}

function observeLogs(directory: string): Observations & { readonly rawText: string } {
	const files: string[] = [];
	walkLogs(directory, files);
	const text = files.join('\n');
	const resolverSuccess = RESOLVER_SUCCESS.exec(text);
	const resolverError = RESOLVER_ERROR.exec(text);
	const resolvedAuthorityConsumed = RESOLVED_AUTHORITY_CONSUMED.test(text);
	const connectionTokenHandshake = CONNECTION_TOKEN_ACCEPTED.test(text);
	const handshake = EXTENSION_HOST_HANDSHAKE.exec(text);
	return {
		rawText: text,
		resolverSuccess: resolverSuccess !== null,
		resolverError: resolverError !== null,
		resolvedAuthorityConsumed,
		connectionTokenHandshake,
		trustBlocked: WORKSPACE_TRUST.test(text),
		tokenFailure: CONNECTION_TOKEN_FAILURE.test(text),
		extensionHostHandshake: handshake !== null,
		resolverElapsed: resolverSuccess?.[1],
		resolverErrorElapsed: resolverError?.[1],
		handshakeElapsed: handshake?.[1],

	};
}

/**
 * The closed set of failure categories the SSH contract defines.
 *
 * The evidence writer reported only whether fixed patterns were present, so a
 * refusal arrived without saying which refusal it was. These are contract
 * categories, not free text: they carry no host, path, user or environment, so
 * naming the one that appeared is safe and is the difference between a
 * diagnosis and another runner cycle.
 */
const CONTRACT_CATEGORIES = [
	'ssh.authentication-unavailable',
	'ssh.client-commit-unavailable',
	'ssh.client-unavailable',
	'ssh.connection-lost',
	'ssh.forward-failed',
	'ssh.host-key-untrusted',
	'ssh.provisioning-denied',
	'ssh.remote-home-invalid',
	'ssh.remote-platform-unsupported',
	'ssh.remote-server-incompatible',
	'ssh.remote-server-unavailable',
	'ssh.remote-socket-path-too-long',
	'ssh.target-unresolved',
	'ssh.transport-failed',
	'ssh.workspace-blocked'
] as const;

/**
 * The closed set of phases the resolver can name.
 *
 * Knowing the category without the phase still costs a runner cycle: the same
 * category means something different when it comes from the handshake than from
 * the bootstrap. Phases are contract vocabulary and carry nothing else.
 */
const CONTRACT_PHASES = [
	'authority', 'bootstrap', 'client', 'commit', 'confirmation', 'connect',
	'forward', 'handshake', 'host', 'lifecycle', 'payload-transfer', 'platform',
	'remote-execution', 'script-delivery', 'validation', 'workspace'
] as const;

function observedPhases(text: string): readonly string[] {
	return CONTRACT_PHASES.filter(phase => text.includes(`[${phase}]`));
}

/**
 * Why the host said the server was not there.
 *
 * The category and the phase together still did not say whether the version was
 * missing or its entry point was not executable, which are the two halves of the
 * same refusal and have different causes. The vocabulary is fixed by the remote
 * script, so nothing host-specific can travel here.
 */
const CONTRACT_REASONS = ['missing-version', 'entry-point-not-executable'] as const;

function observedReasons(text: string): readonly string[] {
	return CONTRACT_REASONS.filter(reason => text.includes(`reason=${reason}`));
}

function observedContractCategories(text: string): readonly string[] {
	return CONTRACT_CATEGORIES.filter(category => text.includes(category));
}

/**
 * Exit status of the SSH process when it closed without answering.
 *
 * `ssh.remote-server-unavailable` is emitted both by the explicit refusal and by
 * the generic verdict for a session that died silently, and the sanitized log
 * kept only the code. A run reported that code with no reason at all, which the
 * evidence could not explain, so the number is published as well: it is produced
 * by the local process and bounded to two digits, so no host data rides on it.
 */
function observedExitCodes(text: string): readonly string[] {
	const codes = new Set<string>();
	for (const match of text.matchAll(/\bexit=(\d{1,3})\b/g)) {
		codes.add(match[1]);
	}
	return [...codes].sort();
}

function writeSanitizedEvidence(observations: Observations, resolverAttempted = false, rawText = ''): void {
	const lines: string[] = [];
	for (const category of observedContractCategories(rawText)) {
		lines.push(`observed=${category}`);
	}
	for (const phase of observedPhases(rawText)) {
		lines.push(`observed-phase=${phase}`);
	}
	for (const reason of observedReasons(rawText)) {
		lines.push(`observed-reason=${reason}`);
	}
	for (const exitCode of observedExitCodes(rawText)) {
		lines.push(`observed-exit=${exitCode}`);
	}
	if (observations.resolverSuccess) {
		lines.push(`resolveAuthority(ssh-remote) returned after ${observations.resolverElapsed ?? 'unknown'} ms`);

	}
	if (observations.resolverError) {
		lines.push(`resolveAuthority(ssh-remote) returned an error after ${observations.resolverErrorElapsed ?? 'unknown'} ms`);

	}
	if (observations.resolvedAuthorityConsumed) {
		lines.push('remote ResolvedAuthority consumed by the management connection');

	} else if (resolverAttempted) {
		lines.push('category=ssh.resolved-authority-consumed');

	}
	if (observations.connectionTokenHandshake) {
		lines.push('remote connection token handshake accepted');

	} else if (resolverAttempted) {
		lines.push('category=ssh.connection-token-handshake');

	}
	if (observations.extensionHostHandshake) {
		lines.push(`remote ExtensionHost handshake finished after ${observations.handshakeElapsed ?? 'unknown'} ms`);

	}
	if (observations.trustBlocked) {
		lines.push('category=ssh.workspace-blocked');

	}
	if (observations.tokenFailure) {
		lines.push('category=ssh.connection-token-handshake');

	}
	try {
		mkdirSync(dirname(evidencePath), { recursive: true });
		writeFileSync(evidencePath, `${lines.join('\n')}\n`, { mode: 0o600 });

	} catch {
		// The report remains available on stdout if evidence storage is unavailable.

	}
}

function waitForClose(process_: ChildProcess, timeoutMs: number): Promise<void> {
	return new Promise(resolveClose => {
		if (process_.exitCode !== null || process_.signalCode !== null) {
			resolveClose();
			return;

		}
		let settled = false;
		const finish = (): void => {
			if (settled) {
				return;

			}
			settled = true;
			clearTimeout(timer);
			resolveClose();

		};
		const timer = setTimeout(finish, timeoutMs);
		process_.once('close', finish);
		process_.once('error', finish);

	});
}

async function terminate(process_: ChildProcess | undefined): Promise<void> {
	if (!process_ || process_.exitCode !== null || process_.signalCode !== null) {
		return;

	}
	const closed = waitForClose(process_, 10_000);
	if (!process_.kill('SIGTERM')) {
		process_.kill('SIGKILL');

	}
	await closed;
}

async function delay(milliseconds: number): Promise<void> {
	await new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function workspaceTrustState(alias: string): string {
	// URI.toJSON() for the canonical remote URI emits the marshalling id and only
	// non-empty components; the resolver has no canonical URI rewrite of its own.
	return JSON.stringify({
		uriTrustInfo: [{
			uri: {
				$mid: 1,
				path: '/root',
				scheme: 'vscode-remote',
				authority: `ssh-remote+${alias}`
			},
			trusted: true
		}]
	});
}

function seedWorkspaceTrust(databasePath: string, alias: string): { readonly seeded: boolean; readonly reason: string } {
	// Keep this DDL identical to src/vs/base/parts/storage/node/storage.ts:343;
	// the workbench owns this SQLite schema, and the smoke only prepares its state.
	const result = spawnSync('python3', ['-c', PYTHON_SQLITE_SEED, databasePath, WORKSPACE_TRUST_STORAGE_KEY, workspaceTrustState(alias), STORAGE_TARGETS_KEY, JSON.stringify({ [WORKSPACE_TRUST_STORAGE_KEY]: Number(STORAGE_MACHINE_TARGET) })], {
		encoding: 'utf8',
		stdio: ['ignore', 'ignore', 'pipe']
	});
	if (result.error) {
		return { seeded: false, reason: result.error.code === 'ENOENT' ? 'python3-unavailable' : 'python3-failed-to-start' };
	}
	if (result.status !== 0) {
		return { seeded: false, reason: result.status === null ? 'sqlite-process-signaled' : 'sqlite-write-or-verification-failed' };
	}
	return { seeded: true, reason: 'sqlite-row-verified' };
}

async function main(): Promise<void> {
	// This is deliberately the first assertion: a stale desktop/server pair makes
	// the resolver refuse correctly and would otherwise look like a workbench bug.
	const pair = artifactPair();
	facts.push(['desktop.commit', COMMIT.test(pair.desktopCommit) ? pair.desktopCommit : 'unavailable']);
	facts.push(['server.commit', COMMIT.test(pair.serverCommit) ? pair.serverCommit : 'unavailable']);
	check('artifact-commit-pair', COMMIT.test(pair.desktopCommit) && pair.desktopCommit === pair.serverCommit);
	if (!COMMIT.test(pair.desktopCommit) || pair.desktopCommit !== pair.serverCommit) {
		facts.push(['result', 'artifact-commit-mismatch']);
		return;

	}

	const alias = process.env['UNIGMA_VPS_ALIAS'] ?? '';
	check('alias', ALIAS.test(alias));
	if (!ALIAS.test(alias)) {
		facts.push(['result', 'alias-invalid']);
		return;

	}

	const binary = join(pair.desktopDirectory, 'unigma');
	const productPath = join(pair.desktopDirectory, 'resources', 'app', 'product.json');
	check('desktop-package', existsSync(productPath));
	check('desktop-binary', isExecutable(binary));
	// The resolver asks the host for the commit stamped into the packaged
	// product.json, not for the one the artifact publisher recorded. Comparing the
	// two PROVENANCE files left that unchecked, so a package built from a commit
	// other than the one it was published under looks paired here and is refused
	// by the host as a missing server.
	let productCommit = '';
	try {
		productCommit = String((JSON.parse(readFileSync(productPath, 'utf8')) as { readonly commit?: unknown }).commit ?? '');
	} catch {
		productCommit = '';
	}
	facts.push(['desktop.product-commit', COMMIT.test(productCommit) ? productCommit : 'unreadable']);
	check('product-commit-matches-server', productCommit === pair.serverCommit);
	if (!isExecutable(binary)) {
		facts.push(['result', 'desktop-binary-unavailable']);
		return;

	}

	let stateRoot: string | undefined;
	let process_: ChildProcess | undefined;
	let observations: Observations = {
		resolverSuccess: false,
		resolverError: false,
		resolvedAuthorityConsumed: false,
		connectionTokenHandshake: false,
		trustBlocked: false,
		tokenFailure: false,
		extensionHostHandshake: false,

	};
	try {
		const cacheDirectory = join(homedir(), '.cache');
		mkdirSync(cacheDirectory, { recursive: true });
		stateRoot = mkdtempSync(join(cacheDirectory, 'unigma-remote-window-'));
		const userDataDirectory = join(stateRoot, 'user-data');
		const sharedDataDirectory = join(userDataDirectory, 'shared-data');
		const extensionsDirectory = join(stateRoot, 'extensions');
		const logsDirectory = join(stateRoot, 'logs');
		const crashDirectory = join(stateRoot, 'crashes');
		for (const directory of [userDataDirectory, sharedDataDirectory, join(sharedDataDirectory, 'sharedStorage'), extensionsDirectory, logsDirectory, crashDirectory]) {
			mkdirSync(directory);

		}
		const folderUri = `vscode-remote://ssh-remote+${alias}/root`;
		const trustSeed = seedWorkspaceTrust(join(sharedDataDirectory, 'sharedStorage', 'state.vscdb'), alias);
		check('workspace-trust-seeded', trustSeed.seeded);
		facts.push(['workspace-trust', trustSeed.seeded ? 'seeded-by-smoke' : `not-seeded:${trustSeed.reason}`]);
		if (!trustSeed.seeded) {
			facts.push(['result', 'workspace-trust-seed-failed']);
			info('workspace-trust-blocked');
			return;

		}
		process_ = spawn(binary, [
			'--skip-release-notes',
			'--skip-welcome',
			'--disable-telemetry',
			'--disable-experiments',
			'--disable-updates',
			'--log=trace',
			`--folder-uri=${folderUri}`,
			`--user-data-dir=${userDataDirectory}`,
			`--shared-data-dir=${sharedDataDirectory}`,
			`--extensions-dir=${extensionsDirectory}`,
			`--logsPath=${logsDirectory}`,
			`--crash-reporter-directory=${crashDirectory}`,
		], { stdio: ['ignore', 'pipe', 'pipe'] });
		process_.stdout?.resume();
		process_.stderr?.resume();
		let processError = false;
		process_.once('error', () => { processError = true; });
		const deadline = Date.now() + 120_000;
		while (Date.now() < deadline) {
			observations = observeLogs(logsDirectory);
			if (observations.trustBlocked || observations.resolverError || observations.tokenFailure || (observations.resolverSuccess && observations.extensionHostHandshake) || processError || process_.exitCode !== null) {
				break;

			}
			await delay(250);

		}
		observations = observeLogs(logsDirectory);
		check('workbench-resolver', observations.resolverSuccess && !observations.resolverError);
		check('resolved-authority-consumed', observations.resolverSuccess && observations.resolvedAuthorityConsumed);
		check('extension-host-handshake', observations.extensionHostHandshake);
		check('connection-token-handshake', observations.resolverSuccess && observations.connectionTokenHandshake && !observations.tokenFailure);
		check('remote-window', observations.resolverSuccess && observations.resolvedAuthorityConsumed && observations.extensionHostHandshake && observations.connectionTokenHandshake && !observations.tokenFailure);
		if (observations.trustBlocked) {
			facts.push(['result', 'workspace-trust-blocked']);
			info('workspace-trust-blocked');
		} else if (observations.resolverError || !observations.resolverSuccess) {
			facts.push(['result', 'workbench-resolver-failed']);
		} else if (!observations.resolvedAuthorityConsumed) {
			facts.push(['result', 'resolved-authority-consumption-failed']);
		} else if (observations.tokenFailure || !observations.connectionTokenHandshake) {
			facts.push(['result', 'connection-token-handshake-failed']);
		} else if (!observations.extensionHostHandshake) {
			facts.push(['result', 'extension-host-handshake-failed']);
		} else {
			facts.push(['result', 'remote-window']);
		}

	} finally {
		await terminate(process_);
		observations = stateRoot ? observeLogs(join(stateRoot, 'logs')) : observations;
		writeSanitizedEvidence(observations, process_ !== undefined, (observations as { readonly rawText?: string }).rawText ?? '');
		if (stateRoot) {
			rmSync(stateRoot, { recursive: true, force: true });
			check('state-cleanup', !existsSync(stateRoot));

		}

	}
}

try {
	await main();
	const passed = checks.length > 0 && !checks.some(([, status]) => status === 'fail');
	writeReport(passed ? 'pass' : 'fail');
	if (!passed) {
		process.exitCode = 1;

	}
} catch {
	check('unexpected-error', false);
	writeSanitizedEvidence({ resolverSuccess: false, resolverError: false, resolvedAuthorityConsumed: false, connectionTokenHandshake: false, trustBlocked: false, tokenFailure: false, extensionHostHandshake: false });
	writeReport('fail');
	process.exitCode = 1;
}
