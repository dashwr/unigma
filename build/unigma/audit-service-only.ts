/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Audits an OpenCode binary built with the service-only profile.
 *
 * D-023 lists what the profile removes, and a list of removals is only a claim
 * until something asks the binary itself. The audit asks: it runs the surfaces
 * that should be gone and requires each one to be refused.
 *
 * Refusal is the evidence. A build that quietly ignores an unknown flag looks
 * identical, from the outside, to one that still honours it, so a surface is
 * only considered removed when the binary says no.
 */

import { spawnSync } from 'child_process';
import { openSync, closeSync, readSync, statSync, existsSync } from 'fs';

/** Result of running the audited binary once. */
export interface RunResult {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

/** Runs the audited binary with the given arguments. */
export type Runner = (args: readonly string[]) => RunResult;

export interface Finding {
	readonly rule: string;
	readonly detail: string;
}

export interface AuditResult {
	readonly findings: readonly Finding[];
	readonly checked: number;
}

/**
 * Subcommands D-023 removes. `serve` is deliberately absent: it is the one
 * surface the profile exists to keep.
 */
export const REMOVED_COMMANDS = [
	'tui',
	'web',
	'attach',
	'run',
	'upgrade',
	'uninstall',
	'auth',
	'github',
] as const;

/**
 * Options that widen the reachable surface. The hostname case is the one that
 * matters most: a service reachable from the LAN is a different product from a
 * service reachable from loopback, and nothing else in the stack re-checks it.
 */
export const REFUSED_SERVE_OPTIONS = [
	['--hostname', '0.0.0.0'],
	['--hostname', '::'],
	['--mdns'],
	['--cors'],
] as const;

function refused(result: RunResult): boolean {
	// A non-zero status is the refusal. Status null means the process was
	// signalled, which is not an answer, and is reported as a failure below.
	return typeof result.status === 'number' && result.status !== 0;
}

export function auditServiceOnly(run: Runner): AuditResult {
	const findings: Finding[] = [];
	let checked = 0;

	checked++;
	const version = run(['--version']);
	if (version.status !== 0) {
		findings.push({
			rule: 'version',
			detail: `--version answered with status ${String(version.status)}`,
		});
	}

	for (const command of REMOVED_COMMANDS) {
		checked++;
		const result = run([command]);
		if (!refused(result)) {
			findings.push({
				rule: 'removed-command',
				detail: `${command} was accepted with status ${String(result.status)}`,
			});
		}
	}

	for (const option of REFUSED_SERVE_OPTIONS) {
		checked++;
		const result = run(['serve', ...option]);
		if (!refused(result)) {
			findings.push({
				rule: 'refused-option',
				detail: `serve ${option.join(' ')} was accepted with status ${String(result.status)}`,
			});
		}
	}

	return { findings, checked };
}

/**
 * Strings the embedded Web UI leaves in the binary. The profile drops the
 * bundle rather than hiding the route, so their absence is what distinguishes
 * a removed surface from a disabled one.
 */
export const ABSENT_MARKERS = ['opencode-web-ui.gen', 'disableEmbeddedWebUi'] as const;

const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

export function auditBinaryContent(executable: string): readonly Finding[] {
	const findings: Finding[] = [];

	const stats = statSync(executable);
	if (!stats.isFile()) {
		return [{ rule: 'binary', detail: 'not a regular file' }];
	}

	const handle = openSync(executable, 'r');
	try {
		const magic = Buffer.alloc(4);
		readSync(handle, magic, 0, 4, 0);
		if (!magic.equals(ELF_MAGIC)) {
			findings.push({ rule: 'binary', detail: 'does not start with the ELF magic' });
		}

		// Read in overlapping chunks so a marker split across a boundary is
		// still found; a missed marker would read as a removed surface.
		const chunkSize = 4 * 1024 * 1024;
		const overlap = 64;
		const buffer = Buffer.alloc(chunkSize);
		const seen = new Set<string>();
		let offset = 0;
		while (offset < stats.size) {
			const read = readSync(handle, buffer, 0, chunkSize, offset);
			if (read <= 0) {
				break;
			}
			const text = buffer.subarray(0, read).toString('latin1');
			for (const marker of ABSENT_MARKERS) {
				if (text.includes(marker)) {
					seen.add(marker);
				}
			}
			offset += read - overlap;
			if (read < chunkSize) {
				break;
			}
		}

		for (const marker of seen) {
			findings.push({ rule: 'embedded-ui', detail: `binary still contains ${marker}` });
		}
	} finally {
		closeSync(handle);
	}

	return findings;
}

function usage(message: string): never {
	process.stderr.write(`${message}\n`);
	process.stderr.write('usage: audit-service-only.ts --exe <opencode-binary>\n');
	process.exit(1);
}

function main(): void {
	const argv = process.argv.slice(2);
	let executable: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--exe') {
			executable = argv[++i];
			if (executable === undefined) {
				usage('missing value for --exe');
			}
		} else if (arg.startsWith('--exe=')) {
			executable = arg.slice('--exe='.length);
		} else {
			usage(`unexpected argument ${arg}`);
		}
	}

	if (executable === undefined || executable === '') {
		usage('missing --exe');
	}
	if (!existsSync(executable)) {
		usage(`executable not found: ${executable}`);
	}

	const run: Runner = (args) => {
		const result = spawnSync(executable, [...args], {
			encoding: 'utf8',
			timeout: 30_000,
			// The audited surfaces must refuse without being fed anything.
			input: '',
		});
		return {
			status: result.status,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? '',
		};
	};

	const surfaces = auditServiceOnly(run);
	const content = auditBinaryContent(executable);
	const findings = [...surfaces.findings, ...content];

	const lines = [`executable=${executable}`, `checked=${surfaces.checked}`];
	for (const finding of findings) {
		lines.push(`failure=${finding.rule} ${finding.detail}`);
	}
	lines.push(`findings=${findings.length}`);
	lines.push(`service-only=${findings.length === 0 ? 'pass' : 'fail'}`);
	process.stdout.write(`${lines.join('\n')}\n`);

	if (findings.length > 0) {
		process.exitCode = 1;
	}
}

main();
