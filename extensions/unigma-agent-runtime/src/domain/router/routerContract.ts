/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Private contract for the router configuration.
 *
 * This module describes what a valid router configuration looks like and
 * refuses everything else. It decides nothing: there is no model choice, no
 * index lookup and no provider here, because the routing decision needs a
 * provider that nobody has authorised yet, and writing the decision first
 * would fix its shape around a provider we have not seen.
 *
 * No credential appears. The OpenCode process holds them and this
 * configuration only names models the operator already authorised there, so
 * copying one into settings is not merely discouraged: there is no field it
 * could live in.
 */

export const ROUTER_CONTRACT_VERSION = 1;

/** What the router may do with a prompt. */
export type RouterPromptPolicy =
	/** The router receives the request metadata only, never prompt text. */
	| 'metadataOnly';

/** What happens when the router cannot answer in time. */
export type RouterFallback =
	/** Use the ceiling model. Costs more and always answers. */
	| 'maxModel'
	/** Use the model the operator selected. Cheapest, may be underpowered. */
	| 'selectedModel'
	/** Answer nothing and report the failure. */
	| 'refuse';

/** Why a request skipped routing. Not a setting: an outcome the caller records. */
export type RouterBypass =
	/** Routing ran. */
	| 'none'
	/** The operator picked a model explicitly for this request. */
	| 'explicitSelection'
	/** Autopilot is off. */
	| 'autopilotDisabled';

/**
 * A versioned reference to a local file. The router reads intelligence and
 * cost from data the operator placed on this machine; there is no catalogue to
 * synchronise and no ranking served from anywhere.
 */
export interface RouterReference {
	/** Path relative to the workspace or an absolute local path. */
	readonly source: string;
	/** Schema version of the referenced document. */
	readonly version: number;
	/** Revision of the data itself, so a stale file is detectable. */
	readonly revision: string;
}

export interface RouterConfiguration {
	readonly contractVersion: number;
	readonly autopilotEnabled: boolean;
	readonly selectedModel?: string;
	readonly persistSelectedModel: boolean;
	readonly routerModel?: string;
	readonly maxModel?: string;
	readonly intelligenceIndex?: RouterReference;
	readonly modelCost?: RouterReference;
	readonly timeoutMs: number;
	readonly fallback: RouterFallback;
	readonly promptPolicy: RouterPromptPolicy;
}

export type RouterConfigurationRefusalCode =
	| 'malformed'
	| 'unexpectedField'
	| 'unsupportedVersion'
	| 'invalidModelId'
	| 'invalidReference'
	| 'invalidTimeout'
	| 'invalidFallback'
	| 'invalidPromptPolicy'
	| 'routerModelRequired'
	| 'maxModelRequired'
	| 'selectedModelRequired'
	| 'referenceRequired';

export type RouterConfigurationResult =
	| { readonly accepted: true; readonly configuration: RouterConfiguration }
	| { readonly accepted: false; readonly code: RouterConfigurationRefusalCode };

const DECLARED_FIELDS = new Set([
	'contractVersion',
	'autopilotEnabled',
	'selectedModel',
	'persistSelectedModel',
	'routerModel',
	'maxModel',
	'intelligenceIndex',
	'modelCost',
	'timeoutMs',
	'fallback',
	'promptPolicy',
]);

const REFERENCE_FIELDS = new Set(['source', 'version', 'revision']);

const FALLBACKS: readonly RouterFallback[] = ['maxModel', 'selectedModel', 'refuse'];

/**
 * `provider/model`, both halves bounded. Anything looking like a URL, a path or
 * a credential fails here rather than reaching a provider.
 */
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const REVISION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * A router that waits longer than this has already cost more than the model it
 * was trying to avoid. A router that answers instantly did not consult
 * anything.
 */
const MIN_TIMEOUT_MS = 50;
const MAX_TIMEOUT_MS = 30_000;

function refuse(code: RouterConfigurationRefusalCode): RouterConfigurationResult {
	return { accepted: false, code };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReference(value: unknown): RouterReference | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	for (const key of Object.keys(value)) {
		if (!REFERENCE_FIELDS.has(key)) {
			return undefined;
		}
	}
	const { source, version, revision } = value;
	if (typeof source !== 'string' || source.length === 0 || source.length > 512) {
		return undefined;
	}
	// A reference that escapes upward names a file the operator did not choose.
	if (source.includes('..') || source.includes('\0')) {
		return undefined;
	}
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
		return undefined;
	}
	if (typeof revision !== 'string' || !REVISION.test(revision)) {
		return undefined;
	}
	return { source, version, revision };
}

