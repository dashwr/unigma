/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Parses the two local sources a router needs to rank a request: an
 * approximate capability index and a cost table.
 *
 * Neither is a universal ranking. Both carry the reference that produced them,
 * and a reader that loses the reference loses the only thing that made the
 * numbers comparable, so the reference is mandatory and travels with the
 * parsed document.
 *
 * No value is fixed here. The scale belongs to the source, not to this file,
 * which is why nothing validates an index against an expected ceiling: a cap
 * invented here would silently reject a source that measures differently.
 *
 * These functions are pure. They read no file and reach no network, so a
 * source can only enter through the caller that already decided it was
 * allowed.
 */

import { MODEL_ID, parseReference, type RouterReference } from './routerContract';

/**
 * Bumped when the shape changes. A document from another version is refused
 * rather than read partially, because a field that moved is worse than a field
 * that is missing.
 */
export const ROUTER_SOURCE_VERSION = 1;

export interface IntelligenceIndexEntry {
	readonly model: string;
	/**
	 * Approximate capability on the scale the source declares. It is not a
	 * probability, not a percentage and not comparable across references.
	 */
	readonly index: number;
}

export interface IntelligenceIndexDocument {
	readonly sourceVersion: number;
	readonly reference: RouterReference;
	readonly entries: readonly IntelligenceIndexEntry[];
}

export interface ModelCostEntry {
	readonly model: string;
	readonly input: number;
	readonly output: number;
}

export interface ModelCostDocument {
	readonly sourceVersion: number;
	readonly reference: RouterReference;
	/**
	 * Mandatory and free-form, e.g. `usd-per-million-tokens`. A cost table
	 * without a unit is a list of numbers whose meaning the reader supplies,
	 * and the reader is usually wrong by a factor of a thousand.
	 */
	readonly unit: string;
	readonly entries: readonly ModelCostEntry[];
}

export type RouterSourceRefusalCode =
	| 'malformed'
	| 'unexpectedField'
	| 'unsupportedSourceVersion'
	| 'invalidReference'
	| 'noEntries'
	| 'invalidModel'
	| 'duplicateModel'
	| 'invalidIndex'
	| 'missingUnit'
	| 'invalidCost';

export type IntelligenceIndexResult =
	| { readonly accepted: true; readonly document: IntelligenceIndexDocument }
	| { readonly accepted: false; readonly code: RouterSourceRefusalCode };

export type ModelCostResult =
	| { readonly accepted: true; readonly document: ModelCostDocument }
	| { readonly accepted: false; readonly code: RouterSourceRefusalCode };

const INDEX_FIELDS = new Set(['sourceVersion', 'reference', 'entries']);
const COST_FIELDS = new Set(['sourceVersion', 'reference', 'unit', 'entries']);
const INDEX_ENTRY_FIELDS = new Set(['model', 'index']);
const COST_ENTRY_FIELDS = new Set(['model', 'input', 'output']);

const MAX_ENTRIES = 512;
const MAX_UNIT_LENGTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			return false;
		}
	}
	return true;
}

/**
 * Refuses anything that is not a real, finite, non-negative number. `NaN`
 * compares false against every threshold, so a router that let one through
 * would rank a model below every rival and never say why.
 */
function isMeasurement(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

interface Header {
	readonly reference: RouterReference;
	readonly entries: readonly unknown[];
}

function parseHeader(
	value: unknown,
	fields: ReadonlySet<string>,
): Header | RouterSourceRefusalCode {
	if (!isRecord(value)) {
		return 'malformed';
	}
	if (!hasOnly(value, fields)) {
		return 'unexpectedField';
	}
	const { sourceVersion, reference, entries } = value;
	if (typeof sourceVersion !== 'number' || !Number.isInteger(sourceVersion)) {
		return 'malformed';
	}
	if (sourceVersion !== ROUTER_SOURCE_VERSION) {
		return 'unsupportedSourceVersion';
	}
	const parsedReference = parseReference(reference);
	if (!parsedReference) {
		return 'invalidReference';
	}
	if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ENTRIES) {
		return 'noEntries';
	}
	return { reference: parsedReference, entries };
}

export function parseIntelligenceIndex(value: unknown): IntelligenceIndexResult {
	const header = parseHeader(value, INDEX_FIELDS);
	if (typeof header === 'string') {
		return { accepted: false, code: header };
	}

	const seen = new Set<string>();
	const entries: IntelligenceIndexEntry[] = [];
	for (const raw of header.entries) {
		if (!isRecord(raw)) {
			return { accepted: false, code: 'malformed' };
		}
		if (!hasOnly(raw, INDEX_ENTRY_FIELDS)) {
			return { accepted: false, code: 'unexpectedField' };
		}
		const { model, index } = raw;
		if (typeof model !== 'string' || !MODEL_ID.test(model)) {
			return { accepted: false, code: 'invalidModel' };
		}
		// Two rows for one model is an ambiguity, not a preference. Picking
		// either one would make the router's answer depend on file order.
		if (seen.has(model)) {
			return { accepted: false, code: 'duplicateModel' };
		}
		if (!isMeasurement(index)) {
			return { accepted: false, code: 'invalidIndex' };
		}
		seen.add(model);
		entries.push({ model, index });
	}

	return {
		accepted: true,
		document: {
			sourceVersion: ROUTER_SOURCE_VERSION,
			reference: header.reference,
			entries,
		},
	};
}

export function parseModelCost(value: unknown): ModelCostResult {
	const header = parseHeader(value, COST_FIELDS);
	if (typeof header === 'string') {
		return { accepted: false, code: header };
	}

	const unit = (value as Record<string, unknown>).unit;
	if (typeof unit !== 'string' || unit.length === 0 || unit.length > MAX_UNIT_LENGTH) {
		return { accepted: false, code: 'missingUnit' };
	}

	const seen = new Set<string>();
	const entries: ModelCostEntry[] = [];
	for (const raw of header.entries) {
		if (!isRecord(raw)) {
			return { accepted: false, code: 'malformed' };
		}
		if (!hasOnly(raw, COST_ENTRY_FIELDS)) {
			return { accepted: false, code: 'unexpectedField' };
		}
		const { model, input, output } = raw;
		if (typeof model !== 'string' || !MODEL_ID.test(model)) {
			return { accepted: false, code: 'invalidModel' };
		}
		if (seen.has(model)) {
			return { accepted: false, code: 'duplicateModel' };
		}
		// Both directions are required. A table that priced one of them would
		// be read as if the other were free.
		if (!isMeasurement(input) || !isMeasurement(output)) {
			return { accepted: false, code: 'invalidCost' };
		}
		seen.add(model);
		entries.push({ model, input, output });
	}

	return {
		accepted: true,
		document: {
			sourceVersion: ROUTER_SOURCE_VERSION,
			reference: header.reference,
			unit,
			entries,
		},
	};
}

/**
 * A model is eligible only when both sources describe it. Ranking a model
 * whose cost is unknown is how a router picks the expensive one, and pricing a
 * model whose capability is unknown is how it picks the useless one.
 */
export function eligibleModels(
	index: IntelligenceIndexDocument,
	cost: ModelCostDocument,
): readonly string[] {
	const priced = new Set(cost.entries.map(entry => entry.model));
	return index.entries
		.map(entry => entry.model)
		.filter(model => priced.has(model))
		.sort();
}
