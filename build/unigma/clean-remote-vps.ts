/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { accessSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { RemoteSshProcess, createRemoteSshProcessRunner as CreateRemoteSshProcessRunner, openRemoteControlMaster as OpenRemoteControlMaster } from '../../extensions/unigma-remote-ssh/out/remoteServerTransport.js';
import type { BootstrapManifest } from '../../extensions/unigma-remote-ssh/out/bootstrapManifest.js';
import type { buildRemoteStagingCleanupArguments as BuildCleanupArguments, buildRemoteStagingScriptDeliveryArguments as BuildDeliveryArguments } from '../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js';
import type { buildRemoteStagingScript as BuildStagingScript } from '../../extensions/unigma-remote-ssh/out/remoteStagingScript.js';

const require = createRequire(import.meta.url);
const transport = require('../../extensions/unigma-remote-ssh/out/remoteServerTransport.js') as { createRemoteSshProcessRunner: typeof CreateRemoteSshProcessRunner; openRemoteControlMaster: typeof OpenRemoteControlMaster };
const stagingTransfer = require('../../extensions/unigma-remote-ssh/out/remoteStagingTransfer.js') as { buildRemoteStagingCleanupArguments: typeof BuildCleanupArguments; buildRemoteStagingScriptDeliveryArguments: typeof BuildDeliveryArguments };
const stagingScript = require('../../extensions/unigma-remote-ssh/out/remoteStagingScript.js') as { buildRemoteStagingScript: typeof BuildStagingScript };
const { createRemoteSshProcessRunner, openRemoteControlMaster } = transport;
const { buildRemoteStagingCleanupArguments, buildRemoteStagingScriptDeliveryArguments } = stagingTransfer;
const { buildRemoteStagingScript } = stagingScript;

const COMMIT = /^[0-9a-f]{40}$/;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = resolve(process.argv[2] ?? join(repoRoot, '.build', 'unigma-remote-vps-cleanup.txt'));
const checks: Array<readonly [string, string]> = [];

function report(name: string, value: string): void {
	checks.push([name, value.replace(/[\r\n=]/g, '_')]);
}

function writeReport(status: 'pass' | 'fail'): void {
	const output = [...checks.map(([name, value]) => `${name}=${value}`), `cleanup=${status}`].join('\n') + '\n';
	try {
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, output, { mode: 0o600 });
	} catch {
		// Stdout remains the workflow's fallback when the requested report path fails.
	}
	process.stdout.write(output);
}

function executable(name: string): string | undefined {
	for (const directory of (process.env.PATH ?? '').split(':').filter(Boolean)) {
		const candidate = join(directory, name);
		try {
			accessSync(candidate, 1);
			return candidate;
		} catch {
			// Candidate paths are not diagnostics.
		}
	}
	return undefined;
}

function cleanupManifest(commit: string): BootstrapManifest {
	// The generated script validates a complete payload manifest before emitting
	// any script. Cleanup branches before consuming these files, so this minimal
	// valid shape lets maintenance reuse that generator without a second script.
	return {
		schemaVersion: 1,
		product: 'unigma',
		clientCommit: commit,
		serverCommit: commit,
		target: { os: 'linux', arch: 'x64' },
		totalSizeBytes: 2,
		files: [
			{ id: 'unigma-server', relativePath: 'server/unigma-server.tar.gz', sizeBytes: 1, sha256: '0'.repeat(64) },
			{ id: 'unigma+opencode', relativePath: 'bin/opencode', sizeBytes: 1, sha256: '0'.repeat(64) }
		]
	};
}

interface CommandResult {
	readonly code: number | null;
	readonly output: string;
}

function runCommand(runner: (arguments_: readonly string[]) => RemoteSshProcess, arguments_: readonly string[], input = ''): Promise<CommandResult> {
	const process_ = runner(arguments_);
	const output: Buffer[] = [];
	process_.stdout.on('data', chunk => output.push(Buffer.from(chunk as Uint8Array)));
	return new Promise(resolveCommand => {
		let settled = false;
		const finish = (code: number | null): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			resolveCommand({ code, output: Buffer.concat(output).toString('utf8') });
		};
		const timer = setTimeout(() => {
			try {
				process_.kill('SIGTERM');
			} catch {
				// The close event remains authoritative.
			}
			finish(null);
		}, 30_000);
		process_.on('error', () => finish(null));
		process_.on('close', code => finish(code));
		try {
			process_.stdin.end(input);
		} catch {
			finish(null);
		}
	});
}

