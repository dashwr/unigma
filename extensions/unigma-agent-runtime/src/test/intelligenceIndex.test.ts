/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	ROUTER_SOURCE_VERSION,
	eligibleModels,
	parseIntelligenceIndex,
	parseModelCost,
} from '../domain/router/intelligenceIndex';

const reference = { source: 'router/index.json', version: 1, revision: '2026-09-04' };

function indexDocument(entries: unknown): unknown {
	return { sourceVersion: ROUTER_SOURCE_VERSION, reference, entries };
}

function costDocument(entries: unknown, unit: unknown = 'usd-per-million-tokens'): unknown {
	return { sourceVersion: ROUTER_SOURCE_VERSION, reference, unit, entries };
}

suite('intelligence index source', () => {
	test('accepts a source and keeps the reference that produced it', () => {
		const result = parseIntelligenceIndex(
			indexDocument([
				{ model: 'acme/small', index: 12 },
				{ model: 'acme/large', index: 47.5 },
			]),
		);
		assert.strictEqual(result.accepted, true);
		if (!result.accepted) {
			return;
		}
		assert.deepStrictEqual(result.document.reference, reference);
		assert.deepStrictEqual(result.document.entries, [
			{ model: 'acme/small', index: 12 },
			{ model: 'acme/large', index: 47.5 },
		]);
	});

	test('refuses a source from another version instead of reading it partially', () => {
		for (const sourceVersion of [0, 2, 99]) {
			const result = parseIntelligenceIndex({
				sourceVersion,
				reference,
				entries: [{ model: 'acme/small', index: 1 }],
			});
			assert.strictEqual(result.accepted, false);
			if (!result.accepted) {
				assert.strictEqual(result.code, 'unsupportedSourceVersion');
			}
		}
	});

	test('refuses a source that cannot say where it came from', () => {
		for (const bad of [
			undefined,
			{ source: 'router/index.json', version: 1 },
			{ source: '../../etc/passwd', version: 1, revision: 'r1' },
			{ source: 'router/index.json', version: 0, revision: 'r1' },
		]) {
			const result = parseIntelligenceIndex({
				sourceVersion: ROUTER_SOURCE_VERSION,
				reference: bad,
				entries: [{ model: 'acme/small', index: 1 }],
			});
			assert.strictEqual(result.accepted, false);
			if (!result.accepted) {
				assert.strictEqual(result.code, 'invalidReference');
			}
		}
	});

	test('refuses an empty source rather than reporting an empty ranking', () => {
		const result = parseIntelligenceIndex(indexDocument([]));
		assert.strictEqual(result.accepted, false);
		if (!result.accepted) {
			assert.strictEqual(result.code, 'noEntries');
		}
	});

	test('refuses an index that is not a real measurement', () => {
		for (const index of [Number.NaN, Number.POSITIVE_INFINITY, -1, '49', null]) {
			const result = parseIntelligenceIndex(indexDocument([{ model: 'acme/small', index }]));
			assert.strictEqual(result.accepted, false);
			if (!result.accepted) {
				assert.strictEqual(result.code, 'invalidIndex');
			}
		}
	});

	test('refuses two rows for one model instead of letting file order decide', () => {
		const result = parseIntelligenceIndex(
			indexDocument([
				{ model: 'acme/small', index: 10 },
				{ model: 'acme/small', index: 40 },
			]),
		);
		assert.strictEqual(result.accepted, false);
		if (!result.accepted) {
			assert.strictEqual(result.code, 'duplicateModel');
		}
	});

	test('refuses a model identifier that looks like a path or a url', () => {
		for (const model of ['../secrets', 'https://host/model', 'acme', '', 'acme/../x']) {
			const result = parseIntelligenceIndex(indexDocument([{ model, index: 1 }]));
			assert.strictEqual(result.accepted, false);
			if (!result.accepted) {
				assert.strictEqual(result.code, 'invalidModel');
			}
		}
	});

	test('refuses an undeclared field on the document and on an entry', () => {
		const onDocument = parseIntelligenceIndex({
			sourceVersion: ROUTER_SOURCE_VERSION,
			reference,
			entries: [{ model: 'acme/small', index: 1 }],
			apiKey: 'x',
		});
		assert.strictEqual(onDocument.accepted, false);
		if (!onDocument.accepted) {
			assert.strictEqual(onDocument.code, 'unexpectedField');
		}

		const onEntry = parseIntelligenceIndex(
			indexDocument([{ model: 'acme/small', index: 1, endpoint: 'https://host' }]),
		);
		assert.strictEqual(onEntry.accepted, false);
		if (!onEntry.accepted) {
			assert.strictEqual(onEntry.code, 'unexpectedField');
		}
	});
});

