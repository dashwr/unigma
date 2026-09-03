/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createServer, get as httpGet } from 'node:http';
import { accessSync, appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import type {
	createRemoteSshProcessRunner as CreateRemoteSshProcessRunner,
	openRemoteServer as OpenRemoteServer,
	RemoteSshProcess
} from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { createRemotePayloadTarRunner as CreateRemotePayloadTarRunner, stageRemotePayload as StageRemotePayload } from '../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js';
import type { deriveRemoteServerPaths as DeriveRemoteServerPaths } from '../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js';
import type { BootstrapManifest } from '../../extensions/unigma-remote-ssh/out/bootstrapManifest.js';

const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as {
	createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner;
	openRemoteServer: typeof OpenRemoteServer;
};
const stagingTransfer = require('../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js') as {
	createRemotePayloadTarRunner: typeof CreateRemotePayloadTarRunner;
	stageRemotePayload: typeof StageRemotePayload;
};
const stagingPlan = require('../../extensions/unigma-remote-ssh/out/remoteStagingPlan.js') as {
	deriveRemoteServerPaths: typeof DeriveRemoteServerPaths;
};
const { createRemoteSshProcessRunner, openRemoteServer } = transport;
const { createRemotePayloadTarRunner, stageRemotePayload } = stagingTransfer;
const { deriveRemoteServerPaths } = stagingPlan;

const COMMIT = /^[0-9a-f]{40}$/;
const SYNTHETIC_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const CONNECTION_COMMIT = 'fedcba9876543210fedcba9876543210fedcba98';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-staging-smoke.txt'));
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
		// Stdout remains the workflow's fallback when the requested report path fails.
	}
	process.stdout.write(report);
}

function executable(name: string): string | undefined {
	const candidates = name.startsWith('/') ? [name] : (process.env.PATH ?? '').split(':').filter(Boolean).map(directory => join(directory, name));
	for (const candidate of candidates) {
		try {
			accessSync(candidate, 1);
			return candidate;
		} catch {
			// Candidate paths are not diagnostics.
		}
	}
	return undefined;
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

function waitForClose(process_: RemoteSshProcess | ChildProcess, timeoutMs = 30_000): Promise<void> {
	return new Promise((resolveClose, reject) => {
		let settled = false;
		const timer = setTimeout(() => finish(new Error('process close timeout')), timeoutMs);
		const finish = (error?: Error): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			error ? reject(error) : resolveClose();
		};
		process_.on('close', () => finish());
		process_.on('error', () => finish(new Error('process error')));
	});
}

async function terminate(process_: ChildProcess | undefined): Promise<void> {
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
			await new Promise<void>((resolveConnection, reject) => {
				const socket = createConnection({ host: '127.0.0.1', port });
				socket.once('connect', () => { socket.destroy(); resolveConnection(); });
				socket.once('error', error => { socket.destroy(); reject(error); });
				socket.setTimeout(500, () => { socket.destroy(); reject(new Error('connection timeout')); });
			});
			return;
		} catch {
			await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
		}
	}
	throw new Error('port did not open');
}

