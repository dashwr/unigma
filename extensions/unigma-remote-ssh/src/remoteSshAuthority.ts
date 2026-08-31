/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Parsing of the `ssh-remote+<target>` authority defined by `docs/SSH-CONTRACT.md` section 1.
 *
 * `<target>` is an identifier only: an `ssh_config` alias or a canonical
 * `user@host:port`. It never carries a password, passphrase, private key path,
 * token, file content or workspace. This module therefore rejects anything that
 * is not one of those two shapes instead of trying to sanitize it, and it never
 * reads `ssh_config`, `known_hosts` or any environment variable.
 */

export const REMOTE_SSH_AUTHORITY_PREFIX = 'ssh-remote';

const AUTHORITY_SEPARATOR = '+';

/** Upper bound on the encoded authority; a longer value is a malformed URI, not a target. */
const MAX_ENCODED_TARGET_LENGTH = 255;

/** Only the characters needed by an alias, `user@host:port` and a bracketed IPv6 literal. */
const ALLOWED_TARGET_CHARACTERS = /^[A-Za-z0-9._@:[\]-]+$/;

/**
 * A bare token is reported as an alias: it may be an `ssh_config` `Host` entry
 * or a plain hostname, and deciding between them is OpenSSH's job, not ours.
 */
const ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]{0,252}$/;
const USER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const IPV6_LITERAL = /^\[([0-9A-Fa-f:]+)\](?::([0-9]{1,5}))?$/;
const PORT = /^[1-9][0-9]{0,4}$/;

export type RemoteSshAuthorityTarget =
	| { readonly kind: 'alias'; readonly alias: string }
	| { readonly kind: 'canonical'; readonly user?: string; readonly host: string; readonly port?: number };

/**
 * Every rejection maps to the single contract category `ssh.target-unresolved`.
 * The discriminator exists for deterministic tests, not for a user-facing string.
 */
export type RemoteSshAuthorityRejection =
	| 'authority-empty'
	| 'authority-prefix-mismatch'
	| 'target-empty'
	| 'target-too-long'
	| 'target-encoding-invalid'
	| 'target-unsafe-character'
	| 'target-option-like'
	| 'target-shape-invalid'
	| 'target-user-invalid'
	| 'target-host-invalid'
	| 'target-port-invalid';

export type RemoteSshAuthorityParse =
	| { readonly ok: true; readonly target: RemoteSshAuthorityTarget }
	| { readonly ok: false; readonly rejection: RemoteSshAuthorityRejection };

function reject(rejection: RemoteSshAuthorityRejection): RemoteSshAuthorityParse {
	return { ok: false, rejection };
}

function parsePort(raw: string | undefined): number | undefined | 'invalid' {
	if (raw === undefined) {
		return undefined;
	}
	if (!PORT.test(raw)) {
		return 'invalid';
	}
	const port = Number(raw);
	return port >= 1 && port <= 65535 ? port : 'invalid';
}

function parseHostAndPort(rest: string, user: string | undefined): RemoteSshAuthorityParse {
	if (rest.startsWith('[')) {
		const ipv6 = IPV6_LITERAL.exec(rest);
		if (!ipv6 || !ipv6[1].includes(':')) {
			return reject('target-host-invalid');
		}
		const port = parsePort(ipv6[2]);
		if (port === 'invalid') {
			return reject('target-port-invalid');
		}
		return { ok: true, target: canonical(user, ipv6[1], port) };
	}

	if (rest.includes('[') || rest.includes(']')) {
		return reject('target-host-invalid');
	}

	const segments = rest.split(':');
	if (segments.length > 2) {
		// An unbracketed IPv6 literal is ambiguous with `host:port`; the contract
		// does not let us guess which one the user meant.
		return reject('target-host-invalid');
	}

	if (!HOSTNAME.test(segments[0])) {
		return reject('target-host-invalid');
	}

	const port = parsePort(segments[1]);
	if (port === 'invalid') {
		return reject('target-port-invalid');
	}

	return { ok: true, target: canonical(user, segments[0], port) };
}

function canonical(user: string | undefined, host: string, port: number | undefined): RemoteSshAuthorityTarget {
	const target: { kind: 'canonical'; user?: string; host: string; port?: number } = { kind: 'canonical', host };
	if (user !== undefined) {
		target.user = user;
	}
	if (port !== undefined) {
		target.port = port;
	}
	return target;
}

/**
 * Parses a full remote authority. Returns a target only for the two shapes the
 * contract allows; nothing is resolved, executed or looked up.
 */
export function parseRemoteSshAuthority(authority: unknown): RemoteSshAuthorityParse {
	if (typeof authority !== 'string' || authority.length === 0) {
		return reject('authority-empty');
	}

	const prefix = `${REMOTE_SSH_AUTHORITY_PREFIX}${AUTHORITY_SEPARATOR}`;
	if (!authority.startsWith(prefix)) {
		return reject('authority-prefix-mismatch');
	}

	const encoded = authority.slice(prefix.length);
	if (encoded.length === 0) {
		return reject('target-empty');
	}
	if (encoded.length > MAX_ENCODED_TARGET_LENGTH) {
		return reject('target-too-long');
	}

	let decoded: string;
	try {
		decoded = decodeURIComponent(encoded);
	} catch {
		return reject('target-encoding-invalid');
	}

	if (decoded.length === 0) {
		return reject('target-empty');
	}
	if (decoded.startsWith('-')) {
		// OpenSSH would read a leading dash as an option, not as a destination.
		return reject('target-option-like');
	}
	if (!ALLOWED_TARGET_CHARACTERS.test(decoded)) {
		return reject('target-unsafe-character');
	}

	const users = decoded.split('@');
	if (users.length > 2) {
		return reject('target-shape-invalid');
	}

	if (users.length === 2) {
		if (!USER.test(users[0])) {
			return reject('target-user-invalid');
		}
		if (users[1].length === 0) {
			return reject('target-host-invalid');
		}
		return parseHostAndPort(users[1], users[0]);
	}

	if (decoded.includes(':') || decoded.includes('[')) {
		return parseHostAndPort(decoded, undefined);
	}

	if (!ALIAS.test(decoded)) {
		return reject('target-shape-invalid');
	}

	return { ok: true, target: { kind: 'alias', alias: decoded } };
}
