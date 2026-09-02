/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'node:child_process';
import {
	buildRemoteStagingScript,
	parseRemoteStagingHandshake,
	type RemoteStagingHandshake,
	type RemoteStagingScriptInput
} from './remoteStagingScript.js';
import { isValidRemoteUnixSocketPath } from './remoteStagingPlan.js';

export interface RemoteStagingTransferInput extends RemoteStagingScriptInput {
	readonly destination: string;
	readonly controlPath: string;
	readonly payloadDirectory: string;
	readonly knownHostsFile?: string;
	readonly confirm: (summary: RemoteStagingConfirmationSummary) => boolean | Promise<boolean>;
	readonly scriptDeliveryTimeoutMs?: number;
	readonly payloadTransferTimeoutMs?: number;
	readonly remoteExecutionTimeoutMs?: number;
}

/** The only place where the manifest hash is intentionally exposed. */
export interface RemoteStagingConfirmationSummary {
	readonly host: string;
	readonly version: string;
	readonly totalSizeBytes: number;
	readonly manifestHash: string;
}

export type RemoteStagingFailureCode =
	| 'invalid-input'
	| 'ssh.client-unavailable'
	| 'ssh.host-key-untrusted'
	| 'ssh.authentication-unavailable'
	| 'ssh.transport-failed'
	| 'ssh.connection-lost'
	| 'ssh.provisioning-denied';

export type RemoteStagingFailurePhase = 'validation' | 'confirmation' | 'script-delivery' | 'payload-transfer' | 'remote-execution';

export interface RemoteStagingFailure {
	readonly ok: false;
	readonly code: RemoteStagingFailureCode;
	readonly phase: RemoteStagingFailurePhase;
	readonly exitCode?: number;
	readonly remoteStatus?: RemoteStagingHandshake['kind'];
}

export interface RemoteStagingSuccess {
	readonly ok: true;
	readonly status: 'activated' | 'already-activated';
	readonly version: string;
}

export type RemoteStagingResult = RemoteStagingSuccess | RemoteStagingFailure;

export interface RemotePayloadTarProcess {
	readonly stdout: NodeJS.ReadableStream;
	on(event: 'error', listener: (error: unknown) => void): this;
	on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	kill(signal?: NodeJS.Signals): boolean;
}

export type RemotePayloadTarRunner = (payloadDirectory: string) => RemotePayloadTarProcess;

export interface RemoteStagingDiagnostic {
	readonly category:
	| 'ssh.client-unavailable'
	| 'ssh.host-key-untrusted'
	| 'ssh.authentication-unavailable'
	| 'ssh.transport-failed'
	| 'ssh.connection-lost'
	| 'ssh.provisioning-denied';
	readonly phase: RemoteStagingFailurePhase;
	readonly exitCode?: number;
}

export interface RemoteStagingTransferDependencies {
	readonly spawn: RemoteStagingSshProcessRunner;
	readonly spawnPayloadTar: RemotePayloadTarRunner;
	readonly diagnose?: (diagnostic: RemoteStagingDiagnostic) => void;
	readonly setTimeout?: typeof globalThis.setTimeout;
	readonly clearTimeout?: typeof globalThis.clearTimeout;
}

export interface RemoteStagingSshProcess {
	readonly stdin: NodeJS.WritableStream;
	readonly stdout: NodeJS.ReadableStream;
	readonly stderr: NodeJS.ReadableStream;
	on(event: 'error', listener: (error: unknown) => void): this;
	on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	kill(signal?: NodeJS.Signals): boolean;
}

export type RemoteStagingSshProcessRunner = (arguments_: readonly string[]) => RemoteStagingSshProcess;

const DEFAULT_TIMEOUT_MS = 15_000;

function knownHostsArguments(knownHostsFile: string | undefined): readonly string[] {
	return knownHostsFile === undefined ? [] : [
		'-o', `UserKnownHostsFile=${knownHostsFile}`,
		'-o', 'GlobalKnownHostsFile=/dev/null'
	];
}

function validCommonInput(input: RemoteStagingTransferInput): boolean {
	return typeof input.destination === 'string' && input.destination.length > 0
		&& isValidRemoteUnixSocketPath(input.controlPath)
		&& typeof input.payloadDirectory === 'string' && input.payloadDirectory.length > 0
		&& (input.knownHostsFile === undefined || (typeof input.knownHostsFile === 'string' && input.knownHostsFile.length > 0));
}

function remoteScriptPath(commit: string): string {
	return `"$HOME/.unigma-staging-${commit}.sh"`;
}

