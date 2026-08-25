/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { ChildProcessManager, type ProcessManagerOptions } from '../infrastructure/processManager';

const workspacePath = process.platform === 'win32' ? 'C:\\unigma-workspace' : '/tmp/unigma-workspace';
const workspace = { uri: pathToFileURL(workspacePath).toString() };
const otherWorkspace = {
	uri: pathToFileURL(process.platform === 'win32' ? 'C:\\other-workspace' : '/tmp/other-workspace').toString(),
};

class FakeProcess extends EventEmitter {
	public readonly pid: number | undefined;
	private readonly autoExitOnKill: boolean;
	public exitCode: number | null = null;
	public killed = false;
	public killCount = 0;

	public constructor(pid = 1001, autoExitOnKill = true) {
		super();
		this.pid = pid;
		this.autoExitOnKill = autoExitOnKill;
	}

	public kill(): boolean {
		this.killCount++;
		this.killed = true;
		if (this.autoExitOnKill) {
			this.exitCode = 0;
			queueMicrotask(() => this.emit('exit', 0, null));
		}
		return true;
	}
}

function optionsFor(spawn: NonNullable<ProcessManagerOptions['spawn']>, startupTimeoutMs = 100): ProcessManagerOptions {
	return {
		port: 43123,
		spawn,
		startupTimeoutMs,
	};
}

suite('Unigma agent process manager', () => {
	test('starts one owned process for concurrent calls and reuses it', async () => {
		const children: FakeProcess[] = [];
		const manager = new ChildProcessManager(optionsFor((command, args, spawnOptions) => {
			assert.strictEqual(command, 'opencode');
			assert.deepStrictEqual(args, ['serve', '--hostname', '127.0.0.1', '--port', '43123']);
			assert.strictEqual(spawnOptions.shell, false);
			assert.strictEqual(spawnOptions.cwd, workspacePath);
			const child = new FakeProcess();
			children.push(child);
			queueMicrotask(() => child.emit('spawn'));
			return child as unknown as ReturnType<NonNullable<ProcessManagerOptions['spawn']>>;
		}));

		const [first, second] = await Promise.all([
			manager.ensureStarted(workspace),
			manager.ensureStarted(workspace),
		]);

		assert.strictEqual(first.id, second.id);
		assert.strictEqual(children.length, 1);
		assert.strictEqual((await manager.ensureStarted(workspace)).id, first.id);
		await manager.stopOwned();
		assert.strictEqual(children[0].killCount, 1);
	});

	test('rejects a concurrent request for a different workspace', async () => {
		let releaseSpawn: (() => void) | undefined;
		const spawnReady = new Promise<void>(resolve => releaseSpawn = resolve);
		const child = new FakeProcess();
		const manager = new ChildProcessManager(optionsFor(() => {
			void spawnReady.then(() => child.emit('spawn'));
			return child as unknown as ReturnType<NonNullable<ProcessManagerOptions['spawn']>>;
		}));

		const first = manager.ensureStarted(workspace);
		const second = manager.ensureStarted(otherWorkspace);
		releaseSpawn?.();

		await first;
		await assert.rejects(second, /different workspace/);
		await manager.stopOwned();
	});

	test('stopping during port reservation prevents an orphan process', async () => {
		let releasePort: ((port: number) => void) | undefined;
		const reservedPort = new Promise<number>(resolve => releasePort = resolve);
		const child = new FakeProcess();
		const manager = new ChildProcessManager({
			reservePort: () => reservedPort,
			spawn: () => {
				queueMicrotask(() => child.emit('spawn'));
				return child as unknown as ReturnType<NonNullable<ProcessManagerOptions['spawn']>>;
			},
		});

		const start = manager.ensureStarted(workspace);
		const stop = manager.stopOwned();
		releasePort?.(43124);

		await assert.rejects(start, /cancelled/);
		await stop;
		assert.strictEqual(child.killCount, 1);
	});

	test('kills a child when startup times out', async () => {
		const child = new FakeProcess();
		const manager = new ChildProcessManager(optionsFor(() => child as unknown as ReturnType<NonNullable<ProcessManagerOptions['spawn']>>, 5));

		await assert.rejects(manager.ensureStarted(workspace), /did not start before the timeout/);
		assert.strictEqual(child.killCount, 1);
	});

	test('does not start another child while a timed-out child is still alive', async () => {
		const first = new FakeProcess(1001, false);
		const second = new FakeProcess(1002);
		let spawnCount = 0;
		const manager = new ChildProcessManager(optionsFor(() => {
			spawnCount++;
			const child = spawnCount === 1 ? first : second;
			if (child === second) {
				queueMicrotask(() => child.emit('spawn'));
			}
			return child as unknown as ReturnType<NonNullable<ProcessManagerOptions['spawn']>>;
		}, 5));

		await assert.rejects(manager.ensureStarted(workspace), /did not start before the timeout/);
		await assert.rejects(manager.ensureStarted(workspace), /did not exit/);
		assert.strictEqual(spawnCount, 1);

		first.exitCode = 0;
		first.emit('exit', 0, null);
		await manager.ensureStarted(workspace);
		assert.strictEqual(spawnCount, 2);
		await manager.stopOwned();
	});
});
