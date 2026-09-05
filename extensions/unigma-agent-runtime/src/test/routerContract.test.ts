/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	ROUTER_CONTRACT_VERSION,
	bypassFor,
	parseRouterConfiguration,
	type RouterConfiguration,
} from '../domain/router/routerContract';

function manual(): Record<string, unknown> {
	return {
		contractVersion: ROUTER_CONTRACT_VERSION,
		autopilotEnabled: false,
		persistSelectedModel: true,
		selectedModel: 'anthropic/claude-sonnet-4',
		timeoutMs: 2_000,
		fallback: 'selectedModel',
		promptPolicy: 'metadataOnly',
	};
}

function autopilot(): Record<string, unknown> {
	return {
		contractVersion: ROUTER_CONTRACT_VERSION,
		autopilotEnabled: true,
		persistSelectedModel: false,
		routerModel: 'openai/luna-medium',
		maxModel: 'anthropic/claude-opus-5',
		intelligenceIndex: { source: 'router/index.json', version: 1, revision: '2026-09-01' },
		modelCost: { source: 'router/cost.json', version: 1, revision: '2026-09-01' },
		timeoutMs: 1_500,
		fallback: 'maxModel',
		promptPolicy: 'metadataOnly',
	};
}

function accept(input: Record<string, unknown>): RouterConfiguration {
	const result = parseRouterConfiguration(input);
	assert.strictEqual(result.accepted, true, `expected acceptance, got ${JSON.stringify(result)}`);
	assert.ok(result.accepted);
	return result.configuration;
}

function refusal(input: unknown): string {
	const result = parseRouterConfiguration(input);
	assert.strictEqual(result.accepted, false, `expected refusal for ${JSON.stringify(input)}`);
	assert.ok(!result.accepted);
	return result.code;
}