function presenceArguments(cleanupArguments: readonly string[], commit: string): readonly string[] {
	const commandIndex = cleanupArguments.indexOf('/bin/sh', cleanupArguments.indexOf('--') + 1);
	// This query deliberately derives its SSH prefix from the guarded cleanup
	// invocation. It only reads the post-condition; removal remains in safe_rm.
	//
	// OpenSSH joins argv into one string that the remote shell parses again, so
	// an unquoted script is re-split there and the remainder becomes a syntax
	// error rather than a query. The delivery builder quotes its command for the
	// same reason; the commit is validated hexadecimal before it reaches here.
	return [
		...cleanupArguments.slice(0, commandIndex),
		'/bin/sh',
		'-c',
		`'if [ -d "$HOME/.unigma-server/bin/${commit}" ]; then printf "present\\n"; else printf "absent\\n"; fi'`
	];
}

async function main(): Promise<boolean> {
	const destination = process.env['UNIGMA_VPS_ALIAS'];
	if (typeof destination !== 'string' || destination.length === 0) {
		process.stderr.write('UNIGMA_VPS_ALIAS is required\n');
		report('error', 'UNIGMA_VPS_ALIAS-required');
		return false;
	}
	report('alias', destination);

	const commit = process.env['UNIGMA_VPS_COMMIT'];
	if (typeof commit !== 'string' || !COMMIT.test(commit)) {
		process.stderr.write('UNIGMA_VPS_COMMIT must be a 40-character hexadecimal commit\n');
		report('error', 'UNIGMA_VPS_COMMIT-invalid');
		return false;
	}
	report('commit', commit);
	if (executable('ssh') === undefined) {
		report('error', 'ssh-unavailable');
		return false;
	}

	const runner = createRemoteSshProcessRunner();
	const generated = buildRemoteStagingScript({ commit, manifest: cleanupManifest(commit), retention: 1 });
	if (!generated.valid) {
		report('error', `script-${generated.code}`);
		return false;
	}
	const opened = await openRemoteControlMaster({ destination, timeoutMs: 30_000 }, { allocateLocalPort: () => 49152, spawn: runner });
	if ((opened as { readonly ok?: boolean }).ok === false) {
		report('session.status', (opened as { readonly code?: string }).code ?? 'failed');
		return false;
	}
	const session = opened as { readonly controlPath: string; dispose(): Promise<void> };

	let passed = false;
	try {
		const sessionCleanupArguments = buildRemoteStagingCleanupArguments({ destination, controlPath: session.controlPath, commit });
		const before = await runCommand(runner, presenceArguments(sessionCleanupArguments, commit));
		const beforeStatus = before.code === 0 ? before.output.trim() : 'query-failed';
		report('before.exit', String(before.code));
		report('before.status', beforeStatus === 'present' || beforeStatus === 'absent' ? beforeStatus : 'query-failed');
		if (beforeStatus === 'query-failed') {
			return false;
		}
		const delivery = await runCommand(runner, buildRemoteStagingScriptDeliveryArguments({ destination, controlPath: session.controlPath, commit }), generated.script);
		report('delivery.exit', String(delivery.code));
		const cleanup = await runCommand(runner, sessionCleanupArguments);
		const hostStatus = /"status":"([a-z-]+)"/.exec(cleanup.output)?.[1] ?? 'none';
		report('cleanup.exit', String(cleanup.code));
		report('cleanup.host-status', hostStatus);
		const after = await runCommand(runner, presenceArguments(sessionCleanupArguments, commit));
		const afterStatus = after.code === 0 ? after.output.trim() : 'query-failed';
		report('after.exit', String(after.code));
		report('after.status', afterStatus === 'present' || afterStatus === 'absent' ? afterStatus : 'query-failed');
		const absentAfter = afterStatus === 'absent';
		report('result', beforeStatus === 'absent' ? 'already-absent' : 'removed');
		passed = delivery.code === 0 && cleanup.code === 0 && hostStatus === 'cleanup-complete' && absentAfter;
		return passed;
	} finally {
		await session.dispose().catch(() => undefined);
	}
}

try {
	const passed = await main();
	writeReport(passed ? 'pass' : 'fail');
	if (!passed) {
		process.exitCode = 1;
	}
} catch {
	report('error', 'unexpected-error');
	writeReport('fail');
	process.exitCode = 1;
}
