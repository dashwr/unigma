/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Asks whether the remote extension host starts OpenCode when a session is
 * requested — the thing `T-054` is about and the one claim no harness had.
 *
 * The host here is an ephemeral `sshd` on 127.0.0.1, the same bench
 * `smoke-remote-staging.ts` builds, so this proves the mechanism and **not**
 * `AC-007`: that matrix wants a real host, and a bench on the same machine is
 * not one. What it does prove is that a workspace-kind extension loaded in a
 * remote extension host can start the runtime, and that the runtime starts
 * OpenCode *on that host*.
 *
 * Nothing outside this run is touched. The desktop is launched with `HOME`
 * pointed at a throwaway directory, so the `ssh` it spawns reads that
 * directory's `known_hosts` and identity rather than the user's — the reason
 * this needs no `ssh_config` entry and no edit to any shared file. The
 * authority uses the canonical `user@host:port` form that
 * `remoteSshAuthority.ts` already accepts, which is what makes an alias
 * unnecessary.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { accessSync, chmodSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createRemoteSshProcessRunner as CreateRemoteSshProcessRunner, openRemoteServer as OpenRemoteServer, RemoteSshProcess } from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { createRemotePayloadTarRunner as CreateRemotePayloadTarRunner, stageRemotePayload as StageRemotePayload } from '../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js';
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
const { createRemoteSshProcessRunner, openRemoteServer } = transport;
const { createRemotePayloadTarRunner, stageRemotePayload } = stagingTransfer;

const COMMIT = /^[0-9a-f]{40}$/;
const REPORT_NAME = 'unigma-agent-session-report.txt';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reportPath = process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-agent-session.txt');

const facts: [string, string][] = [];
const checks: [string, boolean][] = [];

function check(name: string, passed: boolean): void {
	checks.push([name, passed]);
}

function fact(name: string, value: unknown): void {
	facts.push([name, String(value).slice(0, 160)]);
}

function writeReport(): void {
	const lines = [
		...facts.map(([name, value]) => `${name}=${value}`),
		...checks.map(([name, passed]) => `check.${name}=${passed ? 'pass' : 'fail'}`),
		`agent-session=${checks.every(([, passed]) => passed) && checks.length > 0 ? 'pass' : 'fail'}`
	];
	mkdirSync(dirname(reportPath), { recursive: true });
	writeFileSync(reportPath, `${lines.join('\n')}\n`);
	console.log(lines.join('\n'));
	if (!checks.every(([, passed]) => passed)) {
		process.exitCode = 1;
	}
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

function waitForTcpPort(port: number, timeoutMs = 15_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolvePort, reject) => {
		const attempt = (): void => {
			const socket = createServer();
			socket.close();
			const probe = require('node:net').createConnection({ host: '127.0.0.1', port });
			probe.once('connect', () => { probe.destroy(); resolvePort(); });
			probe.once('error', () => {
				probe.destroy();
				if (Date.now() > deadline) {
					reject(new Error('port never accepted'));
					return;
				}
				setTimeout(attempt, 100);
			});
		};
		attempt();
	});
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

interface ArtifactPair {
	readonly desktop: string;
	readonly server: string;
	readonly opencode: string;
	readonly license: string;
	readonly commit: string;
}

function provenanceCommit(directory: string): string {
	const file = join(directory, 'PROVENANCE.txt');
	if (!existsSync(file)) {
		return '';
	}
	return readFileSync(file, 'utf8').split(/\r?\n/).find(line => line.startsWith('commit='))?.slice('commit='.length) ?? '';
}

