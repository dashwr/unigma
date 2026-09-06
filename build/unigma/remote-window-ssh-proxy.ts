/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Test-only executable placed on PATH for one isolated desktop. Never records
// arguments, environment, SSH output or PIDs. Signals only its own child object.
import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const directory = process.env['UNIGMA_RECONNECT_CONTROL'];
if (!directory) {
	process.exit(2);
}
const args = process.argv.slice(2);
let owned = false;
if (args.includes('-M')) {
	try {
		writeFileSync(join(directory, 'claimed'), '', { flag: 'wx', mode: 0o600 });
		owned = true;
	} catch {
		// Later ControlMasters must remain alive for recovery.
	}
}
const active = join(directory, `active-${randomUUID()}`);
writeFileSync(active, '', { flag: 'wx', mode: 0o600 });
const parent = process.ppid;
const child = spawn('/usr/bin/ssh', args, { stdio: 'inherit' });
let injected = false;
let stoppingAt = 0;
function stop() {
	if (!stoppingAt) {
		stoppingAt = Date.now();
		child.kill('SIGTERM');
	}
}
const timer = setInterval(() => {
	if (owned && !injected && existsSync(join(directory, 'drop'))) {
		injected = child.kill('SIGTERM');
		if (injected) { stoppingAt = Date.now(); }
	}
	if (process.ppid !== parent || existsSync(join(directory, 'stop'))) { stop(); }
	if (stoppingAt && Date.now() - stoppingAt > 2_000) { child.kill('SIGKILL'); }
}, 100);
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
	process.on(signal, stop);
}
child.once('error', () => {
	clearInterval(timer);
	process.exitCode = 1;
});
child.once('close', code => {
	clearInterval(timer);
	unlinkSync(active);
	if (injected) {
		writeFileSync(join(directory, 'dropped'), '', { mode: 0o600 });
	}
	process.exitCode = code ?? 1;
});
