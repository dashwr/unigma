/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A dormant contract for future remote control of a local runtime.
 *
 * Dormant means the shape is decided and testable while nothing acts on it:
 * this module is types and one pure parser, with no socket, no listener, no
 * queue, no timer, no storage, and nothing pulled in that could acquire one. A
 * protocol that ships with a listener attached is not dormant, it is
 * unannounced.
 *
 * It is written down now because the alternative is inventing it under
 * pressure later, when the first caller already exists and every refusal looks
 * like an obstacle.
 */

/** Only this version exists. An envelope carrying any other number is refused, never coerced. */
export const REMOTE_CONTROL_PROTOCOL_VERSION = 1;

/** Identifies the contract itself, so an envelope from another protocol cannot be read as this one. */
export const REMOTE_CONTROL_PROTOCOL_ID = 'unigma.remote-control';

/**
 * What a caller may ask about, once something can answer.
 *
 * Every entry is read-only by construction. Prompting, approving a diff,
 * writing a file and starting a process are absent on purpose: a remote
 * capability that produces effects would have to answer for trust and approval
 * on the far side, and that question is not settled.
 */
export const REMOTE_CONTROL_CAPABILITIES = [
	'runtime.status',
	'session.list',
] as const;

export type RemoteControlCapability = typeof REMOTE_CONTROL_CAPABILITIES[number];

/**
 * The only accepted activation value.
 *
 * The field is mandatory rather than implied, so a caller that expects to be
 * served has to say so and be refused by name, instead of being silently
 * treated as an inspection.
 */
export type RemoteControlActivation = 'dormant';

export interface RemoteControlEnvelope {
	readonly protocol: typeof REMOTE_CONTROL_PROTOCOL_ID;
	readonly version: typeof REMOTE_CONTROL_PROTOCOL_VERSION;
	readonly activation: RemoteControlActivation;
	readonly capability: RemoteControlCapability;
	readonly requestId: string;
}

export type RemoteControlRefusalCode =
	/** Not an object, or a field has the wrong primitive type. */
	| 'malformed'
	/** The envelope belongs to some other protocol. */
	| 'unknownProtocol'
	/** A version this build does not implement, older or newer. */
	| 'unsupportedVersion'
	/** A capability outside the declared set. */
	| 'unknownCapability'
	/** The caller asked to be served; nothing serves this protocol. */
	| 'activationNotSupported'
	/** A field nobody declared, which is how a payload smuggles one in. */
	| 'unexpectedField';

export type RemoteControlParseResult =
	| { readonly accepted: true; readonly envelope: RemoteControlEnvelope }
	| { readonly accepted: false; readonly code: RemoteControlRefusalCode };

const DECLARED_FIELDS = new Set(['protocol', 'version', 'activation', 'capability', 'requestId']);

/** Bounded and printable, so a refusal can be logged with the id and nothing else. */
const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

function refuse(code: RemoteControlRefusalCode): RemoteControlParseResult {
	return { accepted: false, code };
}

/**
 * Validates an envelope without acting on it.
 *
 * Acceptance means the envelope is well formed and dormant. It never means a
 * request will be served, because nothing in this build serves one.
 */
export function parseRemoteControlEnvelope(value: unknown): RemoteControlParseResult {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return refuse('malformed');
	}

	const candidate = value as Record<string, unknown>;
	for (const key of Object.keys(candidate)) {
		if (!DECLARED_FIELDS.has(key)) {
			return refuse('unexpectedField');
		}
	}

	if (candidate.protocol !== REMOTE_CONTROL_PROTOCOL_ID) {
		return refuse('unknownProtocol');
	}

	// Checked before the value, so a version sent as text is refused as a version
	// rather than reported as a shape problem the caller cannot locate.
	if (typeof candidate.version !== 'number' || !Number.isInteger(candidate.version)) {
		return refuse('malformed');
	}

	if (candidate.version !== REMOTE_CONTROL_PROTOCOL_VERSION) {
		return refuse('unsupportedVersion');
	}

	if (typeof candidate.activation !== 'string') {
		return refuse('malformed');
	}

	if (candidate.activation !== 'dormant') {
		return refuse('activationNotSupported');
	}

	if (typeof candidate.capability !== 'string') {
		return refuse('malformed');
	}

	if (!(REMOTE_CONTROL_CAPABILITIES as readonly string[]).includes(candidate.capability)) {
		return refuse('unknownCapability');
	}

	if (typeof candidate.requestId !== 'string' || !REQUEST_ID.test(candidate.requestId)) {
		return refuse('malformed');
	}

	return {
		accepted: true,
		envelope: {
			protocol: REMOTE_CONTROL_PROTOCOL_ID,
			version: REMOTE_CONTROL_PROTOCOL_VERSION,
			activation: 'dormant',
			capability: candidate.capability as RemoteControlCapability,
			requestId: candidate.requestId,
		},
	};
}
