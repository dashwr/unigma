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

import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { accessSync, appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { homedir, userInfo } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

function artifactPair(workDirectory: string): ArtifactPair | undefined {
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
	/*
	 * The store keeps the server extracted while the payload format transports a
	 * single archive, so it is repacked here — the same thing
	 * `smoke-remote-staging.ts` does, and for the same reason. The pointer is a
	 * symlink, and tar would archive the link rather than the tree, so the
	 * version directory is resolved first.
	 */
	const archive = join(workDirectory, 'store-server.tar.gz');
	const resolved = realpathSync(serverTree);
	execFileSync(executable('tar') ?? 'tar', ['--owner=0', '--group=0', '-czf', archive, '-C', dirname(resolved), basename(resolved)]);
	return {
		desktop: desktopTree,
		server: archive,
		opencode: join(opencodeTree, 'bin', 'opencode'),
		license: join(opencodeTree, 'LICENSE-opencode.txt'),
		commit: desktopCommit
	};
}

function benchRunner(identity: string, port: number): (arguments_: readonly string[]) => RemoteSshProcess {
	const real = createRemoteSshProcessRunner();
	return arguments_ => real(['-F', '/dev/null', '-i', identity, '-o', 'IdentitiesOnly=yes', '-p', String(port), ...arguments_]);
}

const PYTHON_SQLITE_SEED = `
import sqlite3
import sys

database, key, value, targets_key, targets_value = sys.argv[1:6]
connection = sqlite3.connect(database)
try:
\tconnection.execute("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)")
\tconnection.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (key, value))
\tconnection.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (targets_key, targets_value))
\tconnection.commit()
\trow = connection.execute("SELECT value FROM ItemTable WHERE key = ?", (key,)).fetchone()
\ttargets_row = connection.execute("SELECT value FROM ItemTable WHERE key = ?", (targets_key,)).fetchone()
\tif row is None or row[0] != value or targets_row is None or targets_row[0] != targets_value:
\t\traise RuntimeError("seed verification failed")
finally:
\tconnection.close()
`;

/*
 * Keys and shape copied from `smoke-remote-window.ts`, which copied them from
 * the workbench: `content.trust.model.key` is what the trust service reads, and
 * the target marker is what makes the row survive as machine state. Guessing
 * either one produces a row the workbench ignores, and a window that stops on
 * the trust dialog with no visible reason.
 */
const WORKSPACE_TRUST_STORAGE_KEY = 'content.trust.model.key';
const STORAGE_TARGETS_KEY = '__$__targetStorageMarker';
const STORAGE_MACHINE_TARGET = '1';

function seedTrust(databasePath: string, authority: string, folderPath: string): { readonly seeded: boolean; readonly reason: string } {
	// URI.toJSON() for the canonical remote URI emits the marshalling id and only
	// non-empty components.
	const state = JSON.stringify({
		uriTrustInfo: [{ uri: { $mid: 1, path: folderPath, scheme: 'vscode-remote', authority: `ssh-remote+${authority}` }, trusted: true }]
	});
	const result = spawnSync('python3', [
		'-c', PYTHON_SQLITE_SEED, databasePath, WORKSPACE_TRUST_STORAGE_KEY, state,
		STORAGE_TARGETS_KEY, JSON.stringify({ [WORKSPACE_TRUST_STORAGE_KEY]: Number(STORAGE_MACHINE_TARGET) })
	], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
	if (result.error) {
		return { seeded: false, reason: result.error.code === 'ENOENT' ? 'python3-unavailable' : 'python3-failed-to-start' };
	}
	if (result.status !== 0) {
		return { seeded: false, reason: result.status === null ? 'sqlite-process-signaled' : 'sqlite-write-or-verification-failed' };
	}
	return { seeded: true, reason: 'sqlite-row-verified' };
}


/*
 * Without this the smoke is blind: a driver that never reports looks identical
 * whether the remote window failed to open, the extension was not loaded, or the
 * bridge refused. These are the same markers `smoke-remote-window.ts` watches,
 * and they say how far the connection actually got.
 */
const RESOLVER_SUCCESS = /resolveAuthority\(ssh-remote\) returned '[^']*' after ([0-9]+) ms/;
const RESOLVER_ERROR = /resolveAuthority\(ssh-remote\) returned an error after ([0-9]+) ms/;
const RESOLVED_AUTHORITY_CONSUMED = /2\/6\. socketFactory\.connect\(\) was successful\./;
const EXTENSION_HOST_HANDSHAKE = /handshake finished, connection is up and running after ([0-9]+) ms/;

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

function observeWindow(logsDirectory: string): void {
	const parts: string[] = [];
	walkLogs(logsDirectory, parts);
	const text = parts.join('\n');
	fact('window.log-bytes', text.length);
	fact('window.resolver', RESOLVER_SUCCESS.test(text) ? 'returned' : RESOLVER_ERROR.test(text) ? 'error' : 'absent');
	fact('window.authority-consumed', RESOLVED_AUTHORITY_CONSUMED.test(text));
	fact('window.exthost-handshake', EXTENSION_HOST_HANDSHAKE.test(text));
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

	const work = join(repoRoot, '.build', 'remote-agent-session');
	rmSync(work, { recursive: true, force: true });
	mkdirSync(work, { recursive: true });
	chmodSync(work, 0o700);

	const pair = artifactPair(work);
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
	// A short lexical home keeps the server's UNIX socket under sun_path.
	const benchHome = '/tmp/ug-as';
	try {
		rmSync(benchHome, { recursive: true, force: true });
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
		const trust = seedTrust(join(sharedData, 'sharedStorage', 'state.vscdb'), authority, benchHome);
		check('workspace-trust-seeded', trust.seeded);
		fact('workspace-trust', trust.seeded ? 'seeded-by-smoke' : `not-seeded:${trust.reason}`);
		if (!trust.seeded) {
			writeReport();
			return;
		}

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
		// The product's own output is the other half of the diagnosis, and a
		// resumed stream throws it away.
		const productLog = `${reportPath}.product.log`;
		rmSync(productLog, { force: true });
		const append = (chunk: Buffer | string): void => {
			try {
				appendFileSync(productLog, chunk);
			} catch {
				// Best effort, and never changes the result.
			}
		};
		product.stdout?.on('data', append);
		product.stderr?.on('data', append);

		const deadline = Date.now() + 180_000;
		let report = '';
		while (Date.now() < deadline && !report) {
			if (existsSync(join(work, REPORT_NAME))) {
				report = readFileSync(join(work, REPORT_NAME), 'utf8');
				break;
			}
			await delay(1_000);
		}
		observeWindow(join(stateRoot, 'logs'));
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
		// `Command failed: <very long argv>` truncates to nothing useful, and the
		// stderr of the child is where the reason actually is.
		const thrown = error as (Error & { stderr?: Buffer | string }) | undefined;
		const stderr = typeof thrown?.stderr === 'string' ? thrown.stderr : thrown?.stderr?.toString('utf8') ?? '';
		fact('failure.message', (thrown?.message ?? 'unknown').split('\n')[0].slice(0, 120));
		fact('failure.stderr', stderr.trim().split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160) ?? 'none');
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