suite('model cost source', () => {
	test('accepts a priced table and keeps its unit', () => {
		const result = parseModelCost(
			costDocument([{ model: 'acme/small', input: 0.25, output: 1.25 }]),
		);
		assert.strictEqual(result.accepted, true);
		if (!result.accepted) {
			return;
		}
		assert.strictEqual(result.document.unit, 'usd-per-million-tokens');
		assert.deepStrictEqual(result.document.entries, [
			{ model: 'acme/small', input: 0.25, output: 1.25 },
		]);
	});

	test('refuses a cost table with no unit, because the reader would supply one', () => {
		const absent = parseModelCost({
			sourceVersion: ROUTER_SOURCE_VERSION,
			reference,
			entries: [{ model: 'acme/small', input: 1, output: 2 }],
		});
		assert.strictEqual(absent.accepted, false);
		if (!absent.accepted) {
			assert.strictEqual(absent.code, 'missingUnit');
		}

		for (const unit of ['', 42, null]) {
			const result = parseModelCost(
				costDocument([{ model: 'acme/small', input: 1, output: 2 }], unit),
			);
			assert.strictEqual(result.accepted, false);
			if (!result.accepted) {
				assert.strictEqual(result.code, 'missingUnit');
			}
		}
	});

	test('refuses a half-priced row instead of reading the other direction as free', () => {
		for (const entry of [
			{ model: 'acme/small', input: 1 },
			{ model: 'acme/small', output: 1 },
			{ model: 'acme/small', input: 1, output: -1 },
			{ model: 'acme/small', input: Number.NaN, output: 1 },
		]) {
			const result = parseModelCost(costDocument([entry]));
			assert.strictEqual(result.accepted, false);
			if (!result.accepted) {
				assert.ok(
					result.code === 'invalidCost' || result.code === 'unexpectedField',
					`unexpected code ${result.code}`,
				);
			}
		}
	});
});

suite('router source eligibility', () => {
	test('treats a model as eligible only when both sources describe it', () => {
		const index = parseIntelligenceIndex(
			indexDocument([
				{ model: 'acme/small', index: 10 },
				{ model: 'acme/large', index: 50 },
				{ model: 'acme/unpriced', index: 90 },
			]),
		);
		const cost = parseModelCost(
			costDocument([
				{ model: 'acme/small', input: 1, output: 2 },
				{ model: 'acme/large', input: 3, output: 4 },
				{ model: 'acme/unranked', input: 5, output: 6 },
			]),
		);
		assert.strictEqual(index.accepted, true);
		assert.strictEqual(cost.accepted, true);
		if (!index.accepted || !cost.accepted) {
			return;
		}
		assert.deepStrictEqual(eligibleModels(index.document, cost.document), [
			'acme/large',
			'acme/small',
		]);
	});
});

suite('router source artifact', () => {
	test('never reaches a network, a catalogue or a credential', () => {
		const source = readFileSync(
			join(__dirname, '../../src/domain/router/intelligenceIndex.ts'),
			'utf8',
		);
		for (const forbidden of [
			'fetch(',
			'https://',
			'http://',
			'readFileSync',
			'process.env',
			'apiKey',
			'Authorization',
		]) {
			assert.ok(
				!source.includes(forbidden),
				`the source must not mention ${forbidden}`,
			);
		}
	});
});