function commonSshArguments(input: RemoteStagingTransferInput): readonly string[] {
	return [
		'-o', `ControlPath=${input.controlPath}`,
		'-o', 'BatchMode=yes',
		'-o', 'StrictHostKeyChecking=yes',
		...knownHostsArguments(input.knownHostsFile),
		input.destination,
		'--'
	] as const;
}

/** Builds the first SSH invocation; only the script path, never its body, is an argument. */
export function buildRemoteStagingScriptDeliveryArguments(input: Pick<RemoteStagingTransferInput, 'destination' | 'controlPath' | 'knownHostsFile' | 'commit'>): readonly string[] {
	if (typeof input.destination !== 'string' || input.destination.length === 0 || !isValidRemoteUnixSocketPath(input.controlPath)
		|| !/^[0-9a-f]{40}$/.test(input.commit)) {
		throw new TypeError('Invalid remote staging input');
	}
	return [
		...commonSshArguments(input as RemoteStagingTransferInput),
		'/bin/sh',
		'-c',
		'\'cat > "$0"\'',
		remoteScriptPath(input.commit)
	] as const;
}

/** Builds the second SSH invocation, which consumes the tar stream on stdin. */
export function buildRemoteStagingExecutionArguments(input: Pick<RemoteStagingTransferInput, 'destination' | 'controlPath' | 'knownHostsFile' | 'commit'>): readonly string[] {
	if (typeof input.destination !== 'string' || input.destination.length === 0 || !isValidRemoteUnixSocketPath(input.controlPath)
		|| !/^[0-9a-f]{40}$/.test(input.commit)) {
		throw new TypeError('Invalid remote staging input');
	}
	return [...commonSshArguments(input as RemoteStagingTransferInput), '/bin/sh', remoteScriptPath(input.commit)] as const;
}

function failure(code: RemoteStagingFailureCode, phase: RemoteStagingFailurePhase, exitCode?: number, remoteStatus?: RemoteStagingHandshake['kind']): RemoteStagingFailure {
	const result: RemoteStagingFailure = { ok: false, code, phase };
	if (exitCode !== undefined) {
		return remoteStatus === undefined ? { ...result, exitCode } : { ...result, exitCode, remoteStatus };
	}
	return remoteStatus === undefined ? result : { ...result, remoteStatus };
}

function stderrCategory(chunk: string): RemoteStagingDiagnostic['category'] {
	if (/host key|known_hosts|remote host identification/i.test(chunk)) {
		return 'ssh.host-key-untrusted';
	}
	if (/permission denied|authentication|passphrase|password|sign_and_send_pubkey/i.test(chunk)) {
		return 'ssh.authentication-unavailable';
	}
	return 'ssh.transport-failed';
}

function notify(deps: RemoteStagingTransferDependencies, diagnostic: RemoteStagingDiagnostic): void {
	deps.diagnose?.(diagnostic);
}

function processErrorCode(error: unknown): 'ssh.client-unavailable' | 'ssh.transport-failed' {
	const code = (error as NodeJS.ErrnoException).code;
	return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM' ? 'ssh.client-unavailable' : 'ssh.transport-failed';
}

function terminate(process_: RemoteStagingSshProcess | RemotePayloadTarProcess): void {
	try {
		if (!process_.kill('SIGTERM')) {
			process_.kill('SIGKILL');
		}
	} catch {
		// The process may already have exited; no diagnostic should contain its command.
	}
}

function validTimeout(value: number | undefined): boolean {
	return value === undefined || (Number.isFinite(value) && value > 0);
}

