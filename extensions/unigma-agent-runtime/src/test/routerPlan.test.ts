/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RouterConfiguration, RouterFallback } from '../domain/router/routerContract';
import { IntelligenceIndexDocument, ModelCostDocument } from '../domain/router/intelligenceIndex';
import { planRoute } from '../domain/router/routerPlan';

const reference = { source: 'docs/router/index.json', version: 1, revision: '2026-09-04' };

const INDEX: IntelligenceIndexDocument = {
	sourceVersion: 1,
	reference,
	entries: [
		{ model: 'vendor/small', index: 20 },
		{ model: 'vendor/medium', index: 50 },
		{ model: 'vendor/large', index: 80 }
	]
};

const COST: ModelCostDocument = {
	sourceVersion: 1,
	reference,
	unit: 'usd-per-million-tokens',
	entries: [
		{ model: 'vendor/small', input: 1, output: 2 },
		{ model: 'vendor/medium', input: 3, output: 6 },
		{ model: 'vendor/large', input: 10, output: 20 }
	]
};

const ALL = ['vendor/small', 'vendor/medium', 'vendor/large'];

function configuration(overrides: Partial<RouterConfiguration> = {}): RouterConfiguration {
	const base: RouterConfiguration = {
		contractVersion: 1,
		autopilotEnabled: true,
		promptPolicy: 'metadataOnly',
		fallback: 'maxModel' as RouterFallback,
		routerModel: 'vendor/router',
		maxModel: 'vendor/large',
		selectedModel: 'vendor/small',
		persistSelectedModel: false,
		timeoutMs: 2000,
		intelligenceIndex: reference,
		modelCost: reference
	};
	return { ...base, ...overrides };
}

