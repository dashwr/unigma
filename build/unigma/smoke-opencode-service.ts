/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { accessSync, constants as fsConstants, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface OwnedProcessHandle {
	readonly owner: string;
	readonly id: string;
	readonly pid: number;
	readonly endpoint: string;
	readonly workspaceUri: string;
}

interface ProcessManager {
	ensureStarted(workspace: { readonly uri: string }): Promise<OwnedProcessHandle>;
	stopOwned(): Promise<void>;
}

interface OpenCodeClient {
	connect(process: OwnedProcessHandle): Promise<void>;
	disconnect(): Promise<void>;
	send(request: { readonly method: 'GET'; readonly path: string }): Promise<unknown>;
}

interface ResolverModule {
	resolveOpenCodeCommand(candidates: {
		readonly embedded?: { readonly command: string; readonly exists: boolean; readonly executable: boolean };
		readonly configured?: { readonly command: string; readonly exists: boolean; readonly executable: boolean };
		readonly path?: { readonly command: string; readonly exists: boolean; readonly executable: boolean };
	}): { readonly kind: string; readonly command?: string; readonly code?: string };
}

interface ProcessManagerModule {
	ChildProcessManager: new (options: { readonly applicationDirectory: string; readonly startupTimeoutMs: number }) => ProcessManager;
}

interface OpenCodeClientModule {
	OpenCodeHttpClient: new (options: { readonly requestTimeoutMs: number; readonly startupTimeoutMs: number; readonly healthCheckIntervalMs: number }) => OpenCodeClient;
	SUPPORTED_OPENCODE_VERSION: string;
}

interface RecordValue {
	readonly [key: string]: unknown;
}

const STARTUP_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 30_000;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageDirectory = process.argv[2] ? resolve(process.argv[2]) : undefined;
const reportPath = resolve(process.argv[3] ?? join(repoRoot, '.build', 'logs', 'unigma-opencode-service-smoke.txt'));
const checks: Array<readonly [string, 'pass' | 'fail']> = [];

let observedVersion: string | undefined;
let supportedVersion: string | undefined;
let sessionResult = 'not-run';

function check(name: string, passed: boolean): void {
	checks.push([name, passed ? 'pass' : 'fail']);
}

function isRecord(value: unknown): value is RecordValue {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function executableCandidate(command: string): { readonly command: string; readonly exists: boolean; readonly executable: boolean } {
	const exists = existsSync(command);
	let executable = false;
	if (exists) {
		try {
			executable = statSync(command).isFile();
			if (executable) {
				accessSync(command, fsConstants.X_OK);
			}
		} catch {
			executable = false;
		}
	}
	return { command, exists, executable };
}

function writeReport(finalStatus: 'pass' | 'fail'): void {
	const report = [
		...checks.map(([name, status]) => `check.${name}=${status}`),
		`opencode.supported-version=${supportedVersion ?? 'unavailable'}`,
		`opencode.version=${observedVersion ?? 'unavailable'}`,
		`session=${sessionResult}`,
		`smoke=${finalStatus}`,
	].join('\n') + '\n';
	try {
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, report, { mode: 0o600 });
	} catch {
		// Stdout remains the workflow-visible report when its requested path is unavailable.
	}
	process.stdout.write(report);
}

function connectTcp(port: number, timeoutMs: number): Promise<void> {
	return new Promise((resolveConnection, reject) => {
		const socket = createConnection({ host: '127.0.0.1', port });
		let settled = false;
		const finish = (error?: Error): void => {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			error ? reject(error) : resolveConnection();
		};
		socket.once('connect', () => finish());
		socket.once('error', error => finish(error));
		socket.setTimeout(timeoutMs, () => finish(new Error('connection timeout')));
	});
}

async function waitForLoopbackPort(port: number, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await connectTcp(port, 1_000);
			return;
		} catch {
			await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
		}
	}
	throw new Error('loopback service did not accept a connection before the timeout');
}

async function assertLoopbackPortClosed(port: number): Promise<void> {
	try {
		await connectTcp(port, 1_000);
		throw new Error('loopback service port remained open');
	} catch (error) {
		if (error instanceof Error && error.message === 'loopback service port remained open') {
			throw error;
		}
		const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
		if (code !== 'ECONNREFUSED') {
			throw new Error('loopback service port could not be confirmed closed');
		}
	}
}

function createIsolatedState(): string {
	const cacheDirectory = join(homedir(), '.cache');
	mkdirSync(cacheDirectory, { recursive: true });
	const stateRoot = mkdtempSync(join(cacheDirectory, 'unigma-opencode-service-'));
	const isolatedHome = join(stateRoot, 'home');
	mkdirSync(isolatedHome);
	for (const directory of ['.config', '.local/share', '.cache', '.state']) {
		mkdirSync(join(isolatedHome, directory), { recursive: true });
	}
	// ProcessManager intentionally has no environment override; its child inherits these isolated paths.
	process.env.HOME = isolatedHome;
	process.env.XDG_CONFIG_HOME = join(isolatedHome, '.config');
	process.env.XDG_DATA_HOME = join(isolatedHome, '.local', 'share');
	process.env.XDG_CACHE_HOME = join(isolatedHome, '.cache');
	process.env.XDG_STATE_HOME = join(isolatedHome, '.state');
	return stateRoot;
}

