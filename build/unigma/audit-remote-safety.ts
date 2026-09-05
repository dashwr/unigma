/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Audits the invariants that protect a host the product does not own.
 *
 * Each rule here exists because the repository already paid for it: the
 * ownership rule came from an extraction that reproduced a Windows mount's
 * ownership inside /root, and the host key rule guards the one decision that
 * separates a trusted destination from any machine answering on that address.
 *
 * These are text rules over shell that is assembled as strings and executed
 * somewhere else, so no type checker and no test of the calling code sees
 * them. Reviewing the diff is not enough either: the dangerous form and the
 * safe form differ by one flag.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

interface Finding {
	readonly rule: string;
	readonly file: string;
	readonly line: number;
	readonly detail: string;
}

interface Rule {
	readonly id: string;
	readonly description: string;
	readonly check: (line: string) => string | undefined;
}

/*
 * A tar extraction that may run as root must not let the archive choose
 * ownership or permission bits. Without these flags the payload decides what
 * appears on disk and with which privilege, setuid included, and the
 * extraction happens before any manifest is verified.
 */
const EXTRACTION_RULE: Rule = {
	id: 'tar-ownership',
	description: 'every tar extraction passes --no-same-owner and --no-same-permissions',
	check: line => {
		if (!/\btar\b[^|]*\s-[a-zA-Z]*x/.test(line)) {
			return undefined;
		}
		const missing: string[] = [];
		if (!line.includes('--no-same-owner')) {
			missing.push('--no-same-owner');
		}
		if (!line.includes('--no-same-permissions')) {
			missing.push('--no-same-permissions');
		}
		return missing.length > 0 ? `missing ${missing.join(' and ')}` : undefined;
	}
};

/*
 * Host key checking is the whole of the destination's identity. Relaxing it
 * turns "the host I trust" into "whatever answers on that address", and
 * accept-new is the same concession spelled politely.
 */
const HOST_KEY_RULE: Rule = {
	id: 'host-key',
	description: 'StrictHostKeyChecking is never relaxed',
	check: line => {
		const match = /StrictHostKeyChecking[= ]+["']?(no|accept-new|off)\b/i.exec(line);
		return match ? `StrictHostKeyChecking=${match[1]}` : undefined;
	}
};

/*
 * Piping a download into a shell executes whatever the endpoint served, at
 * the privilege of the caller, with no digest in between. Every toolchain
 * this repository fetches is verified against a published checksum first.
 */
const PIPED_DOWNLOAD_RULE: Rule = {
	id: 'piped-download',
	description: 'no download is piped into a shell',
	check: line => {
		const match = /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b/.exec(line);
		return match ? 'download piped into a shell' : undefined;
	}
};

/*
 * The remote contract forbids privilege escalation on the far side: the
 * product writes inside the user's own versioned directory and nowhere else.
 * A sudo in assembled remote shell is that boundary being crossed.
 */
const ESCALATION_RULE: Rule = {
	id: 'escalation',
	description: 'remote shell never escalates privilege',
	check: line => {
		if (/^\s*(\/\/|\*|#)/.test(line)) {
			return undefined;
		}
		return /\bsudo\b/.test(line) ? 'sudo in assembled remote shell' : undefined;
	}
};

const WORKFLOW_RULES: readonly Rule[] = [EXTRACTION_RULE, HOST_KEY_RULE, PIPED_DOWNLOAD_RULE];
const REMOTE_SHELL_RULES: readonly Rule[] = [EXTRACTION_RULE, HOST_KEY_RULE, PIPED_DOWNLOAD_RULE, ESCALATION_RULE];

interface Scope {
	readonly directory: string;
	readonly extension: string;
	readonly rules: readonly Rule[];
}

const SCOPES: readonly Scope[] = [
	{ directory: '.github/workflows', extension: '.yml', rules: WORKFLOW_RULES },
	{ directory: 'extensions/unigma-remote-ssh/src', extension: '.ts', rules: REMOTE_SHELL_RULES },
	{ directory: 'build/unigma', extension: '.ts', rules: REMOTE_SHELL_RULES }
];

function filesIn(directory: string, extension: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(directory);
	} catch {
		return [];
	}

	const found: string[] = [];
	for (const entry of entries) {
		const candidate = join(directory, entry);
		if (statSync(candidate).isDirectory()) {
			found.push(...filesIn(candidate, extension));
			/*
			 * The auditor names the forms it refuses, so scanning itself would
			 * report its own rules as violations.
			 */
		} else if (entry.endsWith(extension) && !entry.endsWith('.test.ts') && !entry.startsWith('audit-remote-safety.')) {
			found.push(candidate);
		}
	}
	return found.sort();
}

export function auditRemoteSafety(root: string): Finding[] {
	const findings: Finding[] = [];

	for (const scope of SCOPES) {
		for (const file of filesIn(resolve(root, scope.directory), scope.extension)) {
			const lines = readFileSync(file, 'utf8').split(/\r?\n/);
			lines.forEach((line, index) => {
				for (const rule of scope.rules) {
					const detail = rule.check(line);
					if (detail !== undefined) {
						findings.push({
							rule: rule.id,
							file: relative(root, file).split('\\').join('/'),
							line: index + 1,
							detail
						});
					}
				}
			});
		}
	}

	return findings;
}

function main(): void {
	const [, , requested] = process.argv;
	const root = resolve(requested ?? resolve(import.meta.dirname, '..', '..'));
	const findings = auditRemoteSafety(root);

	const report: string[] = [`root=${root}`];
	for (const scope of SCOPES) {
		report.push(`scope=${scope.directory}`);
	}
	for (const finding of findings) {
		report.push(`failure=${finding.rule} ${finding.file}:${finding.line} ${finding.detail}`);
	}
	report.push(`findings=${findings.length}`);
	report.push(`remote-safety=${findings.length === 0 ? 'pass' : 'fail'}`);

	console.log(report.join('\n'));
	if (findings.length > 0) {
		process.exitCode = 1;
	}
}

main();