suite('routerPlan', () => {
	test('an explicit selection wins over autopilot and never consults the router', () => {
		const result = planRoute(configuration(), INDEX, COST, {
			explicitSelection: 'vendor/small',
			outcome: { kind: 'answered', demand: { requiredIndex: 80, authorizedModels: ALL } }
		});

		assert.ok(result.ok);
		// The demand asks for the largest model and the user asked for the smallest.
		// The user wins: a pick is an instruction, not a hint the router may improve on.
		assert.strictEqual(result.plan.model, 'vendor/small');
		assert.strictEqual(result.plan.reason, 'explicitSelection');
		assert.strictEqual(result.plan.bypass, 'explicitSelection');
		assert.strictEqual(result.plan.considered, undefined);
	});

	test('a disabled autopilot uses the selected model and never falls back upwards', () => {
		const result = planRoute(configuration({ autopilotEnabled: false }), INDEX, COST, {
			outcome: { kind: 'answered', demand: { requiredIndex: 80, authorizedModels: ALL } }
		});

		assert.ok(result.ok);
		assert.strictEqual(result.plan.model, 'vendor/small');
		assert.strictEqual(result.plan.reason, 'autopilotDisabled');
		assert.strictEqual(result.plan.bypass, 'autopilotDisabled');
	});

	test('a disabled autopilot with nothing selected refuses instead of choosing', () => {
		const result = planRoute(
			configuration({ autopilotEnabled: false, selectedModel: undefined }),
			INDEX,
			COST,
			{ outcome: { kind: 'answered', demand: { requiredIndex: 20, authorizedModels: ALL } } }
		);

		assert.ok(!result.ok);
		assert.strictEqual(result.code, 'noSelectedModel');
		assert.strictEqual(result.bypass, 'autopilotDisabled');
	});

	test('routes when the router answered, and reports what it compared', () => {
		const result = planRoute(configuration(), INDEX, COST, {
			outcome: { kind: 'answered', demand: { requiredIndex: 50, authorizedModels: ALL } }
		});

		assert.ok(result.ok);
		assert.strictEqual(result.plan.model, 'vendor/medium');
		assert.strictEqual(result.plan.reason, 'routed');
		assert.strictEqual(result.plan.bypass, 'none');
		// medium and large reach the demand; small does not and is never compared.
		assert.strictEqual(result.plan.considered, 2);
	});

	test('a deadline that passed is reported apart from a router that was absent', () => {
		const timedOut = planRoute(configuration(), INDEX, COST, {
			outcome: { kind: 'timedOut', elapsedMs: 2100 }
		});
		const unavailable = planRoute(configuration(), INDEX, COST, {
			outcome: { kind: 'unavailable' }
		});

		assert.ok(timedOut.ok);
		assert.ok(unavailable.ok);
		// Both are served by the same model, and that is exactly why the reason has
		// to differ: one is a timeout worth tuning, the other is a router that is
		// not working, and a report that shows only the model hides the second.
		assert.strictEqual(timedOut.plan.model, 'vendor/large');
		assert.strictEqual(unavailable.plan.model, 'vendor/large');
		assert.strictEqual(timedOut.plan.reason, 'fallbackAfterTimeout');
		assert.strictEqual(unavailable.plan.reason, 'fallbackAfterUnavailable');
		assert.strictEqual(timedOut.plan.elapsedMs, 2100);
		assert.strictEqual(unavailable.plan.elapsedMs, undefined);
	});

	test('a refusal from the selection falls back under its own reason', () => {
		const result = planRoute(configuration(), INDEX, COST, {
			// Above the ceiling: the selection refuses rather than escalating.
			outcome: { kind: 'answered', demand: { requiredIndex: 95, authorizedModels: ALL } }
		});

		assert.ok(result.ok);
		assert.strictEqual(result.plan.model, 'vendor/large');
		assert.strictEqual(result.plan.reason, 'fallbackAfterRefusal');
		assert.strictEqual(result.plan.considered, undefined);
	});

	test('fallback refuse answers with a refusal rather than a model', () => {
		const result = planRoute(configuration({ fallback: 'refuse' }), INDEX, COST, {
			outcome: { kind: 'unavailable' }
		});

		assert.ok(!result.ok);
		assert.strictEqual(result.code, 'fallbackRefuses');
		assert.strictEqual(result.bypass, 'none');
	});

	test('fallback selectedModel does not silently become the ceiling', () => {
		const result = planRoute(configuration({ fallback: 'selectedModel' }), INDEX, COST, {
			outcome: { kind: 'timedOut', elapsedMs: 3000 }
		});

		assert.ok(result.ok);
		assert.strictEqual(result.plan.model, 'vendor/small');
	});

	test('a missing source is a router that could not answer, not a routed choice', () => {
		const noIndex = planRoute(configuration(), undefined, COST, {
			outcome: { kind: 'answered', demand: { requiredIndex: 50, authorizedModels: ALL } }
		});
		const noCost = planRoute(configuration(), INDEX, undefined, {
			outcome: { kind: 'answered', demand: { requiredIndex: 50, authorizedModels: ALL } }
		});

		assert.ok(noIndex.ok);
		assert.ok(noCost.ok);
		assert.strictEqual(noIndex.plan.reason, 'fallbackAfterUnavailable');
		assert.strictEqual(noCost.plan.reason, 'fallbackAfterUnavailable');
	});

	test('a fallback whose model is absent refuses instead of picking another', () => {
		const result = planRoute(
			configuration({ fallback: 'maxModel', maxModel: undefined }),
			INDEX,
			COST,
			{ outcome: { kind: 'unavailable' } }
		);

		assert.ok(!result.ok);
		assert.strictEqual(result.code, 'fallbackModelMissing');
	});

	test('the plan reads no clock, no network and nothing the user wrote', () => {
		const source = readFileSync(join(__dirname, '../../src/domain/router/routerPlan.ts'), 'utf8');

		for (const forbidden of [
			'Date.now',
			'setTimeout',
			'setInterval',
			'fetch(',
			'https://',
			'readFileSync',
			'process.env',
			'prompt'
		]) {
			assert.ok(!source.includes(forbidden), `routerPlan must not reference ${forbidden}`);
		}
	});
});
