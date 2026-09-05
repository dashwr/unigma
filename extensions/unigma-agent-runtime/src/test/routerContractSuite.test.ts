/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import {
	parseRouterConfiguration,
	type RouterConfiguration,
	type RouterFallback,
} from '../domain/router/routerContract';
import {
	parseIntelligenceIndex,
	parseModelCost,
	type IntelligenceIndexDocument,
	type ModelCostDocument,
} from '../domain/router/intelligenceIndex';
import { selectModel, type RouterDemand } from '../domain/router/routerSelection';
import { planRoute, type RouterOutcome } from '../domain/router/routerPlan';

/**
 * The four router modules were written and tested one at a time. This suite
 * covers what none of them can check alone: that a configuration the parser
 * accepts always produces a decision the plan can name, and that the
 * properties each module promises still hold once they are composed.
 *
 * The input space is enumerated rather than sampled. It is small enough to
 * cover exhaustively, and an exhaustive pass is reproducible, while a random
 * one reports a different failure on every run.
 */

const REFERENCE = { source: 'router/index.json', version: 1, revision: 'r1' };
const COST_REFERENCE = { source: 'router/cost.json', version: 1, revision: 'r1' };

/** A model priced above its capability, so cheapest and most capable disagree. */
const INDEX_ENTRIES = [
	{ model: 'vendor/small', index: 10 },
	{ model: 'vendor/mid', index: 50 },
	{ model: 'vendor/unpriced', index: 70 },
	{ model: 'vendor/big', index: 90 },
];

const COST_ENTRIES = [
	{ model: 'vendor/small', input: 1, output: 1 },
	{ model: 'vendor/mid', input: 5, output: 5 },
	{ model: 'vendor/big', input: 20, output: 20 },
];

const ALL_MODELS = INDEX_ENTRIES.map(entry => entry.model);
const INDEX_OF = new Map(INDEX_ENTRIES.map(entry => [entry.model, entry.index]));
const PRICED = new Set(COST_ENTRIES.map(entry => entry.model));

const PLAN_REASONS = new Set([
	'explicitSelection',
	'autopilotDisabled',
	'routed',
	'fallbackAfterTimeout',
	'fallbackAfterUnavailable',
	'fallbackAfterRefusal',
]);

const PLAN_REFUSALS = new Set([
	'noSelectedModel',
	'fallbackRefuses',
	'fallbackModelMissing',
	'invalidDemand',
	'noAuthorizedModel',
	'ceilingNotIndexed',
	'ceilingBelowDemand',
	'costMissing',
	'noCapableModel',
]);

const BYPASSES = new Set(['none', 'explicitSelection', 'autopilotDisabled']);

function documents(): { index: IntelligenceIndexDocument; cost: ModelCostDocument } {
	const index = parseIntelligenceIndex({
		sourceVersion: 1,
		reference: REFERENCE,
		entries: INDEX_ENTRIES,
	});
	const cost = parseModelCost({
		sourceVersion: 1,
		reference: COST_REFERENCE,
		unit: 'usd-per-million-tokens',
		entries: COST_ENTRIES,
	});
	assert.ok(index.accepted, 'the index fixture must be a document the parser accepts');
	assert.ok(cost.accepted, 'the cost fixture must be a document the parser accepts');
	return { index: index.document, cost: cost.document };
}

/**
 * Every configuration used below goes through the parser, so the suite can
 * never assert a property of a shape the product would have refused.
 */
function configurations(): RouterConfiguration[] {
	const accepted: RouterConfiguration[] = [];
	const fallbacks: RouterFallback[] = ['maxModel', 'selectedModel', 'refuse'];
	for (const autopilotEnabled of [true, false]) {
		for (const fallback of fallbacks) {
			for (const maxModel of [...ALL_MODELS, undefined]) {
				for (const selectedModel of ['vendor/small', undefined]) {
					const result = parseRouterConfiguration({
						contractVersion: 1,
						autopilotEnabled,
						selectedModel,
						persistSelectedModel: false,
						routerModel: 'vendor/small',
						maxModel,
						intelligenceIndex: REFERENCE,
						modelCost: COST_REFERENCE,
						timeoutMs: 1000,
						fallback,
						promptPolicy: 'metadataOnly',
					});
					if (result.accepted) {
						accepted.push(result.configuration);
					}
				}
			}
		}
	}
	assert.ok(accepted.length > 0, 'the enumeration must produce configurations the parser accepts');
	return accepted;
}

function requests(): { explicitSelection?: string; outcome: RouterOutcome }[] {
	const authorized: readonly string[][] = [ALL_MODELS, ['vendor/small'], ['vendor/unpriced'], []];
	const outcomes: RouterOutcome[] = [
		{ kind: 'timedOut', elapsedMs: 1200 },
		{ kind: 'unavailable' },
	];
	for (const authorizedModels of authorized) {
		for (const requiredIndex of [0, 45, 95]) {
			outcomes.push({ kind: 'answered', demand: { requiredIndex, authorizedModels } });
		}
	}
	const all: { explicitSelection?: string; outcome: RouterOutcome }[] = [];
	for (const outcome of outcomes) {
		for (const explicitSelection of ['vendor/big', undefined]) {
			all.push({ explicitSelection, outcome });
		}
	}
	return all;
}

