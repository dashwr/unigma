/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { ProcessManager } from '../application/runtimePorts';
import type { OwnedProcessHandle, WorkspaceReference } from '../domain/runtime';

interface SpawnedProcess {
	readonly pid?: number;
	readonly exitCode: number | null;
	readonly killed?: boolean;
	once(event: 'spawn', listener: () => void): this;
	once(event: 'error', listener: (error: Error) => void): this;
	once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	kill(): boolean;
}

type SpawnProcess = (command: string, args: string[], options: SpawnOptions) => SpawnedProcess;

export interface ProcessManagerOptions {
	readonly command?: string;
	readonly port?: number;
	readonly startupTimeoutMs?: number;
	readonly maxRestarts?: number;
	readonly restartBackoffMs?: number;
	readonly spawn?: SpawnProcess;
	readonly reservePort?: () => Promise<number>;
}

const PROCESS_OWNER = 'unigma-agent-runtime' as const;
const DEFAULT_STARTUP_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESTARTS = 1;
const RESTART_BACKOFF_MS = 1_000;

function workspacePath(workspace: WorkspaceReference): string {
	let parsed: URL;
	try {
		parsed = new URL(workspace.uri);
	} catch {
		throw new Error('Workspace reference is not a valid URI.');
	}

	if (parsed.protocol !== 'file:') {
		throw new Error('Only file workspace references are supported by the local runtime.');
	}

	return path.resolve(fileURLToPath(parsed));
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

			server.close(error => {
				if (error) {
					reject(error);
				} else {
					resolve(address.port);
				}
			});
		});
	});
}

/** Starts and owns at most one `opencode serve` child for this extension host. */
export class ChildProcessManager implements ProcessManager {
	private readonly command: string;
	private readonly startupTimeoutMs: number;
	private readonly maxRestarts: number;
	private readonly restartBackoffMs: number;
	private readonly spawn: SpawnProcess;
	private readonly reservePort: () => Promise<number>;
	private readonly fixedPort: number | undefined;
	private child: SpawnedProcess | undefined;
	private handle: OwnedProcessHandle | undefined;
	private startPromise: Promise<OwnedProcessHandle> | undefined;
	private stopPromise: Promise<void> | undefined;
	private stopRequested = false;
	private stopFailed = false;
	private restartCount = 0;
	private restartTimer: NodeJS.Timeout | undefined;
	private currentWorkspace: WorkspaceReference | undefined;

	public constructor(options: ProcessManagerOptions = {}) {
		this.command = options.command ?? 'opencode';
		this.fixedPort = options.port;
		this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
		this.maxRestarts = options.maxRestarts ?? DEFAULT_MAX_RESTARTS;
		this.restartBackoffMs = options.restartBackoffMs ?? RESTART_BACKOFF_MS;
		this.spawn = options.spawn ?? (nodeSpawn as unknown as SpawnProcess);
		this.reservePort = options.reservePort ?? reserveLoopbackPort;
	}

	public async ensureStarted(workspace: WorkspaceReference): Promise<OwnedProcessHandle> {
		if (this.stopPromise) {
			await this.stopPromise;
			return this.ensureStarted(workspace);
		}

		if (this.stopFailed) {
			throw new Error('The owned OpenCode process did not exit after stop; refusing to start another process.');
		}

		if (this.handle && this.child && this.child.exitCode === null) {
			this.assertWorkspace(workspace, this.handle);
			return this.handle;
		}

		if (this.startPromise) {
			const handle = await this.startPromise;
			this.assertWorkspace(workspace, handle);
			return handle;
		}

		this.currentWorkspace = workspace;
		const startPromise = this.start(workspace);
		this.startPromise = startPromise;
		try {
			const handle = await startPromise;
			if (this.stopRequested) {
				await this.stopPromise;
				throw new Error('OpenCode startup was cancelled.');
			}
			this.restartCount = 0;
			return handle;
		} finally {
			if (this.startPromise === startPromise) {
				this.startPromise = undefined;
			}
		}
	}