/**
 * Validates a router configuration and rebuilds it field by field. The input is
 * never forwarded, so a property that passed validation cannot carry along one
 * that did not.
 */
export function parseRouterConfiguration(value: unknown): RouterConfigurationResult {
	if (!isRecord(value)) {
		return refuse('malformed');
	}

	for (const key of Object.keys(value)) {
		if (!DECLARED_FIELDS.has(key)) {
			return refuse('unexpectedField');
		}
	}

	const contractVersion = value.contractVersion;
	if (typeof contractVersion !== 'number' || !Number.isInteger(contractVersion)) {
		return refuse('malformed');
	}
	if (contractVersion !== ROUTER_CONTRACT_VERSION) {
		return refuse('unsupportedVersion');
	}

	const autopilotEnabled = value.autopilotEnabled;
	const persistSelectedModel = value.persistSelectedModel;
	if (typeof autopilotEnabled !== 'boolean' || typeof persistSelectedModel !== 'boolean') {
		return refuse('malformed');
	}

	for (const field of ['selectedModel', 'routerModel', 'maxModel'] as const) {
		const model = value[field];
		if (model === undefined) {
			continue;
		}
		if (typeof model !== 'string' || !MODEL_ID.test(model)) {
			return refuse('invalidModelId');
		}
	}
	const selectedModel = value.selectedModel as string | undefined;
	const routerModel = value.routerModel as string | undefined;
	const maxModel = value.maxModel as string | undefined;

	const timeoutMs = value.timeoutMs;
	if (
		typeof timeoutMs !== 'number' ||
		!Number.isInteger(timeoutMs) ||
		timeoutMs < MIN_TIMEOUT_MS ||
		timeoutMs > MAX_TIMEOUT_MS
	) {
		return refuse('invalidTimeout');
	}

	const fallback = value.fallback as RouterFallback;
	if (typeof fallback !== 'string' || !FALLBACKS.includes(fallback)) {
		return refuse('invalidFallback');
	}

	// The only accepted value. A router that reads prompts to classify them
	// sends the workspace's contents to a model the operator did not choose for
	// that content, so the field exists to be refused when it changes.
	if (value.promptPolicy !== 'metadataOnly') {
		return refuse('invalidPromptPolicy');
	}

	let intelligenceIndex: RouterReference | undefined;
	if (value.intelligenceIndex !== undefined) {
		intelligenceIndex = parseReference(value.intelligenceIndex);
		if (!intelligenceIndex) {
			return refuse('invalidReference');
		}
	}
	let modelCost: RouterReference | undefined;
	if (value.modelCost !== undefined) {
		modelCost = parseReference(value.modelCost);
		if (!modelCost) {
			return refuse('invalidReference');
		}
	}

	if (autopilotEnabled) {
		// Routing without a router is a name for guessing.
		if (!routerModel) {
			return refuse('routerModelRequired');
		}
		// Without a ceiling, a fallback of maxModel has nothing to fall back to
		// and a routing mistake has no upper bound in cost.
		if (!maxModel) {
			return refuse('maxModelRequired');
		}
		// Ranking models needs the data that ranks them. Refusing here is what
		// keeps the router from inventing an order of its own.
		if (!intelligenceIndex || !modelCost) {
			return refuse('referenceRequired');
		}
	}

	// Persisting a selection that does not exist would silently persist
	// whatever the runtime picked, which is the opposite of an operator choice.
	if (persistSelectedModel && !selectedModel) {
		return refuse('selectedModelRequired');
	}
	if (fallback === 'selectedModel' && !selectedModel) {
		return refuse('selectedModelRequired');
	}
	if (fallback === 'maxModel' && !maxModel) {
		return refuse('maxModelRequired');
	}

	return {
		accepted: true,
		configuration: {
			contractVersion,
			autopilotEnabled,
			selectedModel,
			persistSelectedModel,
			routerModel,
			maxModel,
			intelligenceIndex,
			modelCost,
			timeoutMs,
			fallback,
			promptPolicy: 'metadataOnly',
		},
	};
}

/**
 * Reports why a request did not go through the router. Autopilot off and an
 * explicit pick are different events: one is a setting, the other is a choice
 * made for a single request, and a report that merges them cannot tell whether
 * the operator is overriding the router or has never turned it on.
 */
export function bypassFor(
	configuration: RouterConfiguration,
	explicitSelection: boolean
): RouterBypass {
	if (explicitSelection) {
		return 'explicitSelection';
	}
	return configuration.autopilotEnabled ? 'none' : 'autopilotDisabled';
}
