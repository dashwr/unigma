/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import {
	buildRemoteBootstrapScript,
	parseRemoteHandshake,
	type RemoteBootstrapScriptInput,
	type RemoteHandshake
} from './remoteServerHandshake.js';
import { isValidRemoteUnixSocketPath, REMOTE_UNIX_SOCKET_PATH_MAX_BYTES } from './remoteStagingPlan.js';

export interface SshTransportArgumentInput {
	readonly destination: string;
	readonly controlPath: string;
	/**
	 * Smoke-only trust file. This exists precisely to avoid violating SSH-CONTRACT.md
	 * section 4.2: an ephemeral host key goes in a disposable file instead of the
	 * user's known_hosts. Production passes `undefined`.
	 */
	readonly knownHostsFile?: string;
}

export interface SshForwardArgumentInput {
	readonly destination: string;
	readonly controlPath: string;
	readonly localPort: number;
	readonly remoteSocketPath: string;
	readonly knownHostsFile?: string;
}

export interface RemoteServerTransportInput extends RemoteBootstrapScriptInput {
	readonly destination: string;
	readonly timeoutMs?: number;
	readonly knownHostsFile?: string;
}

export interface RemoteServerEndpoint {
	readonly host: '127.0.0.1';
	readonly port: number;
}

export interface RemoteServerSession {
	readonly endpoint: RemoteServerEndpoint;
	/** Private local socket used by explicit staging actions on this connection. */
	readonly controlPath: string;
	dispose(): Promise<void>;
}

/** An owned ControlMaster kept alive only so an explicit staging command can use it. */
export interface RemoteServerStagingSession {
	readonly controlPath: string;
	dispose(): Promise<void>;
}

export type RemoteServerFailureCode =
	| 'invalid-input'
	| 'ssh.client-unavailable'
	| 'ssh.host-key-untrusted'
	| 'ssh.authentication-unavailable'
	| 'ssh.transport-failed'
	| 'ssh.connection-lost'
	| 'ssh.remote-server-unavailable'
	| 'ssh.remote-home-invalid'
	| 'ssh.remote-socket-path-too-long'
	| 'ssh.forward-failed';

export type RemoteServerFailurePhase = 'bootstrap' | 'connect' | 'handshake' | 'forward' | 'lifecycle';

export interface RemoteServerFailure {
	readonly ok: false;
	readonly code: RemoteServerFailureCode;
	readonly phase: RemoteServerFailurePhase;
	readonly exitCode?: number;
	readonly stagingSession?: RemoteServerStagingSession;
}

export type RemoteServerResult = RemoteServerSession | RemoteServerFailure;

export interface RemoteSshProcess {
	readonly stdin: NodeJS.WritableStream;
	readonly stdout: NodeJS.ReadableStream;
	readonly stderr: NodeJS.ReadableStream;
	on(event: 'error', listener: (error: unknown) => void): this;
	on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	kill(signal?: NodeJS.Signals): boolean;
}

export type RemoteSshProcessRunner = (arguments_: readonly string[]) => RemoteSshProcess;
export type LocalPortAllocator = () => number | Promise<number>;

export type RemoteServerDiagnosticCategory =
	| 'ssh.client-unavailable'
	| 'ssh.host-key-untrusted'
	| 'ssh.authentication-unavailable'
	| 'ssh.transport-failed'
	| 'ssh.connection-lost'
	| 'ssh.remote-server-unavailable';

export interface RemoteServerDiagnostic {
	readonly category: RemoteServerDiagnosticCategory;
	readonly phase: RemoteServerFailurePhase;
	readonly exitCode?: number;
}