async function versionRequest(port: number): Promise<{ statusCode: number | undefined; body: string }> {
	return await new Promise((resolveRequest, reject) => {
		const request = httpGet({ host: '127.0.0.1', port, path: '/version', timeout: 5_000 }, response => {
			const chunks: Buffer[] = [];
			response.on('data', chunk => chunks.push(Buffer.from(chunk)));
			response.once('end', () => resolveRequest({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
			response.once('error', reject);
		});
		request.once('error', reject);
		request.once('timeout', () => request.destroy(new Error('version request timeout')));
	});
}

function clientKeyRunner(identityPath: string, tracePath: string, port: number): (arguments_: readonly string[]) => RemoteSshProcess {
	const realRunner = createRemoteSshProcessRunner();
	return arguments_ => {
		const child = realRunner(['-F', '/dev/null', '-i', identityPath, '-o', 'IdentitiesOnly=yes', '-p', String(port), ...arguments_]);
		child.stderr.on('data', chunk => {
			try {
				appendFileSync(tracePath, chunk as Buffer);
			} catch {
				// The trace is best effort and never changes the result.
			}
		});
		return child;
	};
}

/**
 * Assembles the payload from the artifacts published by the Linux workflows.
 *
 * On the runner the checkout paths above do not exist, because they belong to a
 * developer machine outside WSL. The published store is the only place where a
 * real server and a real opencode are both present, which is what makes the
 * version assertion mean anything.
 */
function payloadInputsFromStore(workDirectory: string): { server: string; opencode: string; license: string; commit: string; mode: 'real' } | undefined {
	const store = process.env['UNIGMA_ARTIFACT_ROOT'] ?? join(homedir(), '.local', 'share', 'unigma-artifacts');
	const serverTree = join(store, 'unigma-server-latest');
	const opencodeTree = join(store, 'opencode-latest');
	const serverProvenance = join(serverTree, 'PROVENANCE.txt');
	const opencode = join(opencodeTree, 'bin', 'opencode');
	const license = join(opencodeTree, 'LICENSE-opencode.txt');
	if (!existsSync(serverProvenance) || !existsSync(opencode) || !existsSync(license)) {
		return undefined;
	}
	const commit = readFileSync(serverProvenance, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='))?.slice('commit='.length) ?? '';
	if (!COMMIT.test(commit)) {
		return undefined;
	}
	// The store keeps the server extracted, while the payload format transports a
	// single archive, so it is repacked here rather than published twice.
	const archive = join(workDirectory, 'store-server.tar.gz');
	// The store pointer is a symlink, and tar would archive the link instead of
	// the tree behind it, so the version directory is resolved first.
	const resolved = realpathSync(serverTree);
	execFileSync(executable('tar') ?? 'tar', [
		'--owner=0', '--group=0', '-czf', archive,
		'-C', dirname(resolved), basename(resolved)
	]);
	return { server: archive, opencode, license, commit, mode: 'real' };
}

function payloadInputs(workDirectory: string): { server: string; opencode: string; license: string; commit: string; mode: 'real' | 'synthetic' } {
	const serverArchive = process.env['UNIGMA_SMOKE_SERVER_ARCHIVE'] ?? '/home/dasher/projects/unigma/buildlinuxdounigmaserver/unigma-server-linux-x64-09aa87ffbb694b578c37f10ef8288c3590dfe252/server/unigma-server.tar.gz';
	const opencodeBinary = process.env['UNIGMA_SMOKE_OPENCODE'] ?? '/home/dasher/projects/unigma/buildlinuxdoopencode/opencode/bin/opencode';
	const licenseFile = process.env['UNIGMA_SMOKE_OPENCODE_LICENSE'] ?? '/home/dasher/projects/unigma/buildlinuxdoopencode/opencode/LICENSE-opencode.txt';
	const provenance = join(dirname(dirname(serverArchive)), 'PROVENANCE.txt');
	if (existsSync(serverArchive) && existsSync(opencodeBinary) && existsSync(licenseFile) && existsSync(provenance)) {
		const commit = readFileSync(provenance, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='))?.slice('commit='.length) ?? '';
		if (COMMIT.test(commit)) {
			return { server: serverArchive, opencode: opencodeBinary, license: licenseFile, commit, mode: 'real' };
		}
	}

	const fromStore = payloadInputsFromStore(workDirectory);
	if (fromStore) {
		return fromStore;
	}

	// The synthetic server answers GET /version with a commit it was told to
	// print, so a run using it proves the staging mechanics and nothing about the
	// real server. Falling back to it silently turned the version assertion into
	// a mock confirming itself, which `AGENTS.md` refuses to accept as evidence
	// of support. It now has to be asked for by name.
	if (process.env['UNIGMA_SMOKE_SYNTHETIC'] !== '1') {
		throw new Error('no real payload inputs: publish the server and opencode artifacts, or set UNIGMA_SMOKE_SYNTHETIC=1 to accept a mock');
	}

	const root = join(workDirectory, 'synthetic-source', 'vscode-reh-linux-x64');
	const bin = join(root, 'bin');
	mkdirSync(bin, { recursive: true });
	const serverScript = `#!/usr/bin/env node\nimport fs from 'node:fs';\nimport net from 'node:net';\nconst socket = process.argv[process.argv.indexOf('--socket-path') + 1];\nconst listener = net.createServer(client => { let data = ''; let responded = false; client.on('data', chunk => { data += chunk; if (!responded && data.includes('\\r\\n\\r\\n')) { responded = true; if (data.startsWith('GET /version')) { const body = '${SYNTHETIC_COMMIT}'; client.end('HTTP/1.1 200 OK\\r\\nContent-Length: ' + body.length + '\\r\\nConnection: close\\r\\n\\r\\n' + body); } else { client.end('HTTP/1.1 404 Not Found\\r\\nContent-Length: 0\\r\\n\\r\\n'); } } }); });\ntry { fs.unlinkSync(socket); } catch {}\nlistener.listen(socket, () => console.log('Extension host agent listening on ' + socket));\n`;
	const syntheticServer = join(bin, 'unigma-server');
	writeFileSync(syntheticServer, serverScript, { mode: 0o755 });
	chmodSync(syntheticServer, 0o755);
	const archive = join(workDirectory, 'synthetic-server.tar.gz');
	execFileSync(executable('tar') ?? 'tar', ['--owner=0', '--group=0', '-czf', archive, '-C', dirname(root), 'vscode-reh-linux-x64']);
	const opencode = join(workDirectory, 'synthetic-opencode');
	writeFileSync(opencode, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
	const license = join(workDirectory, 'LICENSE-opencode.txt');
	writeFileSync(license, 'synthetic license\n');
	return { server: archive, opencode, license, commit: SYNTHETIC_COMMIT, mode: 'synthetic' };
}

function prepareInstalledServer(remoteHome: string, archive: string): void {
	const paths = deriveRemoteServerPaths({ commit: CONNECTION_COMMIT, remoteUserBaseDirectory: remoteHome });
	if (!paths.valid) {
		throw new Error('connection server path invalid');
	}
	mkdirSync(paths.paths.versionedDirectory, { recursive: true });
	execFileSync(executable('tar') ?? 'tar', ['-xzf', archive, '--strip-components=1', '-C', paths.paths.versionedDirectory]);
	mkdirSync(paths.paths.serverDataDirectory, { recursive: true });
}

async function main(): Promise<void> {
	let workDirectory: string | undefined;
	let sshdProcess: ChildProcess | undefined;
	let remoteHome: string | undefined;
	let initialSession: { dispose(): Promise<void>; controlPath: string } | undefined;
	let finalSession: { dispose(): Promise<void>; endpoint: { port: number } } | undefined;
	try {
		const sshd = executable('/usr/sbin/sshd') ?? executable('sshd');
		const sshKeygen = executable('ssh-keygen');
		const tar = executable('tar');
		check('tools', sshd !== undefined && sshKeygen !== undefined && tar !== undefined);
		if (!sshd || !sshKeygen || !tar) {
			return;
		}
		workDirectory = join(repoRoot, '.build', 'remote-staging');
		rmSync(workDirectory, { recursive: true, force: true });
		mkdirSync(workDirectory, { recursive: true });
		// Keep all files under .build while giving the remote UNIX socket a short
		// lexical HOME, staying below Linux's sockaddr_un limit.
		remoteHome = '/tmp/ug-rs';
		rmSync(remoteHome, { recursive: true, force: true });
		symlinkSync(workDirectory, remoteHome, 'dir');
		chmodSync(workDirectory, 0o700);
		const hostKey = join(workDirectory, 'host-key');
		const clientKey = join(workDirectory, 'client-key');
		execFileSync(sshKeygen, ['-q', '-t', 'ed25519', '-N', '', '-C', 'unigma-smoke-host', '-f', hostKey]);
		execFileSync(sshKeygen, ['-q', '-t', 'ed25519', '-N', '', '-C', 'unigma-smoke-client', '-f', clientKey]);
		const authorizedKeys = join(workDirectory, 'authorized_keys');
		writeFileSync(authorizedKeys, `${readFileSync(`${clientKey}.pub`, 'utf8').trim()}\n`, { mode: 0o600 });
		const hostPublicKey = readFileSync(`${hostKey}.pub`, 'utf8').trim().split(/\s+/);
		const username = userInfo().username;
		const port = await freeHighPort();
		const knownHosts = join(workDirectory, 'known_hosts');
		writeFileSync(knownHosts, `[127.0.0.1]:${port} ${hostPublicKey[0]} ${hostPublicKey[1]}\n`, { mode: 0o600 });
		const forceCommand = join(workDirectory, 'force-command.sh');
		writeFileSync(forceCommand, '#!/bin/sh\nHOME="$1"\nexport HOME\nif [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then exec /bin/sh -c "$SSH_ORIGINAL_COMMAND"; fi\nexec /bin/sh -s\n', { mode: 0o700 });
		chmodSync(forceCommand, 0o700);
		const config = join(workDirectory, 'sshd_config');
		writeFileSync(config, [
			`HostKey ${hostKey}`, `AuthorizedKeysFile ${authorizedKeys}`, 'ListenAddress 127.0.0.1', 'StrictModes no',
			'UsePAM no', 'PasswordAuthentication no', 'KbdInteractiveAuthentication no', 'ChallengeResponseAuthentication no',
			// A root rehearsal logs in as root, so a flat refusal makes the smoke
			// unable to test the privileged path at all. `prohibit-password` keeps
			// the property that matters here — only the disposable key is accepted —
			// while still allowing the rehearsal the maintainer asked for.
			username === 'root' ? 'PermitRootLogin prohibit-password' : 'PermitRootLogin no',
			'AllowTcpForwarding yes', 'GatewayPorts no', 'PermitTTY no', 'PermitUserEnvironment no',
			`ForceCommand ${forceCommand} ${remoteHome}`, 'PrintMotd no', 'UseDNS no', 'LogLevel ERROR', `AllowUsers ${username}`
		].join('\n') + '\n', { mode: 0o600 });
		execFileSync(sshd, ['-t', '-f', config]);
		sshdProcess = spawn(sshd, ['-f', config, '-D', '-e', '-p', String(port)], { stdio: ['ignore', 'ignore', 'ignore'] });
		await waitForTcpPort(port);
		check('sshd', true);

		const payload = payloadInputs(workDirectory);
		check(`payload-mode.${payload.mode}`, true);
		const payloadDirectory = join(workDirectory, 'payload');
		const makePayload = join(repoRoot, 'build', 'unigma', 'make-payload.ts');
		const started = Date.now();
		execFileSync(process.execPath, ['--experimental-strip-types', makePayload, '--server', payload.server, '--opencode', payload.opencode, '--output', payloadDirectory, '--client-commit', payload.commit, '--server-commit', payload.commit, '--target', 'linux-x64', '--opencode-license', payload.license]);
		check('payload-built', existsSync(join(payloadDirectory, 'manifest.json')));
		check(`payload-build-ms.${Date.now() - started}`, true);
		const manifest = JSON.parse(readFileSync(join(payloadDirectory, 'manifest.json'), 'utf8')) as BootstrapManifest;
		const tracePath = `${reportPath}.ssh-trace.log`;
		rmSync(tracePath, { force: true });
		const runner = clientKeyRunner(clientKey, tracePath, port);
		const destination = `${username}@127.0.0.1`;
		prepareInstalledServer(remoteHome, payload.server);
		const connectionPort = await freeHighPort();
		const opened = await openRemoteServer({ destination, commit: CONNECTION_COMMIT, knownHostsFile: knownHosts, timeoutMs: 30_000 }, {
			allocateLocalPort: () => connectionPort,
			spawn: runner
		});
		if ((opened as { readonly ok?: boolean }).ok === false) {
			// Without the phase and code the report says only that the connection
			// failed, which is not actionable from a runner log.
			const failure = opened as { readonly code: string; readonly phase: string };
			checks.push([`control-master.${failure.phase}.${failure.code}`, 'fail']);
			check('control-master', false);
			return;
		}
		initialSession = opened;
		check('control-master', true);
		const stageStart = Date.now();
		const stagingTimeoutMs = 600_000;
		const staged = await stageRemotePayload({ destination, controlPath: opened.controlPath, commit: payload.commit, manifest, payloadDirectory, knownHostsFile: knownHosts, payloadTransferTimeoutMs: stagingTimeoutMs, remoteExecutionTimeoutMs: stagingTimeoutMs, confirm: summary => summary.host === destination && summary.version === payload.commit && summary.totalSizeBytes === manifest.totalSizeBytes && /^[a-f0-9]{64}$/.test(summary.manifestHash) }, {
			spawn: runner,
			spawnPayloadTar: createRemotePayloadTarRunner()
		});
		check('activated', staged.ok && staged.status === 'activated');
		if (!staged.ok) {
			check(`stage-failure.${staged.phase}.${staged.code}.${staged.remoteStatus ?? 'none'}`, false);
		}
		check(`stage-ms.${Date.now() - stageStart}`, staged.ok);
		const repeated = await stageRemotePayload({ destination, controlPath: opened.controlPath, commit: payload.commit, manifest, payloadDirectory, knownHostsFile: knownHosts, payloadTransferTimeoutMs: stagingTimeoutMs, remoteExecutionTimeoutMs: stagingTimeoutMs, confirm: () => true }, {
			spawn: runner,
			spawnPayloadTar: createRemotePayloadTarRunner()
		});
		check('idempotent', repeated.ok && repeated.status === 'already-activated');
		if (!repeated.ok) {
			check(`idempotent-failure.${repeated.phase}.${repeated.code}.${repeated.remoteStatus ?? 'none'}`, false);
		}
		await initialSession.dispose();
		initialSession = undefined;
		const finalPort = await freeHighPort();
		const finalOpened = await openRemoteServer({ destination, commit: payload.commit, knownHostsFile: knownHosts, timeoutMs: 30_000 }, { allocateLocalPort: () => finalPort, spawn: runner });
		if ((finalOpened as { readonly ok?: boolean }).ok === false) {
			const failure = finalOpened as { readonly phase: string; readonly code: string };
			check(`activated-transport-failure.${failure.phase}.${failure.code}`, false);
			check('activated-transport', false);
			return;
		}
		finalSession = finalOpened;
		check('activated-transport', true);
		const version = await versionRequest(finalOpened.endpoint.port);
		check('version-status', version.statusCode === 200);
		check('version-commit', version.body === payload.commit);
		await finalSession.dispose();
		finalSession = undefined;
	} finally {
		if (finalSession) {
			await finalSession.dispose().catch(() => undefined);
		}
		if (initialSession) {
			await initialSession.dispose().catch(() => undefined);
		}
		await terminate(sshdProcess);
		if (workDirectory) {
			rmSync(workDirectory, { recursive: true, force: true });
		}
		if (remoteHome) {
			rmSync(remoteHome, { recursive: true, force: true });
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
