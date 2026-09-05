/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The routing decision: given a demanded capability, pick the cheapest model
 * that reaches it without passing the configured ceiling.
 *
 * The decision is a pure function of the demand, the two local sources and the
 * set of models the operator authorised. Nothing the user wrote reaches it, no
 * file is read and nothing is called, so a routing decision can be reproduced
 * from its inputs alone — which is the only way an unexpected choice can be
 * argued about after the fact.
 *
 * Refusal is a first-class outcome. When no model qualifies, the decision says
 * so instead of reaching for a bigger one: silent escalation spends someone
 * else's money on a judgement this code is not entitled to make.
 */

import { RouterConfiguration } from './routerContract';
import { IntelligenceIndexDocument, ModelCostDocument, eligibleModels } from './intelligenceIndex';

/**
 * What the caller needs, expressed on the same scale as the index document.
	 * The estimate comes from the router model; this module does not produce it,
	 * because estimating it here would require reading what the user wrote.
 */
export interface RouterDemand {
	readonly requiredIndex: number;
	/**
	 * Models the operator authorised for this workspace. A model absent from
	 * this list is not a candidate no matter how well it scores: capability is
	 * not authorisation.
	 */
	readonly authorizedModels: readonly string[];
}

export type RouterSelectionRefusalCode =
	/** The demanded index is not a measurement. */
	| 'invalidDemand'
	/** No model is authorised, so there is nothing to choose between. */
	| 'noAuthorizedModel'
	/** The ceiling is missing from the index, so it cannot bound anything. */
	| 'ceilingNotIndexed'
	/** The demand is above the ceiling. Escalating past it is the operator's call. */
	| 'ceilingBelowDemand'
	/** Models reach the demand, but none of them is priced. */
	| 'costMissing'
	/** Nothing authorised reaches the demand within the ceiling. */
	| 'noCapableModel';

export interface RouterChoice {
	readonly model: string;
	readonly index: number;
	/** Sum of input and output rates, in the unit the cost document declares. */
	readonly cost: number;
	readonly unit: string;
	/** How many candidates were compared, for a report that can be audited. */
	readonly considered: number;
}

export type RouterSelectionResult =
	| { readonly ok: true; readonly choice: RouterChoice }
	| { readonly ok: false; readonly code: RouterSelectionRefusalCode };

function isMeasurement(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Cheapest first, then the lower index, then the identifier. The last two keys
 * exist so that a tie resolves the same way on every machine: an unstable
 * comparator turns an equal-cost tie into a choice that changes between runs
 * and cannot be reproduced from a report.
 */
function cheaperFirst(
	left: { model: string; index: number; cost: number },
	right: { model: string; index: number; cost: number }
): number {
	if (left.cost !== right.cost) {
		return left.cost - right.cost;
	}
	if (left.index !== right.index) {
		return left.index - right.index;
	}
	return left.model < right.model ? -1 : left.model > right.model ? 1 : 0;
}

export function selectModel(
	configuration: RouterConfiguration,
	index: IntelligenceIndexDocument,
	cost: ModelCostDocument,
	demand: RouterDemand
): RouterSelectionResult {
	if (!isMeasurement(demand.requiredIndex)) {
		return { ok: false, code: 'invalidDemand' };
	}

	const authorized = new Set(demand.authorizedModels);
	if (authorized.size === 0) {
		return { ok: false, code: 'noAuthorizedModel' };
	}

	// The ceiling is a model, not a number, and it means "no more capable than
	// this one". Reading it as a universal rank would make it mean something
	// different for every index revision.
	const ceilingEntry = configuration.maxModel === undefined
		? undefined
		: index.entries.find(entry => entry.model === configuration.maxModel);
	if (ceilingEntry === undefined) {
		return { ok: false, code: 'ceilingNotIndexed' };
	}

	if (demand.requiredIndex > ceilingEntry.index) {
		return { ok: false, code: 'ceilingBelowDemand' };
	}

	const priced = new Set(eligibleModels(index, cost));
	const costOf = new Map(cost.entries.map(entry => [entry.model, entry.input + entry.output]));

	const candidates: { model: string; index: number; cost: number }[] = [];
	let capableButUnpriced = false;

	for (const entry of index.entries) {
		if (!authorized.has(entry.model)) {
			continue;
		}
		if (entry.index < demand.requiredIndex || entry.index > ceilingEntry.index) {
			continue;
		}
		if (!priced.has(entry.model)) {
			capableButUnpriced = true;
			continue;
		}
		candidates.push({ model: entry.model, index: entry.index, cost: costOf.get(entry.model)! });
	}

	if (candidates.length === 0) {
		// An unpriced model is a different failure from no model at all: one is
		// a gap in the cost table, the other is a demand nothing can meet.
		return { ok: false, code: capableButUnpriced ? 'costMissing' : 'noCapableModel' };
	}

	candidates.sort(cheaperFirst);
	const winner = candidates[0];
	return {
		ok: true,
		choice: {
			model: winner.model,
			index: winner.index,
			cost: winner.cost,
			unit: cost.unit,
			considered: candidates.length
		}
	};
}