export interface RemoteServerTransportDependencies {
	readonly allocateLocalPort: LocalPortAllocator;
	readonly spawn: RemoteSshProcessRunner;
	readonly diagnose?: (diagnostic: RemoteServerDiagnostic) => void;
	readonly onConnectionLost?: () => void;
	readonly setTimeout?: typeof globalThis.setTimeout;
	readonly clearTimeout?: typeof globalThis.clearTimeout;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const PORT = /^[1-9][0-9]{0,4}$/;

function knownHostsArguments(knownHostsFile: string | undefined): readonly string[] {
	return knownHostsFile === undefined ? [] : [
		'-o', `UserKnownHostsFile=${knownHostsFile}`,
		'-o', 'GlobalKnownHostsFile=/dev/null'
	];
}

function validateCommonInput(destination: unknown, controlPath: unknown, knownHostsFile: unknown): void {
	if (typeof destination !== 'string' || destination.length === 0
		|| !isValidRemoteUnixSocketPath(controlPath)
		|| (knownHostsFile !== undefined && (typeof knownHostsFile !== 'string' || knownHostsFile.length === 0))) {
		throw new TypeError('Invalid SSH transport input');
	}
}

/** Builds the one SSH command that owns the remote server and ControlMaster. */
export function buildSshTransportArguments(input: SshTransportArgumentInput): readonly string[] {
	validateCommonInput(input?.destination, input?.controlPath, input?.knownHostsFile);
	return [
		'-M',
		'-o', `ControlPath=${input.controlPath}`,
		'-o', 'ControlPersist=no',
		'-o', 'BatchMode=yes',
		// SSH-CONTRACT.md section 4.2 requires existing configured trust and rejects unknown keys.
		'-o', 'StrictHostKeyChecking=yes',
		...knownHostsArguments(input.knownHostsFile),
		input.destination,
		'--', '/bin/sh', '-s'
	] as const;
}

/** Builds the pure control operation that adds the UNIX-socket forward. */
export function buildSshForwardArguments(input: SshForwardArgumentInput): readonly string[] {
	validateCommonInput(input?.destination, input?.controlPath, input?.knownHostsFile);
	if (!Number.isInteger(input.localPort) || input.localPort < 1 || input.localPort > 65535
		|| !isValidRemoteUnixSocketPath(input.remoteSocketPath)) {
		throw new TypeError('Invalid SSH forward input');
	}
	return [
		'-o', `ControlPath=${input.controlPath}`,
		'-o', 'BatchMode=yes',
		'-o', 'StrictHostKeyChecking=yes',
		...knownHostsArguments(input.knownHostsFile),
		'-O', 'forward',
		'-L', `127.0.0.1:${input.localPort}:${input.remoteSocketPath}`,
		input.destination
	] as const;
}

function failure(code: RemoteServerFailureCode, phase: RemoteServerFailurePhase, exitCode?: number): RemoteServerFailure {
	const result: RemoteServerFailure = { ok: false, code, phase };
	return exitCode === undefined ? result : { ...result, exitCode };
}

function stderrCategory(line: string): RemoteServerDiagnosticCategory {
	if (/host key|known_hosts|remote host identification/i.test(line)) {
		return 'ssh.host-key-untrusted';
	}
	if (/permission denied|authentication|passphrase|password|sign_and_send_pubkey/i.test(line)) {
		return 'ssh.authentication-unavailable';
	}
	return 'ssh.transport-failed';
}

function notify(deps: RemoteServerTransportDependencies, diagnostic: RemoteServerDiagnostic): void {
	deps.diagnose?.(diagnostic);
}

function closeReader(reader: Interface | undefined): void {
	reader?.close();
}

function createControlPath(): { readonly directory: string; readonly path: string } {
	const directory = mkdtempSync(join(tmpdir(), 'ug-'));
	chmodSync(directory, 0o700);
	const path = join(directory, 'c');
	if (!isValidRemoteUnixSocketPath(path) || Buffer.byteLength(path, 'utf8') > REMOTE_UNIX_SOCKET_PATH_MAX_BYTES) {
		rmSync(directory, { recursive: true, force: true });
		throw new RangeError('ControlPath exceeds UNIX socket address limit');
	}
	return { directory, path };
}

/** Opens one ControlMaster, reads its host-derived handshake, then adds its tunnel. */
export async function openRemoteServer(input: RemoteServerTransportInput, deps: RemoteServerTransportDependencies): Promise<RemoteServerResult> {
	const scriptResult = buildRemoteBootstrapScript(input);
	if (!scriptResult.valid) {
		return failure('invalid-input', 'bootstrap');
	}
	if (input.timeoutMs !== undefined && (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0)) {
		return failure('invalid-input', 'handshake');
	}

	let localPort: number;
	try {
		localPort = await deps.allocateLocalPort();
	} catch {
		notify(deps, { category: 'ssh.transport-failed', phase: 'connect' });
		return failure('ssh.transport-failed', 'connect');
	}
	if (!Number.isInteger(localPort) || !PORT.test(String(localPort)) || localPort > 65535) {
		notify(deps, { category: 'ssh.transport-failed', phase: 'connect' });
		return failure('ssh.transport-failed', 'connect');
	}

	let control: { readonly directory: string; readonly path: string };
	try {
		control = createControlPath();
	} catch {
		notify(deps, { category: 'ssh.transport-failed', phase: 'connect' });
		return failure('ssh.transport-failed', 'connect');
	}

	let child: RemoteSshProcess;
	try {
		child = deps.spawn(buildSshTransportArguments({
			destination: input.destination,
			controlPath: control.path,
			knownHostsFile: input.knownHostsFile
		}));
	} catch {
		rmSync(control.directory, { recursive: true, force: true });
		notify(deps, { category: 'ssh.client-unavailable', phase: 'connect' });
		return failure('ssh.client-unavailable', 'connect');
	}

	let stdoutReader: Interface | undefined;
	let stderrReader: Interface | undefined;
	let stderrFailureCategory: RemoteServerDiagnosticCategory | undefined;
	let forwardChild: RemoteSshProcess | undefined;
	let disposed = false;
	let settled = false;
	let retainedForStaging = false;
	let connectionLossNotified = false;
	let stage: 'connect' | 'handshake' | 'forward' = 'connect';
	let timer: ReturnType<typeof setTimeout> | undefined;
	const setTimer = deps.setTimeout ?? globalThis.setTimeout;
	const clearTimer = deps.clearTimeout ?? globalThis.clearTimeout;
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const removeControlPath = (): void => {
		try {
			rmSync(control.directory, { recursive: true, force: true });
		} catch {
			// Process teardown remains best effort; the directory is private and disposable.
		}
	};
	const disposeProcess = async (): Promise<void> => {
		if (disposed) {
			return;
		}
		disposed = true;
		closeReader(stdoutReader);
		closeReader(stderrReader);
		if (timer !== undefined) {
			clearTimer(timer);
			timer = undefined;
		}
		if (forwardChild && !forwardChild.kill('SIGTERM')) {
			forwardChild.kill('SIGKILL');
		}
		if (!child.kill('SIGTERM')) {
			child.kill('SIGKILL');
		}
		// SIGTERM owns the master lifecycle; remove its private socket immediately.
		removeControlPath();
	};
	const reportConnectionLost = (exitCode?: number): void => {
		if (connectionLossNotified) {
			return;
		}
		connectionLossNotified = true;
		notify(deps, { category: 'ssh.connection-lost', phase: 'lifecycle', exitCode });
		void disposeProcess().finally(() => deps.onConnectionLost?.());
	};

	return await new Promise<RemoteServerResult>(resolve => {
		const complete = (result: RemoteServerResult): void => {
			if (settled) {
				return;
			}
			settled = true;
			if (timer !== undefined) {
				clearTimer(timer);
				timer = undefined;
			}
			resolve(result);
		};
		const fail = (result: RemoteServerFailure): void => {
			void disposeProcess().finally(() => complete(result));
		};
		const armTimer = (phase: RemoteServerFailurePhase): void => {
			if (timer !== undefined) {
				clearTimer(timer);
			}
			timer = setTimer(() => {
				notify(deps, { category: 'ssh.transport-failed', phase });
				fail(failure('ssh.transport-failed', phase));
			}, timeoutMs);
		};
		const addForward = (socketPath: string): void => {
			stage = 'forward';
			armTimer('forward');
			try {
				forwardChild = deps.spawn(buildSshForwardArguments({
					destination: input.destination,
					controlPath: control.path,
					localPort,
					remoteSocketPath: socketPath,
					knownHostsFile: input.knownHostsFile
				}));
			} catch {
				fail(failure('ssh.forward-failed', 'forward'));
				return;
			}
			forwardChild.on('error', () => fail(failure('ssh.forward-failed', 'forward')));
			forwardChild.on('close', (code: number | null) => {
				forwardChild = undefined;
				if (disposed) {
					return;
				}
				if (settled) {
					reportConnectionLost(code ?? undefined);
					return;
				}
				if (code !== 0) {
					fail(failure('ssh.forward-failed', 'forward', code ?? undefined));
					return;
				}
				complete({ endpoint: { host: '127.0.0.1', port: localPort }, controlPath: control.path, dispose: disposeProcess });
			});
			try {
				forwardChild.stdin.end();
			} catch {
				fail(failure('ssh.forward-failed', 'forward'));
			}
		};

		stdoutReader = createInterface({ input: child.stdout });
		stdoutReader.on('line', (line: string) => {
			if (stage === 'connect') {
				stage = 'handshake';
				armTimer('handshake');
			}
			const handshake: RemoteHandshake = parseRemoteHandshake(line);
			switch (handshake.kind) {
				case 'ready':
					addForward(handshake.socketPath);
					return;
				case 'server-unavailable':
				case 'socket-occupied':
				case 'home-invalid':
				case 'socket-path-too-long':
				case 'start-failed':
					if (handshake.kind === 'server-unavailable' && input.retainControlMasterOnServerUnavailable) {
						retainedForStaging = true;
						complete({ ...failure('ssh.remote-server-unavailable', 'handshake'), stagingSession: { controlPath: control.path, dispose: disposeProcess } });
						return;
					}
					fail(failure(handshake.kind === 'home-invalid' ? 'ssh.remote-home-invalid' : handshake.kind === 'socket-path-too-long' ? 'ssh.remote-socket-path-too-long' : 'ssh.remote-server-unavailable', 'handshake'));
					return;
			}
		});
		stderrReader = createInterface({ input: child.stderr });
		stderrReader.on('line', (line: string) => {
			stderrFailureCategory = stderrCategory(line);
			notify(deps, { category: stderrFailureCategory, phase: stage === 'forward' ? 'forward' : 'connect' });
		});
		child.on('error', (error: unknown) => {
			const errorCode = (error as NodeJS.ErrnoException).code;
			const code = errorCode === 'ENOENT' || errorCode === 'EACCES' || errorCode === 'EPERM'
				? 'ssh.client-unavailable'
				: 'ssh.transport-failed';
			notify(deps, { category: code, phase: stage });
			fail(failure(code, stage));
		});
		child.on('close', (code: number | null) => {
			if (disposed) {
				return;
			}
			if (settled) {
				if (!retainedForStaging) {
					reportConnectionLost(code ?? undefined);
				}
				return;
			}
			if (stage === 'forward') {
				fail(failure('ssh.forward-failed', 'forward', code ?? undefined));
				return;
			}
			if (stderrFailureCategory !== undefined) {
				notify(deps, { category: stderrFailureCategory, phase: stage, exitCode: code ?? undefined });
				fail(failure(stderrFailureCategory, stage, code ?? undefined));
				return;
			}
			notify(deps, { category: 'ssh.remote-server-unavailable', phase: stage, exitCode: code ?? undefined });
			fail(failure('ssh.remote-server-unavailable', stage, code ?? undefined));
		});

		try {
			child.stdin.end(scriptResult.script);
		} catch {
			notify(deps, { category: 'ssh.transport-failed', phase: 'connect' });
			fail(failure('ssh.transport-failed', 'connect'));
			return;
		}
		armTimer('connect');
	});
}

/** Factory for production; tests inject a runner and never reach this function. */
export function createRemoteSshProcessRunner(): RemoteSshProcessRunner {
	return (arguments_: readonly string[]): ChildProcessWithoutNullStreams => spawn('ssh', [...arguments_], {
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true
	});
}