function waitForDelivery(
	input: RemoteStagingTransferInput,
	deps: RemoteStagingTransferDependencies,
	script: string,
	timeoutMs: number
): Promise<RemoteStagingResult | undefined> {
	return new Promise(resolve => {
		let child: RemoteStagingSshProcess;
		try {
			child = deps.spawn(buildRemoteStagingScriptDeliveryArguments(input));
		} catch {
			notify(deps, { category: 'ssh.client-unavailable', phase: 'script-delivery' });
			resolve(failure('ssh.client-unavailable', 'script-delivery'));
			return;
		}
		let settled = false;
		const clearTimer = deps.clearTimeout ?? globalThis.clearTimeout;
		const finish = (result?: RemoteStagingResult): void => {
			if (settled) {
				return;
			}
			settled = true;
			if (timer !== undefined) {
				clearTimer(timer);
			}
			resolve(result);
		};
		const setTimer = deps.setTimeout ?? globalThis.setTimeout;
		const timer = setTimer(() => {
			notify(deps, { category: 'ssh.transport-failed', phase: 'script-delivery' });
			terminate(child);
			finish(failure('ssh.transport-failed', 'script-delivery'));
		}, timeoutMs);
		child.stdout.on('data', () => undefined);
		child.stderr.on('data', chunk => notify(deps, { category: stderrCategory(String(chunk)), phase: 'script-delivery' }));
		child.stdin.on('error', () => {
			if (!settled) {
				notify(deps, { category: 'ssh.transport-failed', phase: 'script-delivery' });
				terminate(child);
				finish(failure('ssh.transport-failed', 'script-delivery'));
			}
		});
		child.on('error', error => {
			const code = processErrorCode(error);
			notify(deps, { category: code, phase: 'script-delivery' });
			terminate(child);
			finish(failure(code, 'script-delivery'));
		});
		child.on('close', code => {
			if (code === 0) {
				finish();
				return;
			}
			notify(deps, { category: 'ssh.transport-failed', phase: 'script-delivery', exitCode: code ?? undefined });
			finish(failure('ssh.transport-failed', 'script-delivery', code ?? undefined));
		});
		try {
			child.stdin.end(script);
		} catch {
			notify(deps, { category: 'ssh.transport-failed', phase: 'script-delivery' });
			terminate(child);
			finish(failure('ssh.transport-failed', 'script-delivery'));
		}
	});
}

async function executePayload(
	input: RemoteStagingTransferInput,
	deps: RemoteStagingTransferDependencies,
	timeoutMs: number,
	remoteTimeoutMs: number
): Promise<RemoteStagingResult> {
	let child: RemoteStagingSshProcess;
	try {
		child = deps.spawn(buildRemoteStagingExecutionArguments(input));
	} catch {
		notify(deps, { category: 'ssh.client-unavailable', phase: 'payload-transfer' });
		return failure('ssh.client-unavailable', 'payload-transfer');
	}
	let payload: RemotePayloadTarProcess;
	try {
		payload = deps.spawnPayloadTar(input.payloadDirectory);
	} catch {
		terminate(child);
		notify(deps, { category: 'ssh.transport-failed', phase: 'payload-transfer' });
		return failure('ssh.transport-failed', 'payload-transfer');
	}

	return await new Promise<RemoteStagingResult>(resolve => {
		let settled = false;
		let payloadEnded = false;
		let remoteStatus: RemoteStagingHandshake | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let outputBuffer = '';
		let stderrCategorySeen: RemoteStagingDiagnostic['category'] | undefined;
		const setTimer = deps.setTimeout ?? globalThis.setTimeout;
		const clearTimer = deps.clearTimeout ?? globalThis.clearTimeout;
		const finish = (result: RemoteStagingResult): void => {
			if (settled) {
				return;
			}
			settled = true;
			if (timer !== undefined) {
				clearTimer(timer);
			}
			if (result.ok) {
				resolve(result);
				return;
			}
			terminate(child);
			terminate(payload);
			resolve(result);
		};
		const armTimer = (phase: 'payload-transfer' | 'remote-execution', duration: number): void => {
			if (timer !== undefined) {
				clearTimer(timer);
			}
			timer = setTimer(() => {
				notify(deps, { category: 'ssh.transport-failed', phase });
				finish(failure('ssh.transport-failed', phase));
			}, duration);
		};
		child.stdout.on('data', chunk => {
			if (settled) {
				return;
			}
			outputBuffer += String(chunk);
			if (outputBuffer.length > 8192) {
				outputBuffer = outputBuffer.slice(-8192);
			}
			let newline: number;
			while ((newline = outputBuffer.indexOf('\n')) >= 0) {
				const line = outputBuffer.slice(0, newline).replace(/\r$/, '');
				outputBuffer = outputBuffer.slice(newline + 1);
				const parsed = parseRemoteStagingHandshake(line);
				if (parsed !== undefined) {
					remoteStatus = parsed;
					if (parsed.kind !== 'activated' && parsed.kind !== 'already-activated') {
						notify(deps, { category: 'ssh.provisioning-denied', phase: 'remote-execution' });
						finish(failure('ssh.provisioning-denied', 'remote-execution', undefined, parsed.kind));
					}
				}
			}
		});
		child.stderr.on('data', chunk => {
			stderrCategorySeen = stderrCategory(String(chunk));
			notify(deps, { category: stderrCategorySeen, phase: 'remote-execution' });
		});
		child.stdin.on('error', error => {
			// An already-activated host exits before consuming the tar stream. Its
			// closed stdin is expected; the handshake on stdout remains authoritative.
			if ((error as NodeJS.ErrnoException).code !== 'EPIPE') {
				notify(deps, { category: 'ssh.transport-failed', phase: 'payload-transfer' });
				finish(failure('ssh.transport-failed', 'payload-transfer'));
				return;
			}
			terminate(payload);
		});
		child.on('error', error => {
			const code = processErrorCode(error);
			notify(deps, { category: code, phase: 'remote-execution' });
			finish(failure(code, 'remote-execution'));
		});
		child.on('close', code => {
			if (settled) {
				return;
			}
			if (code === 0 && remoteStatus?.kind === 'activated') {
				finish({ ok: true, status: 'activated', version: input.commit });
				return;
			}
			if (code === 0 && remoteStatus?.kind === 'already-activated') {
				finish({ ok: true, status: 'already-activated', version: input.commit });
				return;
			}
			const category = stderrCategorySeen ?? 'ssh.transport-failed';
			notify(deps, { category, phase: 'remote-execution', exitCode: code ?? undefined });
			finish(failure(category, 'remote-execution', code ?? undefined));
		});
		payload.stdout.on('data', chunk => {
			if (settled) {
				return;
			}
			try {
				if (!child.stdin.write(chunk)) {
					// Backpressure is handled by the stream implementation; the timeout remains armed.
				}
			} catch {
				notify(deps, { category: 'ssh.transport-failed', phase: 'payload-transfer' });
				finish(failure('ssh.transport-failed', 'payload-transfer'));
			}
		});
		payload.stdout.on('end', () => {
			if (settled || payloadEnded) {
				return;
			}
			payloadEnded = true;
			try {
				child.stdin.end();
			} catch {
				terminate(payload);
				return;
			}
			armTimer('remote-execution', remoteTimeoutMs);
		});
		payload.on('error', error => {
			if ((error as NodeJS.ErrnoException).code !== 'EPIPE') {
				notify(deps, { category: 'ssh.transport-failed', phase: 'payload-transfer' });
				finish(failure('ssh.transport-failed', 'payload-transfer'));
				return;
			}
			terminate(payload);
		});
		payload.on('close', code => {
			if (!settled && code !== 0 && remoteStatus?.kind !== 'already-activated') {
				notify(deps, { category: 'ssh.transport-failed', phase: 'payload-transfer', exitCode: code ?? undefined });
				finish(failure('ssh.transport-failed', 'payload-transfer', code ?? undefined));
			}
		});
		armTimer('payload-transfer', timeoutMs);
	});
}

