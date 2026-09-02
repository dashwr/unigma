/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import {
	buildRemoteBootstrapScript,
	parseRemoteHandshake,
	type RemoteBootstrapScriptInput,
	type RemoteHandshake
} from './remoteServerHandshake.js';

export interface SshTransportArgumentInput {
	readonly destination: string;
	readonly localPort: number;
	readonly remoteSocketPath: string;
	/**
	 * Smoke-only trust file. This exists precisely to avoid violating SSH-CONTRACT.md
	 * section 4.2: an ephemeral host key goes in a disposable file instead of the
	 * user's known_hosts. Production passes `undefined`.
	 */
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
	dispose(): Promise<void>;
}

export type RemoteServerFailureCode =
	| 'invalid-input'
	| 'ssh.client-unavailable'
	| 'ssh.host-key-untrusted'
	| 'ssh.authentication-unavailable'
	| 'ssh.transport-failed'
	| 'ssh.connection-lost'
	| 'ssh.remote-server-unavailable';

export type RemoteServerFailurePhase = 'bootstrap' | 'connect' | 'handshake' | 'lifecycle';

export interface RemoteServerFailure {
	readonly ok: false;
	readonly code: RemoteServerFailureCode;
	readonly phase: RemoteServerFailurePhase;
	readonly exitCode?: number;
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
	readonly setTimeout?: typeof globalThis.setTimeout;
	readonly clearTimeout?: typeof globalThis.clearTimeout;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const PORT = /^[1-9][0-9]{0,4}$/;

/** Builds an SSH command without identity, user or configuration overrides. */
export function buildSshTransportArguments(input: SshTransportArgumentInput): readonly string[] {
	if (!input || typeof input.destination !== 'string' || input.destination.length === 0
		|| !Number.isInteger(input.localPort) || input.localPort < 1 || input.localPort > 65535
		|| typeof input.remoteSocketPath !== 'string' || input.remoteSocketPath.length === 0
		|| !input.remoteSocketPath.startsWith('/')
		|| (input.knownHostsFile !== undefined && (typeof input.knownHostsFile !== 'string' || input.knownHostsFile.length === 0))) {
		throw new TypeError('Invalid SSH transport input');
	}

	const knownHostsArguments = input.knownHostsFile === undefined ? [] : [
		'-o', `UserKnownHostsFile=${input.knownHostsFile}`,
		'-o', 'GlobalKnownHostsFile=/dev/null'
	];
	return [
		'-o', 'BatchMode=yes',
		'-o', 'ExitOnForwardFailure=yes',
		// SSH-CONTRACT.md section 4.2 requires existing configured trust and rejects unknown keys;
		// `yes` verifies without the known_hosts mutation performed by `accept-new`.
		'-o', 'StrictHostKeyChecking=yes',
		...knownHostsArguments,
		'-L', `127.0.0.1:${input.localPort}:${input.remoteSocketPath}`,
		input.destination,
		'--', '/bin/sh', '-s'
	] as const;
}

function failure(code: RemoteServerFailureCode, phase: RemoteServerFailurePhase, exitCode?: number): RemoteServerFailure {
	const result: RemoteServerFailure = { ok: false, code, phase };
	if (exitCode !== undefined) {
		return { ...result, exitCode };
	}
	return result;
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

/** Opens one SSH session, hands bootstrap over stdin, and returns its loopback tunnel. */
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

	let child: RemoteSshProcess;
	try {
		child = deps.spawn(buildSshTransportArguments({
			destination: input.destination,
			localPort,
			remoteSocketPath: scriptResult.paths.socketPath,
			knownHostsFile: input.knownHostsFile
		}));
	} catch {
		notify(deps, { category: 'ssh.client-unavailable', phase: 'connect' });
		return failure('ssh.client-unavailable', 'connect');
	}

	let stdoutReader: Interface | undefined;
	let stderrReader: Interface | undefined;
	let stderrFailureCategory: RemoteServerDiagnosticCategory | undefined;
	let disposed = false;
	let settled = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const setTimer = deps.setTimeout ?? globalThis.setTimeout;
	const clearTimer = deps.clearTimeout ?? globalThis.clearTimeout;

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
		if (!child.kill('SIGTERM')) {
			child.kill('SIGKILL');
		}
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

		stdoutReader = createInterface({ input: child.stdout });
		stdoutReader.on('line', (line: string) => {
			const handshake: RemoteHandshake = parseRemoteHandshake(line);
			switch (handshake.kind) {
				case 'ready':
					complete({ endpoint: { host: '127.0.0.1', port: localPort }, dispose: disposeProcess });
					return;
				case 'server-unavailable':
				case 'socket-occupied':
				case 'start-failed':
					fail(failure('ssh.remote-server-unavailable', 'handshake'));
					return;
			}
		});
		stderrReader = createInterface({ input: child.stderr });
		stderrReader.on('line', (line: string) => {
			stderrFailureCategory = stderrCategory(line);
			notify(deps, { category: stderrFailureCategory, phase: 'connect' });
		});
		child.on('error', (error: unknown) => {
			const errorCode = (error as NodeJS.ErrnoException).code;
			const code = errorCode === 'ENOENT' || errorCode === 'EACCES' || errorCode === 'EPERM'
				? 'ssh.client-unavailable'
				: 'ssh.transport-failed';
			notify(deps, { category: code, phase: 'connect' });
			fail(failure(code, 'connect'));
		});
		child.on('close', (code: number | null) => {
			if (disposed) {
				return;
			}
			if (settled) {
				notify(deps, { category: 'ssh.connection-lost', phase: 'lifecycle', exitCode: code ?? undefined });
				return;
			}
			if (stderrFailureCategory !== undefined) {
				notify(deps, { category: stderrFailureCategory, phase: 'connect', exitCode: code ?? undefined });
				fail(failure(stderrFailureCategory, 'connect', code ?? undefined));
				return;
			}
			notify(deps, { category: 'ssh.remote-server-unavailable', phase: 'handshake', exitCode: code ?? undefined });
			fail(failure('ssh.remote-server-unavailable', 'handshake', code ?? undefined));
		});

		try {
			child.stdin.end(scriptResult.script);
		} catch {
			notify(deps, { category: 'ssh.transport-failed', phase: 'connect' });
			fail(failure('ssh.transport-failed', 'connect'));
			return;
		}

		timer = setTimer(() => {
			notify(deps, { category: 'ssh.transport-failed', phase: 'handshake' });
			fail(failure('ssh.transport-failed', 'handshake'));
		}, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	});
}

/** Factory for production; tests inject a runner and never reach this function. */
export function createRemoteSshProcessRunner(): RemoteSshProcessRunner {
	return (arguments_: readonly string[]): ChildProcessWithoutNullStreams => spawn('ssh', [...arguments_], {
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true
	});
}
