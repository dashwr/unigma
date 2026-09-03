/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { appendFileSync, accessSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type {
	createRemoteSshProcessRunner as CreateRemoteSshProcessRunner,
	openRemoteServer as OpenRemoteServer,
	RemoteSshProcess
} from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';

const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as {
	createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner;
	openRemoteServer: typeof OpenRemoteServer;
};
const { createRemoteSshProcessRunner, openRemoteServer } = transport;

// This is a valid-looking commit that cannot identify a published build.
const SYNTHETIC_COMMIT = '0000000000000000000000000000000000000001';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-vps-smoke.txt'));
const tracePath = `${reportPath}.ssh-trace.log`;
const checks: Array<readonly [string, 'pass' | 'fail']> = [];

function check(name: string, passed: boolean): void {
	checks.push([name, passed ? 'pass' : 'fail']);
}

function writeReport(finalStatus: 'pass' | 'fail'): void {
	const report = [...checks.map(([name, status]) => `check.${name}=${status}`), `smoke=${finalStatus}`].join('\n') + '\n';
	try {
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, report, { mode: 0o600 });
	} catch {
		// Stdout remains the workflow's fallback when the report path is unavailable.
	}
	process.stdout.write(report);
}

function executable(name: string): string | undefined {
	for (const directory of (process.env.PATH ?? '').split(':').filter(Boolean)) {
		const candidate = join(directory, name);
		try {
			accessSync(candidate, 1);
			return candidate;
		} catch {
			// Do not expose local candidate paths in the report.
		}
	}
	return undefined;
}

function waitForClose(process_: RemoteSshProcess, timeoutMs = 30_000): Promise<void> {
	return new Promise((resolveClose, reject) => {
		let settled = false;
		const finish = (error?: Error): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			error ? reject(error) : resolveClose();
		};
		const timer = setTimeout(() => finish(new Error('process close timeout')), timeoutMs);
		process_.on('close', () => finish());
		process_.on('error', () => finish(new Error('process error')));
	});
}

interface ReadOnlyCommandResult {
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly timedOut: boolean;
}

function runReadOnlyCommand(runner: (arguments_: readonly string[]) => RemoteSshProcess, arguments_: readonly string[], timeoutMs = 10_000): Promise<ReadOnlyCommandResult> {
	const process_ = runner(arguments_);
	const output: Buffer[] = [];
	let outputBytes = 0;
	return new Promise(resolveCommand => {
		let settled = false;
		let forceTimer: ReturnType<typeof setTimeout> | undefined;
		const finish = (exitCode: number | null, timedOut: boolean): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			if (forceTimer !== undefined) {
				clearTimeout(forceTimer);
			}
			resolveCommand({ exitCode, stdout: Buffer.concat(output).toString('utf8'), timedOut });
		};
		const timer = setTimeout(() => {
			try {
				if (!process_.kill('SIGTERM')) {
					process_.kill('SIGKILL');
				}
			} catch {
				// The close event or the force timer still settles this local process.
			}
			forceTimer = setTimeout(() => finish(null, true), 5_000);
		}, timeoutMs);
		process_.stdout.on('data', chunk => {
			const buffer = Buffer.from(chunk as Uint8Array);
			if (outputBytes < 4096) {
				const remaining = 4096 - outputBytes;
				output.push(buffer.subarray(0, remaining));
				outputBytes += Math.min(buffer.length, remaining);
			}
		});
		process_.on('error', () => finish(null, false));
		process_.on('close', (exitCode: number | null) => finish(exitCode, false));
		try {
			process_.stdin.end();
		} catch {
			finish(null, false);
		}
	});
}

function tracedRunner(): (arguments_: readonly string[]) => RemoteSshProcess {
	const realRunner = createRemoteSshProcessRunner();
	return arguments_ => {
		const process_ = realRunner(arguments_);
		process_.stderr.on('data', chunk => {
			try {
				appendFileSync(tracePath, chunk as Buffer);
			} catch {
				// The trace is diagnostic only and never changes the smoke result.
			}
		});
		return process_;
	};
}

async function main(): Promise<void> {
	let session: { readonly controlPath: string; dispose(): Promise<void> } | undefined;
	let masterProcess: RemoteSshProcess | undefined;
	let masterClose: Promise<void> | undefined;
	let masterClosed = false;
	try {
		const destination = process.env['UNIGMA_VPS_ALIAS'];
		check('destination', typeof destination === 'string' && destination.length > 0);
		if (!destination) {
			return;
		}

		const ssh = executable('ssh');
		check('ssh', ssh !== undefined);
		if (!ssh) {
			return;
		}

		mkdirSync(dirname(tracePath), { recursive: true });
		writeFileSync(tracePath, '', { mode: 0o600 });
		const runner = tracedRunner();
		let masterArguments: readonly string[] | undefined;
		const opened = await openRemoteServer({
			destination,
			commit: SYNTHETIC_COMMIT,
			retainControlMasterOnServerUnavailable: true,
			timeoutMs: 30_000
		}, {
			allocateLocalPort: () => 49152,
			spawn: arguments_ => {
				const process_ = runner(arguments_);
				if (masterProcess === undefined) {
					masterProcess = process_;
					masterArguments = arguments_;
					masterClose = waitForClose(process_).then(() => { masterClosed = true; });
				}
				return process_;
			}
		});

		const result = opened as {
			readonly ok?: boolean;
			readonly code?: string;
			readonly phase?: string;
			readonly stagingSession?: { readonly controlPath: string; dispose(): Promise<void> };
			readonly dispose?: () => Promise<void>;
		};
		const retainedSession = result.stagingSession;
		const unavailable = result.ok === false
			&& result.code === 'ssh.remote-server-unavailable'
			&& result.phase === 'handshake'
			&& retainedSession !== undefined;
		check('server-unavailable', unavailable);
		if (!unavailable || !retainedSession) {
			if (result.dispose) {
				await result.dispose();
			}
			return;
		}

		session = retainedSession;
		const controlPath = retainedSession.controlPath;
		const controlDirectory = dirname(controlPath);
		check('session-open', masterArguments?.includes(destination) === true);
		check('batch-mode', masterArguments?.includes('BatchMode=yes') === true);

		const controlCheck = await runReadOnlyCommand(runner, [
			'-o', `ControlPath=${controlPath}`,
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=yes',
			'-O', 'check',
			destination
		]);
		check('control-master', controlCheck.exitCode === 0 && !controlCheck.timedOut);

		const uname = await runReadOnlyCommand(runner, [
			'-o', `ControlPath=${controlPath}`,
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=yes',
			destination,
			'--', 'uname', '-sm'
		]);
		check('remote-platform', uname.exitCode === 0 && !uname.timedOut && uname.stdout.trim() === 'Linux x86_64');

		await session.dispose();
		session = undefined;
		if (masterClose) {
			await masterClose;
		}
		check('dispose-process', masterClosed);
		check('control-path-removed', !existsSync(controlPath) && !existsSync(controlDirectory));
	} finally {
		if (session) {
			await session.dispose().catch(() => undefined);
		}
		if (masterProcess && !masterClosed) {
			try {
				if (!masterProcess.kill('SIGTERM')) {
					masterProcess.kill('SIGKILL');
				}
			} catch {
				// The process may have exited while the failure was being reported.
			}
		}
		if (masterClose) {
			await masterClose.catch(() => undefined);
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
