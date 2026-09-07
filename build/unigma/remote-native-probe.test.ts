/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildNativeProbeArguments, buildNativeProbeScript, nativeReason, parseNativeReport, summarizeNativeReport } from './remote-native-probe.ts';

const healthy = [
	'native.node.packaged=true',
	'native.probe=ok',
	'native.module.@vscode/spdlog/build/Release/spdlog.node=loaded',
	'native.module.@vscode/deviceid/build/Release/windows.node=failed:EXIT_1:not-self-registered'
].join('\n');

describe('remote native probe', () => {
	it('keeps only lines the probe could have produced', () => {
		const parsed = parseNativeReport([
			'native.probe=ok',
			'native.module.a/b.node=loaded',
			'native.host=/home/someone/secret',
			'unrelated=value',
			'native.module.../escape.node=loaded'
		].join('\n'));
		assert.deepStrictEqual([...parsed.keys()].sort(), ['native.module.a/b.node', 'native.probe']);
	});

	it('passes when every rejection is a missing entry point', () => {
		const summary = summarizeNativeReport(parseNativeReport(healthy), 0);
		assert.strictEqual(summary.loaded, 1);
		assert.strictEqual(summary.unregistered, 1);
		assert.strictEqual(summary.rejected, 0);
		assert.ok(summary.checks.every(([, passed]) => passed));
	});

	it('fails when the host loader refuses an addon', () => {
		const report = `${healthy}\nnative.module.@vscode/watcher/build/Release/watcher.node=failed:ERR_DLOPEN_FAILED:version-mismatch:GLIBC_2.32`;
		const summary = summarizeNativeReport(parseNativeReport(report), 0);
		assert.strictEqual(summary.rejected, 1);
		assert.strictEqual(summary.checks.find(([name]) => name === 'native-modules')?.[1], false);
	});

	it('fails when the logger itself did not load', () => {
		const report = 'native.node.packaged=true\nnative.probe=ok\nnative.module.@vscode/spdlog/build/Release/spdlog.node=failed:ERR_DLOPEN_FAILED:missing-symbol:napi_x';
		const summary = summarizeNativeReport(parseNativeReport(report), 0);
		assert.strictEqual(summary.checks.find(([name]) => name === 'native-spdlog-loaded')?.[1], false);
	});

	it('fails when some other Node answered', () => {
		const summary = summarizeNativeReport(parseNativeReport(healthy.replace('packaged=true', 'packaged=false')), 0);
		assert.strictEqual(summary.checks.find(([name]) => name === 'native-probe-packaged-node')?.[1], false);
	});

	it('fails when no module was checked at all', () => {
		const summary = summarizeNativeReport(parseNativeReport('native.probe=ok\nnative.node.packaged=true'), 0);
		assert.strictEqual(summary.checks.find(([name]) => name === 'native-modules')?.[1], false);
		assert.strictEqual(summary.checks.find(([name]) => name === 'native-spdlog-checked')?.[1], false);
	});

	it('reads the failure category out of a report line', () => {
		assert.strictEqual(nativeReason('loaded'), 'loaded');
		assert.strictEqual(nativeReason('failed:ERR_DLOPEN_FAILED:abi-mismatch'), 'abi-mismatch');
		assert.strictEqual(nativeReason('failed'), 'unknown');
	});

	it('never lets the commit escape the quoting of the generated script', () => {
		const quote = String.fromCharCode(39);
		const script = buildNativeProbeScript(`a${quote}; rm -rf /; ${quote}`, '"$BASE/.unigma-server/$COMMIT"');
		assert.ok(script.includes(String.fromCharCode(39, 92, 39, 39)));
		assert.ok(!/\n\s*rm -rf/.test(script));
	});

	it('reports both OpenCode layouts as read-only facts, never as a gate', () => {
		const script = buildNativeProbeScript('b'.repeat(40), '$HOME/.unigma-server/bin/' + 'b'.repeat(40));

		// The desktop package writes <appRoot>/opencode/bin/opencode; the payload
		// staged on a host lands it as <appRoot>/bin/opencode. The probe answers
		// which one an activated version has, and does so with `[` tests only.
		assert.match(script, /native\.opencode\.desktop-layout=/);
		assert.match(script, /native\.opencode\.server-layout=/);
		for (const line of script.split('\n').filter(entry => entry.includes('opencode'))) {
			assert.doesNotMatch(line, /\b(rm|mv|cp|ln|mkdir|touch|chmod|chown|tee)\b/, line);
			assert.doesNotMatch(line, />[^&]/, line);
		}
	});

	it('asks the packaged Node of the requested version and writes nothing', () => {
		const script = buildNativeProbeScript('a'.repeat(40), '"$BASE/.unigma-server/$COMMIT"');
		assert.ok(script.includes('NODE="$VERSION_DIRECTORY/node"'));
		assert.ok(!/\b(mkdir|rm|mv|tar|cp)\b/.test(script));
	});

	it('reuses an existing control master without asking for a shell of its own', () => {
		const args = buildNativeProbeArguments('alias', '/tmp/control');
		assert.deepStrictEqual([...args], ['-o', 'ControlPath=/tmp/control', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'alias', '--', '/bin/sh']);
	});
});
