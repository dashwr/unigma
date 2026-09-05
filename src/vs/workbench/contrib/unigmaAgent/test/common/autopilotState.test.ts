/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	AutopilotSignal,
	AutopilotStatus,
	autopilotAnimation,
	autopilotStateFrom,
} from '../../common/autopilotState.js';

suite('Unigma Autopilot state', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('an opt-in feature that is off asks nothing of the reader', () => {
		const state = autopilotStateFrom({ kind: 'idle', enabled: false, configured: false });
		assert.strictEqual(state.status, AutopilotStatus.Disabled);
		assert.strictEqual(state.actionable, false);
		assert.strictEqual(state.progress, 'none');
		assert.strictEqual(state.model, undefined);
	});

	test('enabled without sources reports the gap instead of claiming readiness', () => {
		// Reporting this as ready would move the failure to the first request,
		// away from the setting that still explains it.
		const state = autopilotStateFrom({ kind: 'idle', enabled: true, configured: false });
		assert.strictEqual(state.status, AutopilotStatus.Failed);
		assert.strictEqual(state.code, 'notConfigured');
		assert.strictEqual(state.actionable, true);

		const ready = autopilotStateFrom({ kind: 'idle', enabled: true, configured: true });
		assert.strictEqual(ready.status, AutopilotStatus.Ready);
		assert.strictEqual(ready.actionable, false);
	});

	test('only a decision in flight reports progress', () => {
		assert.strictEqual(autopilotStateFrom({ kind: 'routing' }).progress, 'indeterminate');

		const settled: AutopilotSignal[] = [
			{ kind: 'idle', enabled: true, configured: true },
			{ kind: 'decided', reason: 'routed', model: 'vendor/mid' },
			{ kind: 'refused', code: 'noCapableModel' },
			{ kind: 'privacyBlocked' },
		];
		for (const signal of settled) {
			assert.strictEqual(autopilotStateFrom(signal).progress, 'none', signal.kind);
		}
	});

	test('a routed choice is told apart from a bypass and from a fallback', () => {
		const routed = autopilotStateFrom({ kind: 'decided', reason: 'routed', model: 'vendor/mid' });
		assert.strictEqual(routed.status, AutopilotStatus.Selected);
		assert.strictEqual(routed.model, 'vendor/mid');
		assert.strictEqual(routed.actionable, false);

		for (const reason of ['explicitSelection', 'autopilotDisabled'] as const) {
			const state = autopilotStateFrom({ kind: 'decided', reason, model: 'vendor/small' });
			assert.strictEqual(state.status, AutopilotStatus.Bypassed, reason);
			assert.strictEqual(state.reason, reason);
			assert.strictEqual(state.actionable, false, reason);
		}

		for (const reason of ['fallbackAfterTimeout', 'fallbackAfterUnavailable', 'fallbackAfterRefusal'] as const) {
			const state = autopilotStateFrom({ kind: 'decided', reason, model: 'vendor/big' });
			assert.strictEqual(state.status, AutopilotStatus.FellBack, reason);
			// A fallback served, but the reader should know Autopilot did not decide it.
			assert.strictEqual(state.actionable, true, reason);
		}
	});

	test('elapsed time is reported only when a deadline caused the fallback', () => {
		const timedOut = autopilotStateFrom({
			kind: 'decided', reason: 'fallbackAfterTimeout', model: 'vendor/big', elapsedMs: 900,
		});
		assert.strictEqual(timedOut.elapsedMs, 900);

		// A router that was never reachable has no meaningful duration; publishing
		// one would read as a router that was merely slow.
		const unavailable = autopilotStateFrom({
			kind: 'decided', reason: 'fallbackAfterUnavailable', model: 'vendor/big', elapsedMs: 900,
		});
		assert.strictEqual(unavailable.elapsedMs, undefined);
	});

	test('no state carries a model unless that model is going to serve', () => {
		const withoutModel: AutopilotSignal[] = [
			{ kind: 'idle', enabled: false, configured: false },
			{ kind: 'idle', enabled: true, configured: true },
			{ kind: 'routing' },
			{ kind: 'refused', code: 'ceilingBelowDemand' },
			{ kind: 'privacyBlocked' },
		];
		for (const signal of withoutModel) {
			assert.strictEqual(autopilotStateFrom(signal).model, undefined, signal.kind);
		}
	});

	test('a refusal and a privacy block both require the reader to act', () => {
		const refused = autopilotStateFrom({ kind: 'refused', code: 'costMissing' });
		assert.strictEqual(refused.status, AutopilotStatus.Failed);
		assert.strictEqual(refused.code, 'costMissing');
		assert.strictEqual(refused.actionable, true);

		const blocked = autopilotStateFrom({ kind: 'privacyBlocked' });
		assert.strictEqual(blocked.status, AutopilotStatus.PrivacyBlocked);
		assert.strictEqual(blocked.actionable, true);
		assert.strictEqual(blocked.code, undefined);
	});

	test('reduced motion removes the animation and keeps the state', () => {
		const routing = autopilotStateFrom({ kind: 'routing' });
		assert.strictEqual(autopilotAnimation(routing, false), 'indeterminate');
		assert.strictEqual(autopilotAnimation(routing, true), 'none');
		// The state itself is untouched, so the surface still reports that a
		// decision is in flight to a reader who asked for less movement.
		assert.strictEqual(routing.status, AutopilotStatus.Routing);
	});

	test('every state carries its own message key', () => {
		const signals: AutopilotSignal[] = [
			{ kind: 'idle', enabled: false, configured: false },
			{ kind: 'idle', enabled: true, configured: false },
			{ kind: 'idle', enabled: true, configured: true },
			{ kind: 'routing' },
			{ kind: 'decided', reason: 'routed', model: 'vendor/mid' },
			{ kind: 'decided', reason: 'explicitSelection', model: 'vendor/mid' },
			{ kind: 'decided', reason: 'fallbackAfterTimeout', model: 'vendor/big' },
			{ kind: 'refused', code: 'noAuthorizedModel' },
			{ kind: 'privacyBlocked' },
		];
		const keys = new Set(signals.map(signal => autopilotStateFrom(signal).messageKey));
		assert.strictEqual(keys.size, 9);
		for (const key of keys) {
			assert.ok(key.startsWith('unigma.autopilot.'), key);
		}
	});
});
