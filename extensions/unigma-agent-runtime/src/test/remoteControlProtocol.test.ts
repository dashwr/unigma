/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	REMOTE_CONTROL_CAPABILITIES,
	REMOTE_CONTROL_PROTOCOL_ID,
	REMOTE_CONTROL_PROTOCOL_VERSION,
	parseRemoteControlEnvelope,
} from '../domain/remoteControlProtocol';

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		protocol: REMOTE_CONTROL_PROTOCOL_ID,
		version: REMOTE_CONTROL_PROTOCOL_VERSION,
		activation: 'dormant',
		capability: 'runtime.status',
		requestId: 'request-1',
		...overrides,
	};
}

suite('Unigma dormant remote control protocol', () => {
	test('accepts a well formed dormant envelope and returns only declared fields', () => {
		const result = parseRemoteControlEnvelope(envelope());

		assert.strictEqual(result.accepted, true);
		assert.ok(result.accepted);
		// Rebuilt rather than passed through, so an extra field cannot ride along
		// even if a future edit loosens the check above it.
		assert.deepStrictEqual(result.envelope, {
			protocol: REMOTE_CONTROL_PROTOCOL_ID,
			version: REMOTE_CONTROL_PROTOCOL_VERSION,
			activation: 'dormant',
			capability: 'runtime.status',
			requestId: 'request-1',
		});
	});

	test('refuses to be activated instead of ignoring the request', () => {
		for (const activation of ['active', 'listen', 'enabled', '']) {
			const result = parseRemoteControlEnvelope(envelope({ activation }));

			assert.strictEqual(result.accepted, false);
			assert.ok(!result.accepted);
			assert.strictEqual(result.code, 'activationNotSupported', `for ${JSON.stringify(activation)}`);
		}

		// Absent is not the same as dormant: a caller must say which it means.
		const missing = parseRemoteControlEnvelope({
			protocol: REMOTE_CONTROL_PROTOCOL_ID,
			version: REMOTE_CONTROL_PROTOCOL_VERSION,
			capability: 'runtime.status',
			requestId: 'request-1',
		});
		assert.ok(!missing.accepted);
		assert.strictEqual(missing.code, 'malformed');
	});

	test('refuses every version other than the one it implements', () => {
		for (const version of [0, 2, -1, 1.5, '1', null]) {
			const result = parseRemoteControlEnvelope(envelope({ version }));

			assert.ok(!result.accepted);
			const expected = typeof version === 'number' && Number.isInteger(version) ? 'unsupportedVersion' : 'malformed';
			assert.strictEqual(result.code, expected, `for ${JSON.stringify(version)}`);
		}
	});

	test('names the refusal for a foreign protocol, an unknown capability and an undeclared field', () => {
		const foreign = parseRemoteControlEnvelope(envelope({ protocol: 'unigma.agent.runtime' }));
		assert.ok(!foreign.accepted);
		assert.strictEqual(foreign.code, 'unknownProtocol');

		for (const capability of ['session.prompt', 'file.write', 'process.start', 'runtime.STATUS']) {
			const result = parseRemoteControlEnvelope(envelope({ capability }));
			assert.ok(!result.accepted);
			assert.strictEqual(result.code, 'unknownCapability', `for ${capability}`);
		}

		const smuggled = parseRemoteControlEnvelope(envelope({ token: 'secret' }));
		assert.ok(!smuggled.accepted);
		assert.strictEqual(smuggled.code, 'unexpectedField');
	});

	test('refuses anything that is not an object, and bounds the request id', () => {
		for (const value of [null, undefined, 42, 'envelope', [], [envelope()]]) {
			const result = parseRemoteControlEnvelope(value);
			assert.ok(!result.accepted);
			assert.strictEqual(result.code, 'malformed', `for ${JSON.stringify(value) ?? 'undefined'}`);
		}

		for (const requestId of ['', 'request 1', 'request\n1', 'a'.repeat(129), 42]) {
			const result = parseRemoteControlEnvelope(envelope({ requestId }));
			assert.ok(!result.accepted);
			assert.strictEqual(result.code, 'malformed', `for ${JSON.stringify(requestId)}`);
		}
	});

	test('declares no capability that produces an effect', () => {
		// The dormant contract is allowed to describe; it is not allowed to act.
		// This is asserted on the exported list rather than on prose, so widening
		// it later fails here instead of passing review unnoticed.
		assert.deepStrictEqual([...REMOTE_CONTROL_CAPABILITIES], ['runtime.status', 'session.list']);
	});

	test('the contract source contains no listener, socket, timer or storage', () => {
		const source = readFileSync(join(__dirname, '../../src/domain/remoteControlProtocol.ts'), 'utf8');

		// Inspecting the artifact is the only assertion that survives a refactor
		// which keeps every parser test green while quietly opening a port.
		for (const forbidden of [
			'createServer',
			'listen(',
			'require(',
			'import ',
			'net.',
			'http',
			'WebSocket',
			'setTimeout',
			'setInterval',
			'process.',
			'globalThis',
		]) {
			assert.ok(!source.includes(forbidden), `dormant protocol must not contain ${forbidden}`);
		}
	});
});