suite('router contract suite', () => {
	test('every accepted configuration produces a decision the contract can name', () => {
		const { index, cost } = documents();
		let planned = 0;
		let refused = 0;
		for (const configuration of configurations()) {
			for (const request of requests()) {
				const result = planRoute(configuration, index, cost, request);
				if (result.ok) {
					planned++;
					assert.ok(
						PLAN_REASONS.has(result.plan.reason),
						`unknown reason ${result.plan.reason}`,
					);
					assert.ok(BYPASSES.has(result.plan.bypass), `unknown bypass ${result.plan.bypass}`);
				} else {
					refused++;
					assert.ok(PLAN_REFUSALS.has(result.code), `unknown refusal ${result.code}`);
					assert.ok(BYPASSES.has(result.bypass), `unknown bypass ${result.bypass}`);
				}
			}
		}
		// Both halves must be exercised, or the assertions above prove nothing.
		assert.ok(planned > 0, 'the enumeration must reach at least one plan');
		assert.ok(refused > 0, 'the enumeration must reach at least one refusal');
	});

	test('a routed model is always authorised, capable, priced and under the ceiling', () => {
		const { index, cost } = documents();
		let routed = 0;
		for (const configuration of configurations()) {
			for (const request of requests()) {
				const result = planRoute(configuration, index, cost, request);
				if (!result.ok || result.plan.reason !== 'routed') {
					continue;
				}
				routed++;
				assert.strictEqual(request.outcome.kind, 'answered');
				const demand = (request.outcome as { demand: RouterDemand }).demand;
				const model = result.plan.model;
				assert.ok(
					demand.authorizedModels.includes(model),
					`${model} was routed without being authorised`,
				);
				assert.ok(PRICED.has(model), `${model} was routed without a price`);
				const score = INDEX_OF.get(model);
				assert.ok(score !== undefined, `${model} was routed without an index entry`);
				assert.ok(
					score >= demand.requiredIndex,
					`${model} was routed below the demand it had to meet`,
				);
				const ceiling = INDEX_OF.get(configuration.maxModel ?? '');
				assert.ok(ceiling !== undefined, 'routing requires an indexed ceiling');
				assert.ok(score <= ceiling, `${model} was routed above the ceiling`);
			}
		}
		assert.ok(routed > 0, 'the enumeration must reach a routed decision');
	});

	test('a decision carries only the evidence its own path produced', () => {
		const { index, cost } = documents();
		for (const configuration of configurations()) {
			for (const request of requests()) {
				const result = planRoute(configuration, index, cost, request);
				if (!result.ok) {
					continue;
				}
				const { reason, considered, elapsedMs, model } = result.plan;
				// `considered` is a count of compared candidates, so it may not
				// appear on a path where nothing was compared.
				assert.strictEqual(
					considered !== undefined,
					reason === 'routed',
					`considered on a ${reason} decision`,
				);
				assert.strictEqual(
					elapsedMs !== undefined,
					reason === 'fallbackAfterTimeout',
					`elapsedMs on a ${reason} decision`,
				);
				if (reason === 'explicitSelection') {
					assert.strictEqual(model, request.explicitSelection);
				}
				if (reason === 'autopilotDisabled') {
					assert.strictEqual(model, configuration.selectedModel);
				}
			}
		}
	});

	test('the same inputs always produce the same decision', () => {
		const { index, cost } = documents();
		for (const configuration of configurations()) {
			for (const request of requests()) {
				const first = planRoute(configuration, index, cost, request);
				const second = planRoute(configuration, index, cost, request);
				assert.deepStrictEqual(first, second);
			}
		}
	});

	test('selection never returns a model outside the authorised set', () => {
		const { index, cost } = documents();
		let chosen = 0;
		for (const configuration of configurations()) {
			for (const authorizedModels of [ALL_MODELS, ['vendor/small'], ['vendor/unpriced'], []]) {
				for (const requiredIndex of [0, 45, 95]) {
					const result = selectModel(configuration, index, cost, {
						requiredIndex,
						authorizedModels,
					});
					if (!result.ok) {
						continue;
					}
					chosen++;
					assert.ok(authorizedModels.includes(result.choice.model));
					assert.ok(result.choice.considered >= 1);
					assert.ok(result.choice.cost > 0);
					assert.strictEqual(result.choice.unit, 'usd-per-million-tokens');
				}
			}
		}
		assert.ok(chosen > 0, 'the enumeration must reach a selection');
	});

	test('a refused configuration never reaches the decision at all', () => {
		// The parser is the only gate: if it accepts a configuration missing the
		// pieces routing needs, the decision has to guess. These are the shapes
		// it must keep out.
		const refused = [
			{ maxModel: undefined },
			{ routerModel: undefined },
			{ intelligenceIndex: undefined },
			{ modelCost: undefined },
		];
		for (const override of refused) {
			const result = parseRouterConfiguration({
				contractVersion: 1,
				autopilotEnabled: true,
				persistSelectedModel: false,
				routerModel: 'vendor/small',
				maxModel: 'vendor/big',
				intelligenceIndex: REFERENCE,
				modelCost: COST_REFERENCE,
				timeoutMs: 1000,
				fallback: 'maxModel',
				promptPolicy: 'metadataOnly',
				...override,
			});
			assert.strictEqual(result.accepted, false, `${JSON.stringify(override)} should be refused`);
		}
	});
});
