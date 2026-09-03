/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, type ChildProcess } from 'node:child_process';
import { accessSync, constants as fsConstants, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = /^[0-9a-f]{40}$/;
const ALIAS = /^[A-Za-z0-9._-]+$/;
const RESOLVER_SUCCESS = /resolveAuthority\(ssh-remote\) returned '[^']*' after ([0-9]+) ms/;
const RESOLVER_ERROR = /resolveAuthority\(ssh-remote\) returned an error after ([0-9]+) ms/;
const EXTENSION_HOST_HANDSHAKE = /ExtensionHost\s*\][^\n]*handshake finished, connection is up and running after ([0-9]+) ms/;
const WORKSPACE_TRUST = /ssh\.workspace-blocked|workspace is not trusted/i;
const CONNECTION_TOKEN_FAILURE = /Unauthorized client refused|auth mismatch|handshake timed out|received error control message when negotiating connection|VSCODE_CONNECTION_ERROR|Unexpected handshake message/;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-window-smoke.txt'));
const evidencePath = `${reportPath}.workbench.log`;
const checks: Array<readonly [string, 'pass' | 'fail' | 'info']> = [];
const facts: Array<readonly [string, string]> = [];

interface Observations {
	readonly resolverSuccess: boolean;
	readonly resolverError: boolean;
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

function observeLogs(directory: string): Observations {
	const files: string[] = [];
	walkLogs(directory, files);
	const text = files.join('\n');
	const resolverSuccess = RESOLVER_SUCCESS.exec(text);
	const resolverError = RESOLVER_ERROR.exec(text);
	const handshake = EXTENSION_HOST_HANDSHAKE.exec(text);
	return {
		resolverSuccess: resolverSuccess !== null,
		resolverError: resolverError !== null,
		trustBlocked: WORKSPACE_TRUST.test(text),
		tokenFailure: CONNECTION_TOKEN_FAILURE.test(text),
		extensionHostHandshake: handshake !== null,
		resolverElapsed: resolverSuccess?.[1],
		resolverErrorElapsed: resolverError?.[1],
		handshakeElapsed: handshake?.[1],

	};
}

function writeSanitizedEvidence(observations: Observations): void {
	const lines: string[] = [];
	if (observations.resolverSuccess) {
		lines.push(`resolveAuthority(ssh-remote) returned after ${observations.resolverElapsed ?? 'unknown'} ms`);

	}
	if (observations.resolverError) {
		lines.push(`resolveAuthority(ssh-remote) returned an error after ${observations.resolverErrorElapsed ?? 'unknown'} ms`);

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
	check('desktop-package', existsSync(join(pair.desktopDirectory, 'resources', 'app', 'product.json')));
	check('desktop-binary', isExecutable(binary));
	if (!isExecutable(binary)) {
		facts.push(['result', 'desktop-binary-unavailable']);
		return;

	}

	let stateRoot: string | undefined;
	let process_: ChildProcess | undefined;
	let observations: Observations = {
		resolverSuccess: false,
		resolverError: false,
		trustBlocked: false,
		tokenFailure: false,
		extensionHostHandshake: false,

	};
	try {
		const cacheDirectory = join(homedir(), '.cache');
		mkdirSync(cacheDirectory, { recursive: true });
		stateRoot = mkdtempSync(join(cacheDirectory, 'unigma-remote-window-'));
		const userDataDirectory = join(stateRoot, 'user-data');
		const extensionsDirectory = join(stateRoot, 'extensions');
		const logsDirectory = join(stateRoot, 'logs');
		const crashDirectory = join(stateRoot, 'crashes');
		for (const directory of [userDataDirectory, extensionsDirectory, logsDirectory, crashDirectory]) {
			mkdirSync(directory);

		}
		const folderUri = `vscode-remote://ssh-remote+${alias}/root`;
		process_ = spawn(binary, [
			'--skip-release-notes',
			'--skip-welcome',
			'--disable-telemetry',
			'--disable-experiments',
			'--disable-updates',
			'--log=trace',
			`--folder-uri=${folderUri}`,
			`--user-data-dir=${userDataDirectory}`,
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
			if (observations.trustBlocked || observations.tokenFailure || (observations.resolverSuccess && observations.extensionHostHandshake) || processError || process_.exitCode !== null) {
				break;

			}
			await delay(250);

		}
		observations = observeLogs(logsDirectory);
		if (observations.trustBlocked) {
			facts.push(['result', 'workspace-trust-blocked']);
			info('workbench-resolver');
			check('workspace-trust-blocked', true);
			info('resolved-authority-consumed');
			info('connection-token-handshake');

		} else {
			check('workbench-resolver', observations.resolverSuccess);
			check('resolved-authority-consumed', observations.resolverSuccess);
			check('extension-host-handshake', observations.extensionHostHandshake);
			check('connection-token-handshake', observations.resolverSuccess && observations.extensionHostHandshake && !observations.tokenFailure);
			check('remote-window', observations.resolverSuccess && observations.extensionHostHandshake && !observations.tokenFailure);
			facts.push(['result', observations.tokenFailure ? 'connection-token-handshake-failed' : 'remote-window']);

		}

	} finally {
		await terminate(process_);
		observations = stateRoot ? observeLogs(join(stateRoot, 'logs')) : observations;
		writeSanitizedEvidence(observations);
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
	writeSanitizedEvidence({ resolverSuccess: false, resolverError: false, trustBlocked: false, tokenFailure: false, extensionHostHandshake: false });
	writeReport('fail');
	process.exitCode = 1;
}