function artifactPair(): ArtifactPair | undefined {
	const store = process.env['UNIGMA_ARTIFACT_ROOT'] ?? join(homedir(), '.local', 'share', 'unigma-artifacts');
	const requested = process.env['UNIGMA_ARTIFACT_COMMIT'] ?? '';
	const desktopTree = COMMIT.test(requested) ? join(store, 'versions', 'unigma', requested) : join(store, 'unigma-latest');
	const serverTree = COMMIT.test(requested) ? join(store, 'versions', 'unigma-server', requested) : join(store, 'unigma-server-latest');
	const opencodeTree = join(store, 'opencode-latest');
	const desktopCommit = provenanceCommit(desktopTree);
	const serverCommit = provenanceCommit(serverTree);
	fact('desktop.commit', COMMIT.test(desktopCommit) ? desktopCommit : 'unavailable');
	fact('server.commit', COMMIT.test(serverCommit) ? serverCommit : 'unavailable');
	// The gate is first on purpose: a divergent pair makes the resolver refuse
	// correctly, and that would otherwise read as a workbench defect.
	if (!COMMIT.test(desktopCommit) || desktopCommit !== serverCommit) {
		return undefined;
	}
	return {
		desktop: desktopTree,
		server: join(serverTree, 'server', 'unigma-server.tar.gz'),
		opencode: join(opencodeTree, 'bin', 'opencode'),
		license: join(opencodeTree, 'LICENSE-opencode.txt'),
		commit: desktopCommit
	};
}

function benchRunner(identity: string, port: number): (arguments_: readonly string[]) => RemoteSshProcess {
	const real = createRemoteSshProcessRunner();
	return arguments_ => real(['-F', '/dev/null', '-i', identity, '-o', 'IdentitiesOnly=yes', '-p', String(port), ...arguments_]);
}

const PYTHON_SQLITE_SEED = `import sqlite3, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
connection = sqlite3.connect(path)
connection.execute('CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)')
connection.execute('INSERT INTO ItemTable (key, value) VALUES (?, ?)', (key, value))
connection.commit()
row = connection.execute('SELECT value FROM ItemTable WHERE key = ?', (key,)).fetchone()
connection.close()
sys.exit(0 if row and row[0] == value else 1)
`;

