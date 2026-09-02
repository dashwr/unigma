/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import * as fs from 'node:fs';
import { createServer } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OpenCodeHttpClient, SUPPORTED_OPENCODE_VERSION, type OpenCodeEvent } from '../infrastructure/openCodeHttpClient';
import type { OwnedProcessHandle } from '../domain/runtime';

/*
 * Opt-in contract test against a real `opencode serve`. It never runs by
 * default: the unit suite must not depend on an external executable and a
 * fixture must never be presented as evidence of a supported binary.
 */
const OPENCODE_EXECUTABLE = '/usr/bin/opencode';

function realExecutableVersion(): string | undefined {
	if (process.env.OPENCODE_REAL_E2E !== '1' || process.platform === 'win32' || !fs.existsSync(OPENCODE_EXECUTABLE)) {
		return undefined;
	}

	const probe = spawnSync(OPENCODE_EXECUTABLE, ['--version'], { encoding: 'utf8', timeout: 30_000 });
	if (probe.status !== 0) {
		return undefined;
	}

	return probe.stdout.trim();
}

function reserveLoopbackPort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Could not reserve a loopback port.'));
				return;
			}
			server.close(error => error ? reject(error) : resolve(address.port));
		});
	});
}

interface RealServer {
	readonly child: ChildProcessByStdio<null, Readable, Readable>;
	readonly root: string;
	readonly workspace: string;
	readonly endpoint: string;
	readonly announcedEndpoint: string;
}

/*
 * The child runs with a throwaway HOME/XDG tree and `--pure`, so no user
 * configuration, plugin, or credential of the host is read or written.
 */
async function startRealServer(): Promise<RealServer> {
	const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'unigma-opencode-e2e-'));
	const workspace = path.join(root, 'workspace');
	const home = path.join(root, 'home');
	fs.mkdirSync(workspace);
	fs.mkdirSync(home);

	const port = await reserveLoopbackPort();
	const child = spawn(OPENCODE_EXECUTABLE, ['serve', '--pure', '--port', String(port), '--hostname', '127.0.0.1'], {
		cwd: workspace,
		shell: false,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: {
			HOME: home,
			PATH: '/usr/bin:/bin',
			TERM: 'dumb',
			XDG_CONFIG_HOME: path.join(home, '.config'),
			XDG_DATA_HOME: path.join(home, '.local', 'share'),
			XDG_CACHE_HOME: path.join(home, '.cache'),
			XDG_STATE_HOME: path.join(home, '.state'),
		},
	});

	let announced = '';
	child.stdout.setEncoding('utf8');
	child.stdout.on('data', chunk => { announced += chunk; });
	child.stderr.resume();

	const deadline = Date.now() + 60_000;
	let match: RegExpExecArray | null = null;
	while (Date.now() < deadline) {
		match = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(announced);
		if (match || child.exitCode !== null) {
			break;
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	if (!match) {
		await stopRealServer({ child, root, workspace, endpoint: '', announcedEndpoint: '' });
		throw new Error('The real OpenCode server did not announce a loopback endpoint.');
	}

	return { child, root, workspace, endpoint: `http://127.0.0.1:${port}`, announcedEndpoint: match[1] };
}

/** Stops only the child this test created and removes only its own temporary tree. */
async function stopRealServer(server: RealServer): Promise<void> {
	if (server.child.exitCode === null) {
		const exited = new Promise<void>(resolve => {
			server.child.once('exit', () => resolve());
			setTimeout(() => resolve(), 10_000);
		});
		server.child.kill();
		await exited;
		if (server.child.exitCode === null) {
			server.child.kill('SIGKILL');
		}
	}

	fs.rmSync(server.root, { recursive: true, force: true });
}

const realVersion = realExecutableVersion();

suite('Unigma OpenCode real binary contract (opt-in)', function () {
	this.timeout(180_000);

	test('validates health, /doc, /path, SSE, and the required operations', async function () {
		if (realVersion !== SUPPORTED_OPENCODE_VERSION) {
			this.skip();
			return;
		}

		const server = await startRealServer();
		const client = new OpenCodeHttpClient({ requestTimeoutMs: 60_000, startupTimeoutMs: 60_000, healthCheckIntervalMs: 0 });
		const events: OpenCodeEvent[] = [];
		client.onEvent(event => events.push(event));
		const handle: OwnedProcessHandle = {
			owner: 'unigma-agent-runtime',
			id: 'real-e2e',
			pid: server.child.pid ?? 0,
			endpoint: server.endpoint,
			workspaceUri: pathToFileURL(server.workspace).toString(),
		};

		try {
			assert.strictEqual(server.announcedEndpoint, server.endpoint, 'the server must bind the port the runtime owns');

			// `connect` asserts health/version, the OpenAPI 3.1 profile, `/path`, and `server.connected`.
			await client.connect(handle);
			assert.strictEqual(events[0]?.type, 'server.connected');

			const created = await client.send({ method: 'POST', path: '/session', body: {} });
			assert.ok(created && typeof created === 'object' && typeof (created as { id?: unknown }).id === 'string');
			const sessionId = encodeURIComponent((created as { id: string }).id);

			assert.ok(Array.isArray(await client.send({ method: 'GET', path: '/session' })));
			assert.ok(await client.send({ method: 'GET', path: '/session/status' }) !== undefined);
			assert.ok(await client.send({ method: 'GET', path: `/session/${sessionId}` }) !== undefined);
			assert.ok(Array.isArray(await client.send({ method: 'GET', path: `/session/${sessionId}/message` })));
			assert.ok(Array.isArray(await client.send({ method: 'GET', path: `/session/${sessionId}/diff` })));

			// No provider or model is configured, so only the empty envelope is sent.
			await client.send({ method: 'POST', path: `/session/${sessionId}/prompt_async`, body: { parts: [] } });
			await client.send({ method: 'POST', path: `/session/${sessionId}/abort`, body: {} });

			// Discovery only; nothing here is promoted to a supported provider or model.
			assert.ok(await client.send({ method: 'GET', path: '/config/providers' }) !== undefined);
			assert.ok(await client.send({ method: 'GET', path: '/provider' }) !== undefined);

			await assert.rejects(client.send({ method: 'GET', path: '/tui/control' }), /outside the MVP profile/);
		} finally {
			await client.disconnect();
			await stopRealServer(server);
		}
	});
});
