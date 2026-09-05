/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The state machine that decides which model serves a request, and why.
 *
 * The router itself is one input among several. A user who picked a model, a
 * disabled Autopilot, a router that answered too late and a router that could
 * not answer at all are four different situations, and each of them has an
 * outcome the operator can act on. Collapsing them into "we used the default"
 * is what makes a routed product impossible to reason about after the fact.
 *
 * Time is an input, not something this module reads. A deadline that the caller
 * measures can be tested; a deadline this module measures can only be waited
 * for. Nothing the user wrote reaches here either: the request carries a
 * demand, already a number, and whoever produced it answers for what it read.
 */

import { bypassFor, type RouterBypass, type RouterConfiguration } from './routerContract';
import type { IntelligenceIndexDocument, ModelCostDocument } from './intelligenceIndex';
import { selectModel, type RouterDemand, type RouterSelectionRefusalCode } from './routerSelection';

/**
 * What the router produced for this request.
 *
 * `answered` carries the estimate. `timedOut` means the deadline the caller set
 * passed first. `unavailable` means the router could not be consulted at all —
 * no configuration, no reachable model, a refusal upstream. The last two are
 * kept apart because a deadline is tuning and an absence is a fault.
 */
export type RouterOutcome =
	| { readonly kind: 'answered'; readonly demand: RouterDemand }
	| { readonly kind: 'timedOut'; readonly elapsedMs: number }
	| { readonly kind: 'unavailable' };

export interface RouterRequest {
	/** A model the user picked for this request, if any. */
	readonly explicitSelection?: string;
	readonly outcome: RouterOutcome;
}

/** Why the chosen model was chosen. Every path names itself. */
export type RouterDecisionReason =
	| 'explicitSelection'
	| 'autopilotDisabled'
	| 'routed'
	| 'fallbackAfterTimeout'
	| 'fallbackAfterUnavailable'
	| 'fallbackAfterRefusal';

export type RouterPlanRefusalCode =
	| 'noSelectedModel'
	| 'fallbackRefuses'
	| 'fallbackModelMissing'
	| RouterSelectionRefusalCode;

export interface RouterPlan {
	readonly model: string;
	readonly reason: RouterDecisionReason;
	readonly bypass: RouterBypass;
	/** How many candidates were compared. Present only when the router actually chose. */
	readonly considered?: number;
	/** Set when the router was consulted and did not answer in time. */
	readonly elapsedMs?: number;
}

export type RouterPlanResult =
	| { readonly ok: true; readonly plan: RouterPlan }
	| { readonly ok: false; readonly code: RouterPlanRefusalCode; readonly bypass: RouterBypass };

function fallbackPlan(
	configuration: RouterConfiguration,
	bypass: RouterBypass,
	reason: RouterDecisionReason,
	elapsedMs?: number
): RouterPlanResult {
	// `refuse` is a configured answer, not a missing one. An operator who chose it
	// asked to be told rather than served, and quietly serving anyway would defeat
	// the only setting that guarantees no unintended spending.
	if (configuration.fallback === 'refuse') {
		return { ok: false, code: 'fallbackRefuses', bypass };
	}

	const model =
		configuration.fallback === 'maxModel' ? configuration.maxModel : configuration.selectedModel;
	if (model === undefined) {
		// The contract requires the model each fallback names, so reaching this means
		// the configuration was built past the parser. Refusing keeps the invariant
		// enforced at both ends instead of trusting one of them.
		return { ok: false, code: 'fallbackModelMissing', bypass };
	}

	return { ok: true, plan: { model, reason, bypass, ...(elapsedMs === undefined ? {} : { elapsedMs }) } };
}

/**
 * Decide which model serves this request.
 *
 * The order is deliberate: an explicit selection wins over everything, because a
 * user who picked a model is not asking for advice. Autopilot being off is next,
 * since a disabled feature must not consult the router at all. Only then does
 * the router's outcome matter.
 */
export function planRoute(
	configuration: RouterConfiguration,
	index: IntelligenceIndexDocument | undefined,
	cost: ModelCostDocument | undefined,
	request: RouterRequest
): RouterPlanResult {
	const bypass = bypassFor(configuration, request.explicitSelection !== undefined);

	if (bypass === 'explicitSelection') {
		return {
			ok: true,
			plan: { model: request.explicitSelection as string, reason: 'explicitSelection', bypass }
		};
	}

	if (bypass === 'autopilotDisabled') {
		// With Autopilot off there is no routing to fall back from, so the selected
		// model is the whole answer. Falling back to maxModel here would let a
		// disabled feature raise the model, which is the opposite of disabling it.
		if (configuration.selectedModel === undefined) {
			return { ok: false, code: 'noSelectedModel', bypass };
		}
		return {
			ok: true,
			plan: { model: configuration.selectedModel, reason: 'autopilotDisabled', bypass }
		};
	}

	if (request.outcome.kind === 'timedOut') {
		return fallbackPlan(configuration, bypass, 'fallbackAfterTimeout', request.outcome.elapsedMs);
	}

	if (request.outcome.kind === 'unavailable') {
		return fallbackPlan(configuration, bypass, 'fallbackAfterUnavailable');
	}

	if (index === undefined || cost === undefined) {
		return fallbackPlan(configuration, bypass, 'fallbackAfterUnavailable');
	}

	const selection = selectModel(configuration, index, cost, request.outcome.demand);
	if (!selection.ok) {
		// A refusal from the selection is a decision, not a fault: the demand was
		// above the ceiling, or nothing authorised could serve it. It still reaches
		// the fallback, because the request has to be answered one way or another,
		// and the reason records which of the three paths produced the model.
		return fallbackPlan(configuration, bypass, 'fallbackAfterRefusal');
	}

	return {
		ok: true,
		plan: {
			model: selection.choice.model,
			reason: 'routed',
			bypass,
			considered: selection.choice.considered
		}
	};
}