	public stopOwned(): Promise<void> {
		if (this.stopPromise) {
			return this.stopPromise;
		}

		this.stopRequested = true;
		this.restartCount = 0;
		this.currentWorkspace = undefined;
		if (this.restartTimer) {
			clearTimeout(this.restartTimer);
			this.restartTimer = undefined;
		}
		const pendingStart = this.startPromise;
		this.stopPromise = (async () => {
			if (pendingStart) {
				try {
					await pendingStart;
				} catch {
					// The startup failure already performed its own cleanup.
				}
			}

			const child = this.child;
			const handle = this.handle;
			if (!child || !handle || handle.owner !== PROCESS_OWNER) {
				return;
			}

			if (child.exitCode !== null) {
				this.clearIfOwned(child, handle);
				return;
			}

			const exited = await new Promise<boolean>(resolve => {
				let settled = false;
				const finish = (value: boolean) => {
					if (settled) {
						return;
					}
					settled = true;
					if (timeout) {
						clearTimeout(timeout);
					}
					resolve(value);
				};
				const timeout = setTimeout(() => finish(false), this.startupTimeoutMs);
				child.once('exit', () => finish(true));
				if (!child.killed) {
					child.kill();
				}
			});

			if (!exited && child.exitCode === null) {
				this.stopFailed = true;
				return;
			}

			this.clearIfOwned(child, handle);
			/*
			 * `exit` may have happened before the listener above was attached.
			 * Keep the ownership fields consistent before allowing a new start.
			 */
			if (child.exitCode !== null) {
				this.clearIfOwned(child, handle);
			}
		})().finally(() => {
			this.stopRequested = false;
			this.stopPromise = undefined;
		});

		return this.stopPromise;
	}

	private async start(workspace: WorkspaceReference): Promise<OwnedProcessHandle> {
		const cwd = workspacePath(workspace);
		const port = this.fixedPort ?? await this.reservePort();
		const child = this.spawn(this.command, ['serve', '--hostname', '127.0.0.1', '--port', String(port)], {
			cwd,
			shell: false,
			stdio: 'ignore',
		});
		const pid = child.pid;
		if (!pid || pid <= 0) {
			if (!child.killed) {
				child.kill();
			}
			throw new Error('OpenCode process did not expose a PID.');
		}

		const handle: OwnedProcessHandle = {
			owner: PROCESS_OWNER,
			id: randomUUID(),
			pid,
			endpoint: `http://127.0.0.1:${port}`,
			workspaceUri: workspace.uri,
		};

		this.child = child;
		this.handle = handle;
		child.once('exit', () => this.clearIfOwned(child, handle));

		return new Promise<OwnedProcessHandle>((resolve, reject) => {
			let settled = false;
			const timeout = setTimeout(() => {
				if (settled) {
					return;
				}

				settled = true;
				this.stopFailed = true;
				if (!child.killed) {
					child.kill();
				}
				reject(new Error('OpenCode process did not start before the timeout.'));
			}, this.startupTimeoutMs);

			child.once('spawn', () => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timeout);
				resolve(handle);
			});
			child.once('error', error => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timeout);
				this.clearIfOwned(child, handle);
				reject(new Error(`Could not start OpenCode process: ${error.message}`));
			});
			child.once('exit', (code, signal) => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timeout);
				this.clearIfOwned(child, handle);
				reject(new Error(`OpenCode process exited before startup (code=${code ?? 'none'}, signal=${signal ?? 'none'}).`));
			});
		});
	}

	private assertWorkspace(workspace: WorkspaceReference, handle: OwnedProcessHandle): void {
		if (workspace.uri !== handle.workspaceUri) {
			throw new Error('The owned OpenCode process belongs to a different workspace.');
		}
	}

	private clearIfOwned(child: SpawnedProcess, handle: OwnedProcessHandle): void {
		if (this.child === child && this.handle?.id === handle.id && handle.owner === PROCESS_OWNER) {
			this.child = undefined;
			this.handle = undefined;
			this.stopFailed = false;
			if (!this.stopRequested && this.restartCount < this.maxRestarts && this.currentWorkspace) {
				this.scheduleRestart(this.currentWorkspace);
			}
		}
	}

	private scheduleRestart(workspace: WorkspaceReference): void {
		this.restartCount++;
		const delay = this.restartBackoffMs * this.restartCount;
		this.restartTimer = setTimeout(() => {
			this.restartTimer = undefined;
			void this.attemptRestart(workspace);
		}, delay);
	}

	private async attemptRestart(workspace: WorkspaceReference): Promise<void> {
		if (this.stopRequested || this.startPromise) {
			return;
		}

		const startPromise = this.start(workspace);
		this.startPromise = startPromise;
		try {
			await startPromise;
			if (this.stopRequested) {
				try {
					await this.stopOwned();
				} catch {
					// stopOwned handles its own cleanup.
				}
				return;
			}
		} catch {
			if (!this.stopRequested && this.restartCount < this.maxRestarts && this.currentWorkspace) {
				this.scheduleRestart(workspace);
			}
		} finally {
			if (this.startPromise === startPromise) {
				this.startPromise = undefined;
			}
		}
	}
}
