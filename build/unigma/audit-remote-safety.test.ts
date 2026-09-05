/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { test } from 'node:test';

const script = resolve(import.meta.dirname, 'audit-remote-safety.ts');
const repositoryRoot = resolve(import.meta.dirname, '..', '..');

function audit(root: string): { readonly status: number; readonly stdout: string } {
	const result = spawnSync(process.execPath, ['--experimental-strip-types', script, root], { encoding: 'utf8' });
	return { status: result.status ?? -1, stdout: result.stdout };
}

function withTree(files: Record<string, string>, body: (root: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), 'unigma-remote-safety-'));
	try {
		for (const [relativePath, contents] of Object.entries(files)) {
			const target = join(root, relativePath);
			mkdirSync(resolve(target, '..'), { recursive: true });
			writeFileSync(target, contents);
		}
		body(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test('the repository itself satisfies every remote safety rule', () => {
	const { status, stdout } = audit(repositoryRoot);
	assert.match(stdout, /remote-safety=pass/, stdout);
	assert.strictEqual(status, 0);
});

test('an extraction that lets the archive choose ownership is refused', () => {
	withTree({
		'.github/workflows/example.yml': 'run: |\n  tar -xJf "$archive" -C /opt\n'
	}, root => {
		const { status, stdout } = audit(root);
		assert.match(stdout, /failure=tar-ownership .*example\.yml:2 missing --no-same-owner and --no-same-permissions/);
		assert.match(stdout, /remote-safety=fail/);
		assert.strictEqual(status, 1);
	});
});

test('one missing flag is reported by name, not collapsed into the other', () => {
	withTree({
		'.github/workflows/example.yml': 'run: tar --no-same-owner -xf - -C "$build"\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /missing --no-same-permissions/);
		assert.doesNotMatch(stdout, /missing --no-same-owner/);
	});
});

test('an extraction carrying both flags passes', () => {
	withTree({
		'.github/workflows/example.yml': 'run: tar --no-same-owner --no-same-permissions -xJf "$archive" -C /opt\n'
	}, root => {
		const { status, stdout } = audit(root);
		assert.match(stdout, /findings=0/);
		assert.match(stdout, /remote-safety=pass/);
		assert.strictEqual(status, 0);
	});
});

test('creating an archive is not mistaken for extracting one', () => {
	withTree({
		'.github/workflows/example.yml': 'run: tar --owner=0 --group=0 -czf "$out" -C "$dir" .\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /findings=0/, stdout);
	});
});

test('every relaxed form of host key checking is refused', () => {
	for (const relaxed of ['StrictHostKeyChecking=no', 'StrictHostKeyChecking=accept-new', 'StrictHostKeyChecking no']) {
		withTree({
			'.github/workflows/example.yml': `run: ssh -o ${relaxed} "$target" true\n`
		}, root => {
			const { status, stdout } = audit(root);
			assert.match(stdout, /failure=host-key/, `${relaxed} was accepted`);
			assert.strictEqual(status, 1);
		});
	}
});

test('StrictHostKeyChecking=yes is the form that passes', () => {
	withTree({
		'.github/workflows/example.yml': 'run: ssh -o StrictHostKeyChecking=yes "$target" true\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /findings=0/, stdout);
	});
});

test('a download piped into a shell is refused, with or without escalation', () => {
	for (const piped of ['curl -fsSL https://example.invalid/i.sh | sh', 'wget -qO- https://example.invalid/i.sh | sudo bash']) {
		withTree({ '.github/workflows/example.yml': `run: ${piped}\n` }, root => {
			const { stdout } = audit(root);
			assert.match(stdout, /failure=piped-download/, piped);
		});
	}
});

test('a verified download that is not piped passes', () => {
	withTree({
		'.github/workflows/example.yml': 'run: |\n  curl --fail --location "$url" --output "$archive"\n  sha256sum -c expected.sha256\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /findings=0/, stdout);
	});
});

test('escalation is refused in assembled remote shell but not policed in workflows', () => {
	withTree({
		'extensions/unigma-remote-ssh/src/example.ts': 'const script = \'sudo mkdir -p /opt/unigma\';\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /failure=escalation .*example\.ts:1/);
	});

	/*
	 * The runner is a machine the project owns and provisions; the remote host
	 * is not. Applying the same rule to both would either forbid legitimate
	 * runner setup or teach everyone to ignore the finding.
	 */
	withTree({
		'.github/workflows/example.yml': 'run: sudo mkdir -p /opt/node\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /findings=0/, stdout);
	});
});

test('a comment describing a refused form is not a violation', () => {
	withTree({
		'extensions/unigma-remote-ssh/src/example.ts': '// never emit sudo into the remote script\nconst safe = true;\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /findings=0/, stdout);
	});
});

test('test files are not audited, so a fixture may spell the refused form', () => {
	withTree({
		'build/unigma/example.test.ts': 'const hostile = \'tar -xf - -C /\';\n'
	}, root => {
		const { stdout } = audit(root);
		assert.match(stdout, /findings=0/, stdout);
	});
});