function loadPackageModules(appDirectory: string): {
	readonly resolver: ResolverModule;
	readonly processManager: ProcessManagerModule;
	readonly client: OpenCodeClientModule;
} {
	const extensionOutput = join(appDirectory, 'extensions', 'unigma-agent-runtime', 'out', 'infrastructure');
	const require = createRequire(import.meta.url);
	return {
		resolver: require(join(extensionOutput, 'openCodeResolver.js')) as ResolverModule,
		processManager: require(join(extensionOutput, 'processManager.js')) as ProcessManagerModule,
		client: require(join(extensionOutput, 'openCodeHttpClient.js')) as OpenCodeClientModule,
	};
}

async function main(): Promise<void> {
	let stateRoot: string | undefined;
	let manager: ProcessManager | undefined;
	let client: OpenCodeClient | undefined;
	let handle: OwnedProcessHandle | undefined;
	let port: number | undefined;
	try {
		if (!packageDirectory) {
			check('arguments', false);
			return;
		}

		const appDirectory = basename(packageDirectory) === 'app' ? packageDirectory : join(packageDirectory, 'resources', 'app');
		check('package', existsSync(join(appDirectory, 'product.json')) && existsSync(join(appDirectory, 'package.json')));
		if (!existsSync(join(appDirectory, 'product.json')) || !existsSync(join(appDirectory, 'package.json'))) {
			return;
		}

		let modules: ReturnType<typeof loadPackageModules>;
		try {
			modules = loadPackageModules(appDirectory);
		} catch {
			check('runtime-modules', false);
			return;
		}
		supportedVersion = modules.client.SUPPORTED_OPENCODE_VERSION;
		const runtimeModulesLoaded = typeof modules.client.OpenCodeHttpClient === 'function'
			&& typeof modules.processManager.ChildProcessManager === 'function'
			&& typeof modules.resolver.resolveOpenCodeCommand === 'function';
		check('runtime-modules', runtimeModulesLoaded);
		if (!runtimeModulesLoaded) {
			return;
		}

		const embeddedDirectory = join(appDirectory, 'opencode');
		const embeddedCommand = join(embeddedDirectory, 'bin', 'opencode');
		const embeddedFile = executableCandidate(embeddedCommand);
		const embedded = existsSync(embeddedDirectory) && !embeddedFile.exists
			? { ...embeddedFile, exists: true }
			: embeddedFile;
		const resolution = modules.resolver.resolveOpenCodeCommand({ embedded });
		check('resolution-embedded', resolution.kind === 'embedded' && resolution.command === embeddedCommand);
		if (resolution.kind !== 'embedded' || resolution.command !== embeddedCommand) {
			return;
		}

		stateRoot = createIsolatedState();
		const workspaceDirectory = join(stateRoot, 'workspace');
		mkdirSync(workspaceDirectory);
		const workspaceUri = pathToFileURL(workspaceDirectory).toString();
		manager = new modules.processManager.ChildProcessManager({ applicationDirectory: appDirectory, startupTimeoutMs: STARTUP_TIMEOUT_MS });
		client = new modules.client.OpenCodeHttpClient({ requestTimeoutMs: REQUEST_TIMEOUT_MS, startupTimeoutMs: STARTUP_TIMEOUT_MS, healthCheckIntervalMs: 0 });
		try {
			handle = await manager.ensureStarted({ uri: workspaceUri });
		} catch {
			check('process-started', false);
			return;
		}
		check('process-started', handle.owner === 'unigma-agent-runtime' && handle.pid > 0);
		const endpoint = new URL(handle.endpoint);
		port = endpoint.port ? Number(endpoint.port) : undefined;
		check('loopback-endpoint', endpoint.protocol === 'http:' && endpoint.hostname === '127.0.0.1' && port !== undefined && port > 0);
		if (port === undefined || !Number.isInteger(port) || port <= 0) {
			return;
		}

		try {
			await waitForLoopbackPort(port, STARTUP_TIMEOUT_MS);
		} catch {
			check('service-accepts-loopback', false);
			return;
		}
		check('service-accepts-loopback', true);
		try {
			await client.connect(handle);
		} catch {
			check('client-connected', false);
			return;
		}
		check('client-connected', true);

		let health: unknown;
		try {
			health = await client.send({ method: 'GET', path: '/global/health' });
		} catch {
			check('health-response', false);
			return;
		}
		observedVersion = isRecord(health) && typeof health.version === 'string' ? health.version : undefined;
		check('health-response', isRecord(health) && health.healthy === true && observedVersion !== undefined);
		check('health-version', supportedVersion !== undefined && observedVersion === supportedVersion);

		let sessions: unknown;
		try {
			sessions = await client.send({ method: 'GET', path: '/session' });
		} catch {
			sessionResult = 'unavailable';
			check('session-list', false);
			return;
		}
		if (Array.isArray(sessions)) {
			sessionResult = 'listed';
			check('session-list', true);
		} else {
			sessionResult = 'unavailable';
			check('session-list', false);
		}
	} finally {
		if (client) {
			try {
				await client.disconnect();
			} catch {
				check('client-disconnect', false);
			}
		}
		if (manager) {
			try {
				await manager.stopOwned();
				check('process-stopped', true);
			} catch {
				check('process-stopped', false);
			}
		}
		if (port !== undefined) {
			try {
				await assertLoopbackPortClosed(port);
				check('port-closed', true);
			} catch {
				check('port-closed', false);
			}
		}
		if (stateRoot) {
			rmSync(stateRoot, { recursive: true, force: true });
			check('state-cleanup', !existsSync(stateRoot));
		}
	}
}

try {
	await main();
	const passed = checks.length > 0 && checks.every(([, status]) => status === 'pass');
	writeReport(passed ? 'pass' : 'fail');
	if (!passed) {
		process.exitCode = 1;
	}
} catch {
	check('unexpected-error', false);
	writeReport('fail');
	process.exitCode = 1;
}