suite('router contract', () => {
	test('accepts a manual configuration and rebuilds only declared fields', () => {
		const configuration = accept(manual());

		assert.deepStrictEqual(Object.keys(configuration).sort(), [
			'autopilotEnabled',
			'contractVersion',
			'fallback',
			'intelligenceIndex',
			'maxModel',
			'modelCost',
			'persistSelectedModel',
			'promptPolicy',
			'routerModel',
			'selectedModel',
			'timeoutMs',
		]);
		assert.strictEqual(configuration.autopilotEnabled, false);
		assert.strictEqual(configuration.selectedModel, 'anthropic/claude-sonnet-4');
		assert.strictEqual(configuration.routerModel, undefined);
	});

	test('autopilot requires a router, a ceiling and both references', () => {
		accept(autopilot());

		const withoutRouter = autopilot();
		delete withoutRouter.routerModel;
		assert.strictEqual(refusal(withoutRouter), 'routerModelRequired');

		const withoutMax = autopilot();
		delete withoutMax.maxModel;
		assert.strictEqual(refusal(withoutMax), 'maxModelRequired');

		for (const field of ['intelligenceIndex', 'modelCost']) {
			const withoutReference = autopilot();
			delete withoutReference[field];
			assert.strictEqual(refusal(withoutReference), 'referenceRequired');
		}
	});

	test('a fallback names a model the configuration must actually carry', () => {
		const toSelected = autopilot();
		toSelected.fallback = 'selectedModel';
		assert.strictEqual(refusal(toSelected), 'selectedModelRequired');

		toSelected.selectedModel = 'anthropic/claude-sonnet-4';
		assert.strictEqual(accept(toSelected).fallback, 'selectedModel');

		const manualToMax = manual();
		manualToMax.fallback = 'maxModel';
		assert.strictEqual(refusal(manualToMax), 'maxModelRequired');

		const refusing = manual();
		refusing.fallback = 'refuse';
		assert.strictEqual(accept(refusing).fallback, 'refuse');

		const unknown = manual();
		unknown.fallback = 'cheapest';
		assert.strictEqual(refusal(unknown), 'invalidFallback');
	});

	test('persisting a selection requires a selection to persist', () => {
		const persistingNothing = manual();
		delete persistingNothing.selectedModel;
		persistingNothing.fallback = 'refuse';
		assert.strictEqual(refusal(persistingNothing), 'selectedModelRequired');
	});

	test('refuses anything that is not a bounded provider/model identifier', () => {
		for (const bad of [
			'',
			'claude-sonnet-4',
			'anthropic/',
			'/claude',
			'anthropic/claude sonnet',
			'https://example.invalid/model',
			'../../etc/passwd',
			'anthropic/claude\nsonnet',
			`anthropic/${'m'.repeat(200)}`,
			42,
			null,
		]) {
			const input = manual();
			input.selectedModel = bad;
			assert.strictEqual(refusal(input), 'invalidModelId', `accepted ${JSON.stringify(bad)}`);
		}
	});

	test('a reference must be local, versioned and revisioned', () => {
		for (const bad of [
			{ source: 'router/index.json', version: 1 },
			{ source: 'router/index.json', revision: 'r1' },
			{ source: '', version: 1, revision: 'r1' },
			{ source: '../outside/index.json', version: 1, revision: 'r1' },
			{ source: 'router/index.json', version: 0, revision: 'r1' },
			{ source: 'router/index.json', version: 1.5, revision: 'r1' },
			{ source: 'router/index.json', version: 1, revision: '' },
			{ source: 'router/index.json', version: 1, revision: 'r 1' },
			{ source: 'router/index.json', version: 1, revision: 'r1', url: 'https://example.invalid' },
			'router/index.json',
			['router/index.json'],
		]) {
			const input = autopilot();
			input.intelligenceIndex = bad;
			assert.strictEqual(refusal(input), 'invalidReference', `accepted ${JSON.stringify(bad)}`);
		}
	});

	test('refuses a prompt policy other than metadata', () => {
		for (const policy of ['full', 'excerpt', 'metadataonly', '', undefined, true]) {
			const input = manual();
			input.promptPolicy = policy;
			assert.strictEqual(refusal(input), 'invalidPromptPolicy');
		}
	});

	test('bounds the timeout on both ends and requires an integer', () => {
		for (const bad of [0, 10, 49, 30_001, -1, 1.5, '2000', null]) {
			const input = manual();
			input.timeoutMs = bad;
			assert.strictEqual(refusal(input), 'invalidTimeout', `accepted ${JSON.stringify(bad)}`);
		}
		for (const good of [50, 2_000, 30_000]) {
			const input = manual();
			input.timeoutMs = good;
			assert.strictEqual(accept(input).timeoutMs, good);
		}
	});

	test('refuses a foreign version, an unknown field and a non-object', () => {
		const wrongVersion = manual();
		wrongVersion.contractVersion = ROUTER_CONTRACT_VERSION + 1;
		assert.strictEqual(refusal(wrongVersion), 'unsupportedVersion');

		const fractional = manual();
		fractional.contractVersion = 1.5;
		assert.strictEqual(refusal(fractional), 'malformed');

		const smuggled = manual();
		smuggled.apiKey = 'sk-not-a-real-key';
		assert.strictEqual(refusal(smuggled), 'unexpectedField');

		for (const bad of [null, undefined, 'router', 7, [manual()]]) {
			assert.strictEqual(refusal(bad), 'malformed');
		}
	});

	test('separates an explicit pick from autopilot being off', () => {
		const routed = accept(autopilot());
		const manualConfiguration = accept(manual());

		assert.strictEqual(bypassFor(routed, false), 'none');
		assert.strictEqual(bypassFor(routed, true), 'explicitSelection');
		assert.strictEqual(bypassFor(manualConfiguration, false), 'autopilotDisabled');
		assert.strictEqual(bypassFor(manualConfiguration, true), 'explicitSelection');
	});

	test('holds no credential field and reaches no provider', () => {
		const source = readFileSync(
			join(__dirname, '../../src/domain/router/routerContract.ts'),
			'utf8'
		);

		for (const forbidden of [
			'apiKey',
			'token',
			'secret',
			'password',
			'Authorization',
			'fetch(',
			'https://',
			'process.env',
		]) {
			assert.ok(
				!source.includes(forbidden),
				`the router contract must not mention ${forbidden}`
			);
		}
	});
});
