/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Smoke-only driver for build/unigma/smoke-remote-agent-session.ts.
 *
 * There is no public way to start an agent session: the only production path is
 * the button in the native view, and `unigma.agent.runtime.transport.send` is
 * hidden with `when: false`. A session in a *remote* extension host therefore
 * cannot be provoked from outside at all, which is why the recorte had no
 * harness.
 *
 * This extension is that provocation and nothing else. It declares
 * `extensionKind: ["workspace"]` so a remote window hosts it on the remote side,
 * beside the runtime it drives, and it is loaded with
 * `--extensionDevelopmentPath` rather than installed, so nothing it needs
 * outlives the run.
 *
 * It asserts the *effect*, not the events. Events reach the workbench through
 * `unigma.agent.runtime.transport.event`, which is registered on the workbench
 * side and cannot be observed from here, and the runtime's diagnostics go to an
 * OutputChannel that never reaches disk. What can be observed is what `T-054`
 * actually asks for: after a session starts, `opencode serve` runs *on this
 * host* and its loopback answers. If it does not, the session did not happen,
 * whatever an event might have said.
 */

import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type * as vscodeApi from 'vscode';

// Resolved at runtime: the driver is loaded by the extension host, never bundled.
const vscode = require('vscode') as typeof vscodeApi;

/*
 * A fixed name under the host's own home, because the remote extension host does
 * not inherit the desktop's environment: there is no way to hand it a path on
 * the command line. The bench owns that home and removes the file before the
 * run, so a stale report cannot be mistaken for this one.
 */
const REPORT_NAME = 'unigma-agent-session-report.txt';
const TRANSPORT_COMMAND = 'unigma.agent.runtime.transport.send';
const AGENT_PROTOCOL_VERSION = 2;
const DEADLINE_MS = 90_000;
const POLL_MS = 500;

/** Every value is a fact about this host, and none carries a path or a secret. */
const facts = new Map<string, string>();

function record(key: string, value: unknown): void {
	facts.set(key, String(value).slice(0, 160));
}

function writeReport(): void {
	const target = join(homedir(), REPORT_NAME);
	const lines = [...facts].map(([key, value]) => `${key}=${value}`);
	try {
		writeFileSync(target, `${lines.join('\n')}\n`, { mode: 0o600 });
	} catch {
		// The smoke times out and says so; there is nowhere better to put this.
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/** Asks this host whether an OpenCode is running on it. */
function opencodeProcesses(): Promise<number | undefined> {
	return new Promise(resolve => {
		execFile('/bin/ps', ['-eo', 'pid,args'], { timeout: 10_000 }, (error, stdout) => {
			if (error) {
				resolve(undefined);
				return;
			}
			resolve(stdout.split('\n').filter(line => / opencode( |$)/.test(line) && line.includes('serve')).length);
		});
	});
}

/** The loopback of *this* host: a desktop-side port would not answer here. */
function healthy(port: number): Promise<boolean> {
	return new Promise(resolve => {
		const request = httpGet({ host: '127.0.0.1', port, path: '/global/health', timeout: 4_000 }, response => {
			response.resume();
			resolve(response.statusCode === 200);
		});
		request.on('timeout', () => { request.destroy(); resolve(false); });
		request.on('error', () => resolve(false));
	});
}

function listeningPorts(): Promise<number[]> {
	return new Promise(resolve => {
		execFile('/bin/sh', ['-c', 'ss -ltnp 2>/dev/null | grep -i opencode || true'], { timeout: 10_000 }, (error, stdout) => {
			if (error) {
				resolve([]);
				return;
			}
			const ports: number[] = [];
			for (const line of stdout.split('\n')) {
				const match = /127\.0\.0\.1:(\d{2,5})/.exec(line);
				if (match) {
					ports.push(Number(match[1]));
				}
			}
			resolve(ports);
		});
	});
}

async function findListeningOpenCode(): Promise<number | undefined> {
	for (const port of await listeningPorts()) {
		if (await healthy(port)) {
			return port;
		}
	}
	return undefined;
}

export async function activate(): Promise<void> {
	record('driver', 'activated');
	record('remote.name', vscode.env.remoteName ?? 'none');
	record('remote.authority.kind', typeof vscode.env.remoteAuthority === 'string' && vscode.env.remoteAuthority.startsWith('ssh-remote+') ? 'ssh-remote' : 'other');
	const folder = vscode.workspace.workspaceFolders?.[0];
	record('workspace.scheme', folder?.uri.scheme ?? 'none');

	// The driver must be hosted remotely, or it proves something about the
	// desktop and calls it remote.
	if (vscode.env.remoteName !== 'ssh-remote' || !folder || folder.uri.scheme !== 'vscode-remote') {
		record('driver', 'wrong-host');
		writeReport();
		return;
	}

	record('opencode.before', (await opencodeProcesses()) ?? 'unknown');

	try {
		await vscode.commands.executeCommand(TRANSPORT_COMMAND, {
			version: AGENT_PROTOCOL_VERSION,
			requestId: 'smoke-1',
			type: 'startSession',
			workspaceUri: folder.uri.toString(),
			localIntegrationPreflight: { accepted: true },
		});
		record('start.sent', 'true');
	} catch (error) {
		// The bridge answers void; a rejection here is the command being absent,
		// which is itself the answer.
		record('start.sent', 'false');
		record('start.failure', (error as Error | undefined)?.name ?? 'unknown');
		writeReport();
		return;
	}

	const deadline = Date.now() + DEADLINE_MS;
	let port: number | undefined;
	while (Date.now() < deadline && port === undefined) {
		port = await findListeningOpenCode();
		if (port === undefined) {
			await sleep(POLL_MS);
		}
	}

	record('opencode.after', (await opencodeProcesses()) ?? 'unknown');
	record('opencode.listening', port === undefined ? 'false' : 'true');
	record('driver', 'complete');
	writeReport();
}

export function deactivate(): void {
	writeReport();
}