function seedTrust(databasePath: string, authority: string, folderPath: string): boolean {
	const state = JSON.stringify({
		uriTrustInfo: [{ uri: { $mid: 1, path: folderPath, scheme: 'vscode-remote', authority: `ssh-remote+${authority}` }, trusted: true }]
	});
	const result = execFileSync('python3', ['-c', PYTHON_SQLITE_SEED, databasePath, 'workspaceTrust', state], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
	return typeof result === 'string';
}

async function main(): Promise<void> {
	const sshd = executable('/usr/sbin/sshd') ?? executable('sshd');
	const keygen = executable('ssh-keygen');
	// esbuild is a dependency of `build/`, not of the repository root, so the
	// binary lives under build/node_modules — the same install `optimize.ts`
	// imports from.
	const esbuild = join(repoRoot, 'build', 'node_modules', 'esbuild', 'bin', 'esbuild');
	check('tools', Boolean(sshd && keygen && existsSync(esbuild)));
	if (!sshd || !keygen || !existsSync(esbuild)) {
		fact('tools.missing', [sshd ? '' : 'sshd', keygen ? '' : 'ssh-keygen', existsSync(esbuild) ? '' : 'esbuild'].filter(Boolean).join(',') || 'none');
		writeReport();
		return;
	}

	const pair = artifactPair();
	check('artifact-commit-pair', pair !== undefined);
	if (!pair) {
		writeReport();
		return;
	}

	const binary = join(pair.desktop, 'bin', 'unigma');
	check('desktop-binary', existsSync(binary));
	if (!existsSync(binary)) {
		writeReport();
		return;
	}

	let sshdProcess: ChildProcess | undefined;
	let product: ChildProcess | undefined;
	const work = join(repoRoot, '.build', 'remote-agent-session');
	// A short lexical home keeps the server's UNIX socket under sun_path.
	const benchHome = '/tmp/ug-as';
	try {
		rmSync(work, { recursive: true, force: true });
		rmSync(benchHome, { recursive: true, force: true });
		mkdirSync(work, { recursive: true });
		chmodSync(work, 0o700);
		symlinkSync(work, benchHome, 'dir');

		const hostKey = join(work, 'host-key');
		const clientKey = join(work, 'client-key');
		execFileSync(keygen, ['-q', '-t', 'ed25519', '-N', '', '-C', 'unigma-agent-session-host', '-f', hostKey]);
		execFileSync(keygen, ['-q', '-t', 'ed25519', '-N', '', '-C', 'unigma-agent-session-client', '-f', clientKey]);
		const authorizedKeys = join(work, 'authorized_keys');
		writeFileSync(authorizedKeys, `${readFileSync(`${clientKey}.pub`, 'utf8').trim()}\n`, { mode: 0o600 });
		const hostPublic = readFileSync(`${hostKey}.pub`, 'utf8').trim().split(/\s+/);
		const username = userInfo().username;
		const port = await freeHighPort();

		const forceCommand = join(work, 'force-command.sh');
		writeFileSync(forceCommand, `#!/bin/sh\nHOME="${benchHome}"\nexport HOME\nif [ -n "\${SSH_ORIGINAL_COMMAND:-}" ]; then exec /bin/sh -c "$SSH_ORIGINAL_COMMAND"; fi\nexec /bin/sh -s\n`, { mode: 0o700 });
		chmodSync(forceCommand, 0o700);
		const sshdConfig = join(work, 'sshd_config');
		writeFileSync(sshdConfig, [
			`HostKey ${hostKey}`, `AuthorizedKeysFile ${authorizedKeys}`, 'ListenAddress 127.0.0.1', 'StrictModes no',
			'UsePAM no', 'PasswordAuthentication no', 'KbdInteractiveAuthentication no',
			username === 'root' ? 'PermitRootLogin prohibit-password' : 'PermitRootLogin no',
			'AllowTcpForwarding yes', 'GatewayPorts no', 'PermitTTY no', 'PermitUserEnvironment no',
			`ForceCommand ${forceCommand}`, 'PrintMotd no', 'UseDNS no', 'LogLevel ERROR', `AllowUsers ${username}`
		].join('\n') + '\n', { mode: 0o600 });
		execFileSync(sshd, ['-t', '-f', sshdConfig]);
		sshdProcess = spawn(sshd, ['-f', sshdConfig, '-D', '-e', '-p', String(port)], { stdio: ['ignore', 'ignore', 'ignore'] });
		await waitForTcpPort(port);
		check('sshd', true);

		const payloadDirectory = join(work, 'payload');
		execFileSync(process.execPath, ['--experimental-strip-types', join(repoRoot, 'build', 'unigma', 'make-payload.ts'),
			'--server', pair.server, '--opencode', pair.opencode, '--output', payloadDirectory,
			'--client-commit', pair.commit, '--server-commit', pair.commit, '--target', 'linux-x64', '--opencode-license', pair.license]);
		const manifest = JSON.parse(readFileSync(join(payloadDirectory, 'manifest.json'), 'utf8')) as BootstrapManifest;
		check('payload-built', true);

		const destination = `${username}@127.0.0.1`;
		const runner = benchRunner(clientKey, port);
		const knownHostsFile = join(work, 'bench_known_hosts');
		writeFileSync(knownHostsFile, `[127.0.0.1]:${port} ${hostPublic[0]} ${hostPublic[1]}\n`, { mode: 0o600 });
		const opened = await openRemoteServer({ destination, commit: pair.commit, knownHostsFile, retainControlMasterOnServerUnavailable: true, timeoutMs: 30_000 },
			{ allocateLocalPort: () => 49_155, spawn: runner }) as { ok?: boolean; controlPath?: string; stagingSession?: { controlPath: string; dispose(): Promise<void> }; dispose?(): Promise<void> };
		const session = opened.ok === false ? opened.stagingSession : (opened as { controlPath: string; dispose(): Promise<void> });
		check('control-master', session !== undefined);
		if (!session) {
			writeReport();
			return;
		}
		const staged = await stageRemotePayload({
			destination, controlPath: session.controlPath, commit: pair.commit, manifest, payloadDirectory, knownHostsFile,
			payloadTransferTimeoutMs: 600_000, remoteExecutionTimeoutMs: 600_000,
			confirm: summary => summary.host === destination && summary.version === pair.commit
		}, { spawn: runner, spawnPayloadTar: createRemotePayloadTarRunner() });
		check('staged', staged.ok && (staged.status === 'activated' || staged.status === 'already-activated'));
		await session.dispose().catch(() => undefined);
		if (!staged.ok) {
			fact('stage.failure', `${staged.phase}.${staged.code}`);
			writeReport();
			return;
		}

		const driverRoot = join(repoRoot, 'build', 'unigma', 'agent-session-driver');
		execFileSync(esbuild, [join(driverRoot, 'src', 'extension.ts'), '--bundle', '--platform=node', '--format=cjs',
			'--external:vscode', `--outfile=${join(driverRoot, 'out', 'extension.js')}`], { stdio: ['ignore', 'ignore', 'pipe'] });
		check('driver-built', existsSync(join(driverRoot, 'out', 'extension.js')));

		const stateRoot = join(work, 'state');
		const productHome = join(stateRoot, 'home');
		const productSsh = join(productHome, '.ssh');
		const userData = join(stateRoot, 'user-data');
		const sharedData = join(userData, 'shared-data');
		for (const directory of [stateRoot, productHome, productSsh, userData, sharedData, join(sharedData, 'sharedStorage'), join(stateRoot, 'extensions'), join(stateRoot, 'logs'), join(stateRoot, 'crashes')]) {
			mkdirSync(directory, { recursive: true });
		}
		chmodSync(productSsh, 0o700);
		// The product spawns its own `ssh`, which reads HOME. Pointing HOME here
		// is what keeps this run out of the user's known_hosts and config.
		writeFileSync(join(productSsh, 'known_hosts'), `[127.0.0.1]:${port} ${hostPublic[0]} ${hostPublic[1]}\n`, { mode: 0o600 });
		writeFileSync(join(productSsh, 'id_ed25519'), readFileSync(clientKey), { mode: 0o600 });
		writeFileSync(join(productSsh, 'id_ed25519.pub'), readFileSync(`${clientKey}.pub`), { mode: 0o644 });
		writeFileSync(join(productSsh, 'config'), `Host 127.0.0.1\n\tPort ${port}\n\tIdentitiesOnly yes\n`, { mode: 0o600 });

		const authority = `${username}@127.0.0.1:${port}`;
		check('workspace-trust-seeded', seedTrust(join(sharedData, 'sharedStorage', 'state.vscdb'), authority, benchHome));

		rmSync(join(work, REPORT_NAME), { force: true });
		const folderUri = `vscode-remote://ssh-remote+${authority}${benchHome}`;
		product = spawn(binary, [
			'--skip-release-notes', '--skip-welcome', '--disable-telemetry', '--disable-experiments', '--disable-updates',
			'--log=trace',
			`--folder-uri=${folderUri}`,
			`--extensionDevelopmentPath=vscode-remote://ssh-remote+${authority}${driverRoot}`,
			'--extensionDevelopmentKind=workspace',
			`--user-data-dir=${userData}`, `--shared-data-dir=${sharedData}`,
			`--extensions-dir=${join(stateRoot, 'extensions')}`, `--logsPath=${join(stateRoot, 'logs')}`,
			`--crash-reporter-directory=${join(stateRoot, 'crashes')}`
		], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HOME: productHome } });
		product.stdout?.resume();
		product.stderr?.resume();

		const deadline = Date.now() + 180_000;
		let report = '';
		while (Date.now() < deadline && !report) {
			if (existsSync(join(work, REPORT_NAME))) {
				report = readFileSync(join(work, REPORT_NAME), 'utf8');
				break;
			}
			await delay(1_000);
		}
		check('driver-reported', report.length > 0);
		for (const line of report.split('\n')) {
			const match = /^([a-z][a-zA-Z0-9._-]{0,60})=([A-Za-z0-9._-]{1,40})$/.exec(line.trim());
			if (match) {
				fact(`driver.${match[1]}`, match[2]);
			}
		}
		const reported = new Map(report.split('\n').map(line => line.split('=')).filter(parts => parts.length === 2).map(parts => [parts[0].trim(), parts[1].trim()]));
		// The driver must have run on the remote side, or nothing after this means
		// what it says.
		check('driver-hosted-remotely', reported.get('remote.name') === 'ssh-remote' && reported.get('workspace.scheme') === 'vscode-remote');
		check('session-start-accepted', reported.get('start.sent') === 'true');
		// The claim of T-054: the runtime started OpenCode on the remote host.
		check('opencode-on-remote-host', reported.get('opencode.listening') === 'true');
	} catch (error) {
		fact('failure', (error as Error | undefined)?.message?.slice(0, 120) ?? 'unknown');
		check('completed', false);
	} finally {
		product?.kill('SIGTERM');
		sshdProcess?.kill('SIGTERM');
		await delay(500);
		product?.kill('SIGKILL');
		sshdProcess?.kill('SIGKILL');
		rmSync(benchHome, { force: true });
		writeReport();
	}
}

void main();
