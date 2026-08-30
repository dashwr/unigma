/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPathInScope, readExcludedExtensions, resolveScope } from './audit-notices.ts';

assert.equal(resolveScope(undefined), 'all');
assert.equal(resolveScope('all'), 'all');
assert.equal(resolveScope('root'), 'root');
assert.equal(resolveScope('cli'), 'cli');
assert.throws(() => resolveScope('other'), /Invalid --scope/);

assert.equal(isPathInScope('package.json', 'all'), true);
assert.equal(isPathInScope('cli/package.json', 'all'), true);
assert.equal(isPathInScope('cli\\package.json', 'root'), false);
assert.equal(isPathInScope('package.json', 'root'), true);
assert.equal(isPathInScope('cli/package.json', 'cli'), true);
assert.equal(isPathInScope('cli\\nested\\package-lock.json', 'cli'), true);
assert.equal(isPathInScope('extensions/foo/package.json', 'cli'), false);

// root scope also drops manifests that never reach the distributed product
const excluded = ['copilot', 'vscode-api-tests'];
assert.equal(isPathInScope('build/package.json', 'root', excluded), false);
assert.equal(isPathInScope('build/lib/package-lock.json', 'root', excluded), false);
// ...except inno_updater, which ships inside the Windows installer
assert.equal(isPathInScope('build/win32/Cargo.lock', 'root', excluded), true);
assert.equal(isPathInScope('test/smoke/package.json', 'root', excluded), false);
assert.equal(isPathInScope('.vscode/extensions/package.json', 'root', excluded), false);
assert.equal(isPathInScope('src/vs/base/test/common/package.json', 'root', excluded), false);
assert.equal(isPathInScope('src/vs/base/common/cgmanifest.json', 'root', excluded), true);
assert.equal(isPathInScope('extensions/copilot/package.json', 'root', excluded), false);
assert.equal(isPathInScope('extensions/vscode-api-tests/package.json', 'root', excluded), false);
assert.equal(isPathInScope('extensions/git/package.json', 'root', excluded), true);
// unknown exclusion list => historical (broader) behaviour
assert.equal(isPathInScope('extensions/copilot/package.json', 'root'), true);
// the distribution filter never applies to all/cli
assert.equal(isPathInScope('build/package.json', 'all', excluded), true);
assert.equal(isPathInScope('cli/Cargo.lock', 'cli', excluded), true);

// the exclusion list is read from build/lib/extensions.ts, not duplicated here
const excludedFromSource = readExcludedExtensions(process.cwd());
assert.ok(excludedFromSource.includes('copilot'), 'expected copilot in excludedExtensions');
assert.ok(excludedFromSource.includes('vscode-api-tests'), 'expected vscode-api-tests in excludedExtensions');
assert.deepEqual(readExcludedExtensions(os.tmpdir()), []);

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-notices-scope-'));
try {
	fs.mkdirSync(path.join(fixture, 'cli', 'nested'), { recursive: true });
	fs.mkdirSync(path.join(fixture, 'build', 'win32'), { recursive: true });
	fs.writeFileSync(path.join(fixture, 'ThirdPartyNotices.txt'), '');
	fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ dependencies: { rootOnly: '1.0.0' } }));
	fs.writeFileSync(path.join(fixture, 'build', 'package.json'), JSON.stringify({ dependencies: { buildOnly: '1.0.0' } }));
	fs.writeFileSync(path.join(fixture, 'build', 'win32', 'Cargo.lock'), `[[package]]
name = "inno-updater-crate"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
`);
	fs.writeFileSync(path.join(fixture, 'cli', 'package.json'), JSON.stringify({ dependencies: { cliOnly: '1.0.0' } }));
	fs.writeFileSync(path.join(fixture, 'cli', 'Cargo.lock'), `[[package]]
name = "code-cli"
version = "0.1.0"

[[package]]
name = "third-party-crate"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
`);
	const script = path.resolve('build/azure-pipelines/oss/audit-notices.ts');
	const run = (...args: string[]): string => {
		try {
			return execFileSync(process.execPath, ['--experimental-strip-types', script, '--notice', 'ThirdPartyNotices.txt', '--repo', fixture, ...args], { encoding: 'utf8' });
		} catch (error) {
			return (error as { stdout?: string }).stdout ?? '';
		}
	};
	assert.match(run('--scope', 'root'), /Manifest scope: root/);
	assert.match(run('--scope', 'root'), /Found 1 package\.json files/);
	assert.doesNotMatch(run('--scope', 'root'), /buildonly/i);
	// build/win32/Cargo.lock still ships (inno_updater) and must stay in scope
	assert.match(run('--scope', 'root'), /Found 1 Cargo\.lock files/);
	assert.match(run('--scope', 'root'), /inno-updater-crate/);
	assert.match(run('--scope', 'cli'), /Manifest scope: cli/);
	assert.match(run('--scope', 'cli'), /Found 1 package\.json files/);
	assert.doesNotMatch(run('--scope', 'cli'), /code-cli/);
	assert.match(run('--scope', 'cli'), /third-party-crate/);
	assert.match(run(), /Manifest scope: all/);
	assert.match(run(), /Found 3 package\.json files/);

	const invalid = execFileSync(process.execPath, ['--experimental-strip-types', script, '--notice', 'ThirdPartyNotices.txt', '--repo', fixture, '--scope', 'bad'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	void invalid;
} catch (error) {
	const result = error as { status?: number; stderr?: Buffer };
	assert.equal(result.status, 1);
	assert.match(result.stderr?.toString() ?? '', /Invalid --scope 'bad'/);
}
fs.rmSync(fixture, { recursive: true, force: true });

console.log('audit-notices scope checks: passed');
