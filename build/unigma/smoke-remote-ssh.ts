/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFileSync, spawn } from 'node:child_process';
import { createServer, get as httpGet } from 'node:http';
import { accessSync, appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import type {
	createRemoteSshProcessRunner as CreateRemoteSshProcessRunner,
	openRemoteServer as OpenRemoteServer,
	RemoteSshProcess
} from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { buildRemoteBootstrapScript as BuildRemoteBootstrapScript } from '../../extensions/unigma-remote-ssh/out/remoteServerHandshake.js';
import type { deriveRemoteServerPaths as DeriveRemoteServerPaths } from '../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js';

// The extension compiles to CommonJS while this script runs as ESM, so a static
// import resolves the module namespace instead of its named exports. Requiring
// it keeps the real, compiled transport under test rather than a reimplementation.
const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as {
	createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner;
	openRemoteServer: typeof OpenRemoteServer;
};
const handshake = require('../../extensions/unigma-remote-ssh/out/remoteServerHandshake.js') as {
	buildRemoteBootstrapScript: typeof BuildRemoteBootstrapScript;
};
const staging = require('../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js') as {
	deriveRemoteServerPaths: typeof DeriveRemoteServerPaths;
};
const { createRemoteSshProcessRunner, openRemoteServer } = transport;
const { buildRemoteBootstrapScript } = handshake;
const { deriveRemoteServerPaths } = staging;

const COMMIT = /^[0-9a-f]{40}$/;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-ssh-smoke.txt'));
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
		// The report is best effort when its requested destination is unavailable;
		// stdout still carries the same redacted result for the workflow log.
	}
	process.stdout.write(report);
}

function executable(name: string): string | undefined {
	const candidates = name.startsWith('/')
		? [name]
		: (process.env.PATH ?? '').split(':').filter(Boolean).map(directory => join(directory, name));
	for (const candidate of candidates) {
		try {
			accessSync(candidate, 1);
			return candidate;
		} catch {
			// Continue through PATH without exposing candidate paths in the report.
		}
	}
	return undefined;
}

function runQuiet(command: string, arguments_: readonly string[]): boolean {
	try {
		execFileSync(command, [...arguments_], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function freeHighPort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen({ host: '127.0.0.1', port: 0 }, () => {
			const address = server.address();
			server.close(error => {
				if (error || !address || typeof address === 'string' || address.port < 1024) {
					reject(error ?? new Error('no high port'));
					return;
				}
				resolvePort(address.port);
			});
		});
	});
}

function waitForClose(process_: RemoteSshProcess | ReturnType<typeof spawn>, timeoutMs = 10_000): Promise<void> {
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
		const timer: ReturnType<typeof setTimeout> = setTimeout(() => finish(new Error('process close timeout')), timeoutMs);
		process_.on('close', () => finish());
		process_.on('error', () => finish(new Error('process error')));
	});
}

async function terminate(process_: ReturnType<typeof spawn> | undefined): Promise<void> {
	if (!process_ || process_.exitCode !== null || process_.signalCode !== null) {
		return;
	}
	const closed = waitForClose(process_).catch(() => undefined);
	if (!process_.kill('SIGTERM')) {
		process_.kill('SIGKILL');
	}
	await closed;
}

async function waitForTcpPort(port: number, timeoutMs = 10_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await connectTcp(port, 500);
			return;
		} catch {
			await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
		}
	}
	throw new Error('port did not open');
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

async function assertPortClosed(port: number): Promise<void> {
	try {
		await connectTcp(port, 1_000);
		throw new Error('port remained open');
	} catch (error) {
		if (error instanceof Error && error.message === 'port remained open') {
			throw error;
		}
	}
}

