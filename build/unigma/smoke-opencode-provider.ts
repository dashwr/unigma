/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Proves the authorised provider of `D-043` against the packaged product.
 *
 * What this exists to answer is narrow and worth stating, because the adjacent
 * smoke already answers a different question. `smoke-opencode-service` proves a
 * service: the process starts, the loopback endpoint answers `/global/health`
 * and `/session` lists. None of that touches a provider, a credential or a
 * model. This one proves that a prompt sent with the exact authorised model id
 * comes back answered.
 *
 * The distinction that makes this necessary: a local probe of the pinned binary
 * with a **deliberately invalid key** returned `connected: ["opencode",
 * "openrouter"]` and `source: "env"` for the provider. `connected` therefore
 * means "a credential is present in the environment", not "a credential works".
 * Reading `/provider` alone would be a green check that proves nothing about
 * the credential, so the report separates the two and only the completed
 * prompt is treated as proof.
 *
 * Credential handling: the key is read from the environment and never written,
 * never logged and never sent anywhere but the OpenCode process that already
 * inherits it. `ProcessManager` has no environment override, so the child
 * inherits this process's environment — which is also why the isolated state
 * has to be established before the process starts. The product does not call
 * `PUT /auth/{id}` and does not manage credentials; that stays true here.
 */

import { accessSync, constants as fsConstants, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The authorised provider and model of `D-043`.
 *
 * Exact `providerID/modelID`, with no alias and no fallback: the compatibility
 * policy refuses discovery-with-fallback precisely so that a model going away
 * is a loud failure rather than a silent substitution. If this id stops
 * appearing in `/provider`, the right answer is a new decision, not a second
 * candidate in this file.
 *
 * Chosen from the free tier of the provider the responsible party authorised,
 * against criteria that are checkable rather than reputational: it is free, it
 * is tool-capable — the agent profile needs that — and it was present in the
 * pinned binary's own `/provider` response when this was written.
 */
const AUTHORIZED_PROVIDER = 'openrouter';
const AUTHORIZED_MODEL = 'nvidia/nemotron-3.5-lightning:free';

/** The environment variable the provider itself declares, read from `/provider`. */
const CREDENTIAL_VARIABLE = 'OPENROUTER_API_KEY';

const STARTUP_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 60_000;
/**
 * A free model is rate-limited and queued by definition. This budget is the
 * point at which the run stops waiting and says so as its own category, rather
 * than failing as if the product were broken.
 */
const ANSWER_TIMEOUT_MS = 180_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageDirectory = process.argv[2] ? resolve(process.argv[2]) : undefined;
const reportPath = resolve(process.argv[3] ?? join(repoRoot, '.build', 'logs', 'unigma-opencode-provider-smoke.txt'));
const checks: Array<readonly [string, string]> = [];

let observedVersion: string | undefined;
let supportedVersion: string | undefined;
/**
 * Fixed categories, never `Error.message`: a provider error can carry the
 * prompt, the endpoint or the key, and evidence is published.
 */
let answerOutcome: 'not-run' | 'answered' | 'refused-by-provider' | 'timed-out' | 'transport-failed' = 'not-run';

interface RecordValue { readonly [key: string]: unknown }

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

interface OpenCodeEvent { readonly type: string; readonly properties?: unknown }

interface OpenCodeClient {
	connect(process: OwnedProcessHandle): Promise<void>;
	disconnect(): Promise<void>;
	send(request: { readonly method: 'GET' | 'POST'; readonly path: string; readonly body?: unknown }): Promise<unknown>;
	onEvent(listener: (event: OpenCodeEvent) => void): { dispose(): void };
}

interface ResolverModule {
	resolveOpenCodeCommand(candidates: {
		readonly embedded?: { readonly command: string; readonly exists: boolean; readonly executable: boolean };
	}): { readonly kind: string; readonly command?: string };
}

interface ProcessManagerModule {
	ChildProcessManager: new (options: { readonly applicationDirectory: string; readonly startupTimeoutMs: number }) => ProcessManager;
}

interface OpenCodeClientModule {
	OpenCodeHttpClient: new (options: { readonly requestTimeoutMs: number; readonly startupTimeoutMs: number; readonly healthCheckIntervalMs: number }) => OpenCodeClient;
	SUPPORTED_OPENCODE_VERSION: string;
}

function check(name: string, passed: boolean): void {
	checks.push([name, passed ? 'pass' : 'fail']);
}

function note(name: string, value: string): void {
	checks.push([name, value]);
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
		`provider=${AUTHORIZED_PROVIDER}`,
		`model=${AUTHORIZED_MODEL}`,
		`answer=${answerOutcome}`,
		// Stated in the evidence itself so a later reader cannot mistake the
		// provider listing for proof of a working credential.
		'note.connected-is-not-validity=/provider reports connected and source=env whenever the variable is set, including with an invalid key; only check.prompt-answered proves the credential',
		`smoke=${finalStatus}`,
	].join('\n') + '\n';
	try {
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, report, { mode: 0o600 });
	} catch {
		// Stdout remains the workflow-visible report when its path is unavailable.
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
	const stateRoot = mkdtempSync(join(cacheDirectory, 'unigma-opencode-provider-'));
	const isolatedHome = join(stateRoot, 'home');
	mkdirSync(isolatedHome);
	for (const directory of ['.config', '.local/share', '.cache', '.state']) {
		mkdirSync(join(isolatedHome, directory), { recursive: true });
	}
	// `--pure` does not isolate user configuration — a probe of the pinned
	// binary returned twelve agents from the caller's own config under it — so
	// isolation is done here, by the environment the child inherits.
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

/**
 * Reads `/provider` and reports the three separate facts it carries. They are
 * separate because they fail for different reasons and one of them is not
 * evidence of the credential at all.
 */
export function inspectProvider(provider: unknown): {
	readonly connected: boolean;
	readonly sourceIsEnvironment: boolean;
	readonly modelPresent: boolean;
} {
	if (!isRecord(provider)) {
		return { connected: false, sourceIsEnvironment: false, modelPresent: false };
	}
	const connected = Array.isArray(provider.connected) && provider.connected.includes(AUTHORIZED_PROVIDER);
	const all = Array.isArray(provider.all) ? provider.all : [];
	const entry = all.find(candidate => isRecord(candidate) && candidate.id === AUTHORIZED_PROVIDER);
	if (!isRecord(entry)) {
		return { connected, sourceIsEnvironment: false, modelPresent: false };
	}
	// `source: "env"` is what says the credential came from the environment
	// rather than from a file the product wrote. The product does not manage
	// credentials, and this is the check that keeps that true in the runner.
	const sourceIsEnvironment = entry.source === 'env';
	const modelPresent = isRecord(entry.models) && Object.hasOwn(entry.models, AUTHORIZED_MODEL);
	return { connected, sourceIsEnvironment, modelPresent };
}

/**
 * Classifies the terminal event of a prompt.
 *
 * `session.error` is a refusal by the provider — an exhausted free quota is the
 * expected one — and it is a different fact from the product failing. Keeping
 * them apart is the difference between "the credential does not work" and
 * "unigma does not work", which a single red check would merge.
 */
export function classifyEvent(event: OpenCodeEvent, sessionId: string): 'answered' | 'refused-by-provider' | 'progress' | undefined {
	const properties = isRecord(event.properties) ? event.properties : undefined;
	const eventSession = properties && typeof properties.sessionID === 'string' ? properties.sessionID : undefined;
	if (eventSession !== undefined && eventSession !== sessionId) {
		return undefined;
	}
	if (event.type === 'session.error') {
		return 'refused-by-provider';
	}
	if (event.type === 'message.part.updated' || event.type === 'message.updated') {
		return 'progress';
	}
	// `session.idle` is terminal but is not by itself an answer: a session can
	// go idle having produced nothing. Treating it as success would let an
	// empty run report a working credential, which is the exact shape of green
	// check this smoke exists to avoid. The caller requires progress first.
	if (event.type === 'session.idle') {
		return 'answered';
	}
	return undefined;
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

		// Presence only. The value is never read into the report, compared, or
		// passed anywhere: the OpenCode child inherits it from the environment.
		const credential = process.env[CREDENTIAL_VARIABLE];
		check('credential-present', typeof credential === 'string' && credential.length > 0);
		if (!credential) {
			return;
		}

		const appDirectory = basename(packageDirectory) === 'app' ? packageDirectory : join(packageDirectory, 'resources', 'app');
		check('package', existsSync(join(appDirectory, 'product.json')) && existsSync(join(appDirectory, 'package.json')));
		if (!existsSync(join(appDirectory, 'product.json'))) {
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
		check('runtime-modules', typeof modules.client.OpenCodeHttpClient === 'function');

		const embeddedCommand = join(appDirectory, 'opencode', 'bin', 'opencode');
		const resolution = modules.resolver.resolveOpenCodeCommand({ embedded: executableCandidate(embeddedCommand) });
		check('resolution-embedded', resolution.kind === 'embedded' && resolution.command === embeddedCommand);
		if (resolution.kind !== 'embedded') {
			return;
		}

		stateRoot = createIsolatedState();
		const workspaceDirectory = join(stateRoot, 'workspace');
		mkdirSync(workspaceDirectory);
		manager = new modules.processManager.ChildProcessManager({ applicationDirectory: appDirectory, startupTimeoutMs: STARTUP_TIMEOUT_MS });
		client = new modules.client.OpenCodeHttpClient({ requestTimeoutMs: REQUEST_TIMEOUT_MS, startupTimeoutMs: STARTUP_TIMEOUT_MS, healthCheckIntervalMs: 0 });
		try {
			handle = await manager.ensureStarted({ uri: pathToFileURL(workspaceDirectory).toString() });
		} catch {
			check('process-started', false);
			return;
		}
		check('process-started', handle.pid > 0);
		const endpoint = new URL(handle.endpoint);
		port = endpoint.port ? Number(endpoint.port) : undefined;
		check('loopback-endpoint', endpoint.hostname === '127.0.0.1' && port !== undefined && port > 0);
		if (port === undefined) {
			return;
		}
		try {
			await waitForLoopbackPort(port, STARTUP_TIMEOUT_MS);
			await client.connect(handle);
		} catch {
			check('client-connected', false);
			return;
		}
		check('client-connected', true);

		const health = await client.send({ method: 'GET', path: '/global/health' }).catch(() => undefined);
		observedVersion = isRecord(health) && typeof health.version === 'string' ? health.version : undefined;
		check('health-version', supportedVersion !== undefined && observedVersion === supportedVersion);

		const provider = await client.send({ method: 'GET', path: '/provider' }).catch(() => undefined);
		const inspected = inspectProvider(provider);
		check('provider-connected', inspected.connected);
		check('provider-source-environment', inspected.sourceIsEnvironment);
		check('model-authorized-present', inspected.modelPresent);
		if (!inspected.modelPresent) {
			// A missing model is a decision to retake, not a fallback to apply.
			return;
		}

		let session: unknown;
		try {
			session = await client.send({ method: 'POST', path: '/session', body: {} });
		} catch {
			check('session-created', false);
			return;
		}
		const sessionId = isRecord(session) && typeof session.id === 'string' ? session.id : undefined;
		check('session-created', sessionId !== undefined);
		if (!sessionId) {
			return;
		}

		let sawProgress = false;
		const outcome = await new Promise<typeof answerOutcome>(resolveOutcome => {
			const timer = setTimeout(() => {
				subscription.dispose();
				resolveOutcome('timed-out');
			}, ANSWER_TIMEOUT_MS);
			const subscription = client!.onEvent(event => {
				const classified = classifyEvent(event, sessionId);
				if (classified === 'progress') {
					sawProgress = true;
					return;
				}
				if (classified === 'answered' && !sawProgress) {
					// Idle without a single message part is an empty session,
					// not an answer.
					clearTimeout(timer);
					subscription.dispose();
					resolveOutcome('refused-by-provider');
					return;
				}
				if (classified) {
					clearTimeout(timer);
					subscription.dispose();
					resolveOutcome(classified);
				}
			});
			client!.send({
				method: 'POST',
				path: `/session/${sessionId}/prompt_async`,
				// The exact providerID/modelID, split the way the API takes it.
				// The prompt is deliberately trivial and carries nothing about
				// the repository: this proves the credential, not the model.
				body: {
					model: { providerID: AUTHORIZED_PROVIDER, modelID: AUTHORIZED_MODEL },
					parts: [{ type: 'text', text: 'Reply with the single word: ok' }],
				},
			}).catch(() => {
				clearTimeout(timer);
				subscription.dispose();
				resolveOutcome('transport-failed');
			});
		});
		answerOutcome = outcome;
		check('prompt-answered', outcome === 'answered');
		// Published as its own line so an exhausted free quota reads as a
		// provider refusal rather than as a defect in the product.
		note('answer-outcome', outcome);
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

// Guarded so the pure classifiers above can be imported by a test without
// starting a product.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		await main();
		const passed = checks.length > 0 && checks.every(([name, status]) => status === 'pass' || name === 'answer-outcome');
		writeReport(passed ? 'pass' : 'fail');
		if (!passed) {
			process.exitCode = 1;
		}
	} catch {
		check('unexpected-error', false);
		writeReport('fail');
		process.exitCode = 1;
	}
}

export const AUTHORIZED = { provider: AUTHORIZED_PROVIDER, model: AUTHORIZED_MODEL, variable: CREDENTIAL_VARIABLE } as const;
