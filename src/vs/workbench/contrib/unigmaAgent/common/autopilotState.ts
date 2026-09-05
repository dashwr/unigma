/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Reduction of the Autopilot signals into the states the native surface renders.
 *
 * This module holds no view, no DOM and no translation. It decides which state
 * is being shown and returns a stable message key; the view owns the wording,
 * because a reducer that produced localized text could not be asserted without
 * pinning the tests to one language.
 */

export const enum AutopilotStatus {
	/** Opt-in feature is off. The product routes nothing. */
	Disabled = 'disabled',
	/** Enabled and fully configured, waiting for a request. */
	Ready = 'ready',
	/** A routing decision is in flight. */
	Routing = 'routing',
	/** Autopilot chose the model that is about to serve. */
	Selected = 'selected',
	/** Something other than Autopilot chose: an explicit pick, or the feature being off. */
	Bypassed = 'bypassed',
	/** The router could not decide, so the configured fallback served instead. */
	FellBack = 'fellBack',
	/** No model will serve; the reader has to act. */
	Failed = 'failed',
	/** Routing would have sent what the user wrote to a model they did not choose. */
	PrivacyBlocked = 'privacyBlocked',
}

/** Reasons a decision can carry, mirroring the runtime router contract. */
export type AutopilotDecisionReason =
	| 'explicitSelection'
	| 'autopilotDisabled'
	| 'routed'
	| 'fallbackAfterTimeout'
	| 'fallbackAfterUnavailable'
	| 'fallbackAfterRefusal';

export type AutopilotSignal =
	| { readonly kind: 'idle'; readonly enabled: boolean; readonly configured: boolean }
	| { readonly kind: 'routing' }
	| {
		readonly kind: 'decided';
		readonly reason: AutopilotDecisionReason;
		readonly model: string;
		readonly elapsedMs?: number;
	}
	| { readonly kind: 'refused'; readonly code: string }
	| { readonly kind: 'privacyBlocked' };

/** How the surface should indicate progress, before movement preferences apply. */
export type AutopilotProgress = 'none' | 'indeterminate';

export interface AutopilotState {
	readonly status: AutopilotStatus;
	/** Present only when a model is actually going to serve. */
	readonly model?: string;
	readonly reason?: AutopilotDecisionReason;
	/** Present only on refusal, so the surface can explain what to fix. */
	readonly code?: string;
	/** Present only when a deadline was the cause, so a slow router is not read as a broken one. */
	readonly elapsedMs?: number;
	readonly progress: AutopilotProgress;
	/** True when the state asks something of the reader instead of merely reporting. */
	readonly actionable: boolean;
	/** Stable key; the view supplies the wording and the accessible name. */
	readonly messageKey: string;
}

const FALLBACK_REASONS: ReadonlySet<AutopilotDecisionReason> = new Set([
	'fallbackAfterTimeout',
	'fallbackAfterUnavailable',
	'fallbackAfterRefusal',
]);

const BYPASS_REASONS: ReadonlySet<AutopilotDecisionReason> = new Set([
	'explicitSelection',
	'autopilotDisabled',
]);

/**
 * Reduces one signal into the state to render.
 *
 * Every state that names a model carries it, and no state that does not name
 * one carries a stale value: a surface showing the previous model beside a
 * refusal reads as if that model is serving.
 */
export function autopilotStateFrom(signal: AutopilotSignal): AutopilotState {
	switch (signal.kind) {
		case 'idle':
			if (!signal.enabled) {
				return {
					status: AutopilotStatus.Disabled,
					progress: 'none',
					actionable: false,
					messageKey: 'unigma.autopilot.disabled',
				};
			}
			// Enabled without the sources that make routing possible is not "ready".
			// Reporting it as ready would put the failure at the first request instead
			// of at the setting the reader can still fix.
			if (!signal.configured) {
				return {
					status: AutopilotStatus.Failed,
					code: 'notConfigured',
					progress: 'none',
					actionable: true,
					messageKey: 'unigma.autopilot.notConfigured',
				};
			}
			return {
				status: AutopilotStatus.Ready,
				progress: 'none',
				actionable: false,
				messageKey: 'unigma.autopilot.ready',
			};

		case 'routing':
			return {
				status: AutopilotStatus.Routing,
				progress: 'indeterminate',
				actionable: false,
				messageKey: 'unigma.autopilot.routing',
			};

		case 'decided': {
			if (BYPASS_REASONS.has(signal.reason)) {
				return {
					status: AutopilotStatus.Bypassed,
					model: signal.model,
					reason: signal.reason,
					progress: 'none',
					actionable: false,
					messageKey: 'unigma.autopilot.bypassed',
				};
			}
			if (FALLBACK_REASONS.has(signal.reason)) {
				return {
					status: AutopilotStatus.FellBack,
					model: signal.model,
					reason: signal.reason,
					// A deadline is the only fallback whose duration means anything.
					...(signal.reason === 'fallbackAfterTimeout' && signal.elapsedMs !== undefined
						? { elapsedMs: signal.elapsedMs }
						: {}),
					progress: 'none',
					actionable: true,
					messageKey: 'unigma.autopilot.fellBack',
				};
			}
			return {
				status: AutopilotStatus.Selected,
				model: signal.model,
				reason: signal.reason,
				progress: 'none',
				actionable: false,
				messageKey: 'unigma.autopilot.selected',
			};
		}

		case 'refused':
			return {
				status: AutopilotStatus.Failed,
				code: signal.code,
				progress: 'none',
				actionable: true,
				messageKey: 'unigma.autopilot.failed',
			};

		case 'privacyBlocked':
			return {
				status: AutopilotStatus.PrivacyBlocked,
				progress: 'none',
				actionable: true,
				messageKey: 'unigma.autopilot.privacyBlocked',
			};
	}
}

/**
 * Movement the surface may use for a state.
 *
 * Reduced motion removes the animation and keeps the state, rather than hiding
 * the indicator: a reader who asked for less movement still needs to know that
 * something is in flight.
 */
export function autopilotAnimation(state: AutopilotState, reducedMotion: boolean): AutopilotProgress {
	return reducedMotion ? 'none' : state.progress;
}