/** Stages and atomically activates one approved payload over an existing ControlMaster. */
export async function stageRemotePayload(input: RemoteStagingTransferInput, deps: RemoteStagingTransferDependencies): Promise<RemoteStagingResult> {
	if (!validCommonInput(input) || typeof input.confirm !== 'function' || !validTimeout(input.scriptDeliveryTimeoutMs)
		|| !validTimeout(input.payloadTransferTimeoutMs) || !validTimeout(input.remoteExecutionTimeoutMs)) {
		return failure('invalid-input', 'validation');
	}
	const scriptResult = buildRemoteStagingScript(input);
	if (!scriptResult.valid) {
		return failure('invalid-input', 'validation');
	}
	const summary: RemoteStagingConfirmationSummary = {
		host: input.destination,
		version: input.commit,
		totalSizeBytes: input.manifest.totalSizeBytes,
		// Contract section 5 explicitly permits this hash at the confirmation point:
		// it lets the user verify the exact remote write, while hashes remain absent
		// from logs and reports everywhere else.
		manifestHash: scriptResult.manifestHash
	};
	let approved = false;
	try {
		approved = await input.confirm(summary);
	} catch {
		approved = false;
	}
	if (!approved) {
		notify(deps, { category: 'ssh.provisioning-denied', phase: 'confirmation' });
		return failure('ssh.provisioning-denied', 'confirmation');
	}

	const deliveryFailure = await waitForDelivery(input, deps, scriptResult.script, input.scriptDeliveryTimeoutMs ?? DEFAULT_TIMEOUT_MS);
	if (deliveryFailure !== undefined) {
		return deliveryFailure;
	}
	return executePayload(input, deps, input.payloadTransferTimeoutMs ?? DEFAULT_TIMEOUT_MS, input.remoteExecutionTimeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Factory for the local tar stream; tests inject a fake and never spawn it. */
export function createRemotePayloadTarRunner(): RemotePayloadTarRunner {
	return payloadDirectory => spawn('tar', ['-C', payloadDirectory, '-cf', '-', '--', '.'], {
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true
	});
}
