/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveOpenCodeCommand } from '../../extensions/unigma-agent-runtime/src/infrastructure/openCodeResolver.ts';

const packageDirectory = process.argv[2] ? resolve(process.argv[2]) : undefined;
const appDirectory = packageDirectory ? join(packageDirectory, 'resources', 'app') : undefined;
const binary = appDirectory ? join(appDirectory, 'opencode', 'bin', 'opencode') : undefined;
const executable = Boolean(binary && existsSync(binary) && statSync(binary).isFile() && (statSync(binary).mode & 0o111) !== 0);
const versionResult = executable ? spawnSync(binary!, ['--version'], { encoding: 'utf8' }) : undefined;
const version = versionResult?.status === 0 ? versionResult.stdout.trim() : '';
const resolution = executable ? resolveOpenCodeCommand({
	embedded: { command: binary!, exists: true, executable: true },
	path: { command: 'opencode', exists: false, executable: false },
}) : { kind: 'unavailable' as const, code: 'no-executable-candidate' as const };

const checks = [
	['check.opencode.binary', executable],
	['check.opencode.version', version === '1.18.23'],
	['check.opencode.resolution', resolution.kind === 'embedded' && resolution.command === binary],
] as const;
for (const [name, passed] of checks) {
	console.log(`${name}=${passed ? 'pass' : 'fail'}`);
}
console.log(`opencode.version=${version || 'unavailable'}`);
console.log(`opencode.command=${resolution.kind === 'embedded' ? resolution.command : 'unavailable'}`);
if (!checks.every(([, passed]) => passed)) {
	process.exitCode = 1;
}
