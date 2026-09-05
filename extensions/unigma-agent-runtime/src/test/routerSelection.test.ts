/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RouterConfiguration } from '../domain/router/routerContract';
import { IntelligenceIndexDocument, ModelCostDocument } from '../domain/router/intelligenceIndex';
import { selectModel } from '../domain/router/routerSelection';

const reference = { source: 'docs/router/index.json', version: 1, revision: '2026-09-04' };

function indexOf(entries: readonly { model: string; index: number }[]): IntelligenceIndexDocument {
	return { sourceVersion: 1, reference, entries };
}

function costOf(entries: readonly { model: string; input: number; output: number }[]): ModelCostDocument {
	return { sourceVersion: 1, reference, unit: 'usd-per-million-tokens', entries };
}

function configurationWith(maxModel: string | undefined): RouterConfiguration {
	return {
		contractVersion: 1,
		autopilotEnabled: true,
		promptPolicy: 'metadataOnly',
		fallback: 'refuse',
		routerModel: 'vendor/router',
		maxModel,
		persistSelectedModel: false,
		timeoutMs: 2000,
		intelligenceIndex: reference,
		modelCost: reference
	};
}

const INDEX = indexOf([
	{ model: 'vendor/small', index: 20 },
	{ model: 'vendor/medium', index: 50 },
	{ model: 'vendor/large', index: 80 },
	{ model: 'vendor/huge', index: 95 }
]);

const COST = costOf([
	{ model: 'vendor/small', input: 1, output: 2 },
	{ model: 'vendor/medium', input: 3, output: 6 },
	{ model: 'vendor/large', input: 10, output: 20 },
	{ model: 'vendor/huge', input: 40, output: 80 }
]);

const ALL = ['vendor/small', 'vendor/medium', 'vendor/large', 'vendor/huge'];

suite('routerSelection', () => {
	test('picks the cheapest model that reaches the demand', () => {
		const result = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
			requiredIndex: 50,
			authorizedModels: ALL
		});

		assert.ok(result.ok);
		assert.strictEqual(result.choice.model, 'vendor/medium');
		assert.strictEqual(result.choice.cost, 9);
		assert.strictEqual(result.choice.unit, 'usd-per-million-tokens');
		// small is capable of less, so only three models were ever comparable.
		assert.strictEqual(result.choice.considered, 3);
	});

	test('never returns a model below the demand, however cheap it is', () => {
		const result = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
			requiredIndex: 90,
			authorizedModels: ALL
		});

		assert.ok(result.ok);
		assert.strictEqual(result.choice.model, 'vendor/huge');
	});

	test('treats maxModel as a ceiling, not as the model to use', () => {
		const result = selectModel(configurationWith('vendor/large'), INDEX, COST, {
			requiredIndex: 20,
			authorizedModels: ALL
		});

		assert.ok(result.ok);
		assert.strictEqual(result.choice.model, 'vendor/small');
		// huge is above the ceiling and must not even be compared.
		assert.strictEqual(result.choice.considered, 3);
	});

	test('refuses instead of escalating when the demand is above the ceiling', () => {
		const result = selectModel(configurationWith('vendor/medium'), INDEX, COST, {
			requiredIndex: 80,
			authorizedModels: ALL
		});

		assert.ok(!result.ok);
		assert.strictEqual(result.code, 'ceilingBelowDemand');
	});

	test('refuses a ceiling the index does not describe', () => {
		const missing = selectModel(configurationWith('vendor/unknown'), INDEX, COST, {
			requiredIndex: 20,
			authorizedModels: ALL
		});
		assert.ok(!missing.ok);
		assert.strictEqual(missing.code, 'ceilingNotIndexed');

		const absent = selectModel(configurationWith(undefined), INDEX, COST, {
			requiredIndex: 20,
			authorizedModels: ALL
		});
		assert.ok(!absent.ok);
		assert.strictEqual(absent.code, 'ceilingNotIndexed');
	});

	test('capability is not authorisation', () => {
		const result = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
			requiredIndex: 50,
			authorizedModels: ['vendor/large']
		});

		assert.ok(result.ok);
		// medium is cheaper and capable, but it was not authorised.
		assert.strictEqual(result.choice.model, 'vendor/large');

		const none = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
			requiredIndex: 50,
			authorizedModels: []
		});
		assert.ok(!none.ok);
		assert.strictEqual(none.code, 'noAuthorizedModel');
	});

	test('separates an unpriced model from a demand nothing can meet', () => {
		const partial = costOf([{ model: 'vendor/small', input: 1, output: 2 }]);

		const unpriced = selectModel(configurationWith('vendor/huge'), INDEX, partial, {
			requiredIndex: 50,
			authorizedModels: ALL
		});
		assert.ok(!unpriced.ok);
		assert.strictEqual(unpriced.code, 'costMissing');

		const impossible = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
			requiredIndex: 96,
			authorizedModels: ALL
		});
		assert.ok(!impossible.ok);
		assert.strictEqual(impossible.code, 'ceilingBelowDemand');

		const unreachable = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
			requiredIndex: 95,
			authorizedModels: ['vendor/small', 'vendor/medium']
		});
		assert.ok(!unreachable.ok);
		assert.strictEqual(unreachable.code, 'noCapableModel');
	});

	test('resolves an equal-cost tie the same way every time', () => {
		const tied = indexOf([
			{ model: 'vendor/beta', index: 60 },
			{ model: 'vendor/alpha', index: 55 },
			{ model: 'vendor/gamma', index: 55 },
			{ model: 'vendor/ceiling', index: 90 }
		]);
		const flat = costOf([
			{ model: 'vendor/beta', input: 2, output: 3 },
			{ model: 'vendor/alpha', input: 2, output: 3 },
			{ model: 'vendor/gamma', input: 2, output: 3 },
			{ model: 'vendor/ceiling', input: 9, output: 9 }
		]);
		const demand = {
			requiredIndex: 50,
			authorizedModels: ['vendor/beta', 'vendor/alpha', 'vendor/gamma', 'vendor/ceiling']
		};

		const first = selectModel(configurationWith('vendor/ceiling'), tied, flat, demand);
		assert.ok(first.ok);
		// Same cost, so the lower index wins; alpha and gamma tie there too, and
		// the identifier settles it.
		assert.strictEqual(first.choice.model, 'vendor/alpha');

		const reordered = selectModel(
			configurationWith('vendor/ceiling'),
			indexOf([...tied.entries].reverse()),
			flat,
			demand
		);
		assert.ok(reordered.ok);
		assert.strictEqual(reordered.choice.model, 'vendor/alpha');
	});

	test('refuses a demand that is not a measurement', () => {
		for (const requiredIndex of [Number.NaN, Number.POSITIVE_INFINITY, -1, '50' as unknown as number]) {
			const result = selectModel(configurationWith('vendor/huge'), INDEX, COST, {
				requiredIndex,
				authorizedModels: ALL
			});
			assert.ok(!result.ok);
			assert.strictEqual(result.code, 'invalidDemand');
		}
	});

	test('the decision reads nothing but its arguments', () => {
		const source = readFileSync(
			join(__dirname, '../../src/domain/router/routerSelection.ts'),
			'utf8'
		);

		for (const forbidden of ['fetch(', 'https://', 'readFileSync', 'process.env', 'prompt']) {
			assert.ok(
				!source.includes(forbidden),
				`the routing decision must not mention ${forbidden}`
			);
		}
	});
});
