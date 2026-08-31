/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Availability probe for the system OpenSSH client, which `docs/SSH-CONTRACT.md`
 * section 4.1 makes the single source of truth for the transport.
 *
 * The probe is deliberately limited to `ssh -V`: it prints the client version
 * and exits without opening a connection, without resolving a destination and
 * without reading `ssh_config`, `known_hosts`, an identity file or an agent
 * socket. `ssh -G` was rejected for this slice precisely because it evaluates
 * the user's configuration and echoes `IdentityFile`/`IdentityAgent` paths.
 */

/** Environment entries needed to locate an executable. None of them holds a credential. */
const PROBE_ENV_ALLOWLIST = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'COMSPEC'] as const;

const PROBE_TIMEOUT_MS = 5_000;

const OPENSSH_VERSION = /\bOpenSSH(?:_for_Windows)?_(\d{1,3})\.(\d{1,3})(p\d{1,3})?/;

export interface OpenSshVersion {
	readonly major: number;
	readonly minor: number;
	readonly portable?: string;
	/** Only the matched `OpenSSH_x.y[pN]` token; the rest of the banner is never retained. */
	readonly banner: string;
}

export type OpenSshUnavailableReason =
	| 'not-found'
	| 'not-executable'
	| 'timed-out'
	| 'unrecognized-implementation';

export type OpenSshProbeResult =
	| { readonly available: true; readonly version: OpenSshVersion }
	| { readonly available: false; readonly reason: OpenSshUnavailableReason };

export type OpenSshVersionRun =
	| { readonly status: 'ok'; readonly stdout: string; readonly stderr: string }
	| { readonly status: 'not-found' | 'not-executable' | 'timed-out' };

/** Injected so tests never spawn a process. */
export type OpenSshVersionRunner = () => Promise<OpenSshVersionRun>;

/**
 * Extracts the OpenSSH version from a `ssh -V` banner. Returns `undefined` for
 * any client that does not identify itself as OpenSSH, because the contract
 * does not cover an alternative implementation.
 */
export function parseOpenSshVersion(output: string): OpenSshVersion | undefined {
	const match = OPENSSH_VERSION.exec(output);
	if (!match) {
		return undefined;
	}

	const version: { major: number; minor: number; portable?: string; banner: string } = {
		major: Number(match[1]),
		minor: Number(match[2]),
		banner: match[0]
	};
	if (match[3] !== undefined) {
		version.portable = match[3];
	}
	return version;
}

/** Applies the availability rules to a single `ssh -V` run. */
export async function probeOpenSshClient(run: OpenSshVersionRunner): Promise<OpenSshProbeResult> {
	const result = await run();
	if (result.status !== 'ok') {
		return { available: false, reason: result.status };
	}

	// OpenSSH writes the banner to stderr; other builds have used stdout.
	const version = parseOpenSshVersion(result.stderr) ?? parseOpenSshVersion(result.stdout);
	if (!version) {
		return { available: false, reason: 'unrecognized-implementation' };
	}

	return { available: true, version };
}

/** Builds the probe environment from the allowlist above; nothing else is read. */
export function openSshProbeEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const name of PROBE_ENV_ALLOWLIST) {
		const value = source[name];
		if (typeof value === 'string') {
			env[name] = value;
		}
	}
	return env;
}

/** Default runner. Executes `ssh -V` only; it never receives a destination or an option. */
export function createOpenSshVersionRunner(): OpenSshVersionRunner {
	return async () => {
		const { execFile } = await import('node:child_process');
		return await new Promise<OpenSshVersionRun>(resolve => {
			execFile('ssh', ['-V'], {
				env: openSshProbeEnv(process.env),
				timeout: PROBE_TIMEOUT_MS,
				windowsHide: true
			}, (error, stdout, stderr) => {
				if (!error) {
					resolve({ status: 'ok', stdout, stderr });
					return;
				}

				const code = (error as NodeJS.ErrnoException).code;
				if (code === 'ENOENT') {
					resolve({ status: 'not-found' });
				} else if (code === 'EACCES' || code === 'EPERM') {
					resolve({ status: 'not-executable' });
				} else if (code === 'ETIMEDOUT' || (error as { killed?: boolean }).killed === true) {
					resolve({ status: 'timed-out' });
				} else {
					// A non-zero exit still carries the banner on some builds; let the
					// parser decide instead of guessing an implementation here.
					resolve({ status: 'ok', stdout, stderr });
				}
			});
		});
	};
}