async function versionRequest(port: number): Promise<{ statusCode: number | undefined; body: string }> {
	return await new Promise((resolveRequest, reject) => {
		const request = httpGet({ host: '127.0.0.1', port, path: '/version', timeout: 5_000 }, response => {
			const chunks: Buffer[] = [];
			let size = 0;
			response.on('data', chunk => {
				const buffer = Buffer.from(chunk);
				size += buffer.length;
				if (size <= 1024) {
					chunks.push(buffer);
				}
			});
			response.once('end', () => resolveRequest({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
			response.once('error', reject);
		});
		request.once('error', reject);
		request.once('timeout', () => request.destroy(new Error('version request timeout')));
	});
}

/**
 * Keeps the raw OpenSSH stderr of the smoke's own throwaway test bed.
 *
 * The transport itself must never log this, because on a real connection it
 * names the destination. Here the destination is an ephemeral loopback sshd
 * owned by this process, with keys that are generated and deleted within one
 * run, so the trace holds nothing that outlives the smoke — and without it a
 * failure on the runner is only a category name.
 */
function clientKeyRunner(identityPath: string, tracePath: string): (arguments_: readonly string[]) => RemoteSshProcess {
	const realRunner = createRemoteSshProcessRunner();
	return arguments_ => {
		const child = realRunner(['-F', '/dev/null', '-i', identityPath, '-o', 'IdentitiesOnly=yes', ...arguments_]);
		child.stderr.on('data', chunk => {
			try {
				appendFileSync(tracePath, chunk as Buffer);
			} catch {
				// The trace is a diagnostic; losing it must not fail the smoke.
			}
		});
		return child;
	};
}

async function main(): Promise<void> {
	let workDirectory: string | undefined;
	let sshdProcess: ReturnType<typeof spawn> | undefined;
	let sshSession: { dispose(): Promise<void> } | undefined;
	let sshProcess: RemoteSshProcess | undefined;
	let sshClose: Promise<void> | undefined;
	let sshProcessClosed = false;
	try {
		const sshd = executable('/usr/sbin/sshd') ?? executable('sshd');
		const sshKeygen = executable('ssh-keygen');
		const ssh = executable('ssh');
		// A missing key generator also makes the requested sshd smoke impossible;
		// keep the required named failure explicit instead of silently skipping it.
		check('sshd', sshd !== undefined && sshKeygen !== undefined);
		check('ssh-keygen', sshKeygen !== undefined);
		check('ssh', ssh !== undefined);
		if (!sshd || !sshKeygen || !ssh) {
			return;
		}

		workDirectory = mkdtempSync(join('/tmp', 'ug-'));
		chmodSync(workDirectory, 0o700);
		const hostKey = join(workDirectory, 'host-key');
		const clientKey = join(workDirectory, 'client-key');
		check('host-key', runQuiet(sshKeygen, ['-q', '-t', 'ed25519', '-N', '', '-C', 'unigma-smoke-host', '-f', hostKey]));
		check('client-key', runQuiet(sshKeygen, ['-q', '-t', 'ed25519', '-N', '', '-C', 'unigma-smoke-client', '-f', clientKey]));
		if (checks.some(([name, status]) => (name === 'host-key' || name === 'client-key') && status === 'fail')) {
			return;
		}

		const authorizedKeys = join(workDirectory, 'authorized_keys');
		const clientPublicKey = readFileSync(`${clientKey}.pub`, 'utf8').trim();
		writeFileSync(authorizedKeys, `${clientPublicKey}\n`, { mode: 0o600 });
		const hostPublicKey = readFileSync(`${hostKey}.pub`, 'utf8').trim().split(/\s+/);
		if (hostPublicKey.length < 2) {
			check('host-key-format', false);
			return;
		}

		const username = userInfo().username;
		if (!/^[A-Za-z0-9._-]+$/.test(username)) {
			check('username', false);
			return;
		}
		const port = await freeHighPort();
		const knownHosts = join(workDirectory, 'known_hosts');
		writeFileSync(knownHosts, `[127.0.0.1]:${port} ${hostPublicKey[0]} ${hostPublicKey[1]}\n`, { mode: 0o600 });
		const config = join(workDirectory, 'sshd_config');
		writeFileSync(config, [
			`HostKey ${hostKey}`,
			`AuthorizedKeysFile ${authorizedKeys}`,
			'ListenAddress 127.0.0.1',
			// sshd's StrictModes walks every parent of AuthorizedKeysFile and refuses
			// a world-writable one. The work directory has to live under /tmp so the
			// server socket fits the sockaddr_un budget, and /tmp is 1777, so the
			// check rejected a key file that is itself 0600 inside a 0700 directory
			// owned by this user. The whole test bed is disposable and reachable
			// only on loopback, so the check protects nothing here.
			'StrictModes no',
			'UsePAM no',
			'PasswordAuthentication no',
			'KbdInteractiveAuthentication no',
			'ChallengeResponseAuthentication no',
			'PermitRootLogin no',
			'X11Forwarding no',
			'AllowTcpForwarding yes',
			'GatewayPorts no',
			'PermitTTY no',
			'PermitUserEnvironment no',
			'PrintMotd no',
			'UseDNS no',
			'LogLevel ERROR',
			`AllowUsers ${username}`
		].join('\n') + '\n', { mode: 0o600 });
		if (!runQuiet(sshd, ['-t', '-f', config])) {
			check('sshd-config', false);
			return;
		}
		check('sshd-config', true);

		sshdProcess = spawn(sshd, ['-f', config, '-D', '-e', '-p', String(port)], { stdio: ['ignore', 'ignore', 'ignore'] });
		await waitForTcpPort(port);
		check('sshd-process', true);

		// The override exists so the smoke can be reproduced against a server tree
		// that is not the published store, which is the only way to debug a runner
		// failure without a seven minute cycle per attempt.
		const artifact = process.env['UNIGMA_SMOKE_SERVER_TREE']
			?? join(homedir(), '.local', 'share', 'unigma-artifacts', 'unigma-server-latest');
		const provenancePath = join(artifact, 'PROVENANCE.txt');
		check('artifact', existsSync(artifact) && existsSync(provenancePath));
		if (!existsSync(artifact) || !existsSync(provenancePath)) {
			return;
		}
		const provenance = readFileSync(provenancePath, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='));
		const commit = provenance?.slice('commit='.length) ?? '';
		check('provenance', COMMIT.test(commit));
		if (!COMMIT.test(commit)) {
			return;
		}

		// Start under /tmp from the outset: the bootstrap validator enforces the
		// Linux UNIX-socket address budget, and a home checkout can exceed it.
		const bootstrap = buildRemoteBootstrapScript({ commit, remoteUserBaseDirectory: workDirectory });
		const derived = deriveRemoteServerPaths({ commit, remoteUserBaseDirectory: workDirectory });
		check('socket-path', bootstrap.valid && derived.valid);
		if (!bootstrap.valid || !derived.valid) {
			return;
		}
		mkdirSync(dirname(derived.paths.versionedDirectory), { recursive: true });
		cpSync(artifact, derived.paths.versionedDirectory, { recursive: true, dereference: true });
		mkdirSync(derived.paths.serverDataDirectory, { recursive: true });
		const localPort = await freeHighPort();
		const runner = clientKeyRunner(clientKey, `${reportPath}.ssh-trace.log`);
		const opened = await openRemoteServer({
			destination: `ssh://${username}@127.0.0.1:${port}`,
			commit,
			remoteUserBaseDirectory: workDirectory,
			knownHostsFile: knownHosts,
			timeoutMs: 30_000
		}, {
			allocateLocalPort: () => localPort,
			// The categories are the contract's own diagnostic names and carry no
			// destination, command or environment, so they are safe to report and
			// are the only way to tell a refused handshake apart from a refused
			// connection when the run happens on a runner.
			diagnose: diagnostic => {
				checks.push([`diagnostic.${diagnostic.phase}.${diagnostic.category}`, 'fail']);
			},
			spawn: arguments_ => {
				sshProcess = runner(arguments_);
				sshClose = waitForClose(sshProcess).then(() => { sshProcessClosed = true; });
				return sshProcess;
			}
		});
		if ((opened as { readonly ok?: boolean }).ok === false) {
			const failure = opened as { readonly code: string; readonly phase: string; readonly exitCode?: number };
			// Without the code and phase the report says only that the handshake
			// failed, which is not actionable from a runner log.
			checks.push([`handshake.${failure.phase}.${failure.code}`, 'fail']);
			if (failure.exitCode !== undefined) {
				checks.push([`handshake.exit-code.${failure.exitCode}`, 'fail']);
			}
			check('handshake', false);
			return;
		}
		sshSession = opened;
		check('handshake', true);
		await waitForTcpPort(opened.endpoint.port);
		check('forwarded-port', true);
		const version = await versionRequest(opened.endpoint.port);
		check('version-status', version.statusCode === 200);
		check('version-commit', version.body === commit);

		await sshSession.dispose();
		if (sshClose) {
			await sshClose;
		}
		check('ssh-process', sshProcess !== undefined && sshProcessClosed);
		await assertPortClosed(opened.endpoint.port);
		check('port-closed', true);
		sshSession = undefined;
	} finally {
		if (sshSession) {
			await sshSession.dispose().catch(() => undefined);
		}
		if (sshClose) {
			await sshClose.catch(async () => {
				if (sshProcess && !sshProcessClosed) {
					sshProcess.kill('SIGKILL');
					await waitForClose(sshProcess).catch(() => undefined);
				}
			});
		}
		if (sshdProcess) {
			await terminate(sshdProcess);
		}
		if (workDirectory) {
			rmSync(workDirectory, { recursive: true, force: true });
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
