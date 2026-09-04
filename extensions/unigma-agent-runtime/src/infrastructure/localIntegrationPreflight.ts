/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	TransportLocalIntegrationInventory,
	TransportLocalIntegrationPreflight,
	TransportLocalIntegrationSource,
} from '../application/transport';

function refusal(source: TransportLocalIntegrationSource): TransportLocalIntegrationPreflight {
	if (source.origin === 'unknown') {
		return { accepted: false, code: 'unknownOrigin' };
	}
	if ((source.kind === 'plugin' && source.origin !== 'workspacePluginDirectory' && source.origin !== 'globalPluginDirectory')
		|| (source.kind === 'rule' && source.origin !== 'workspaceRule' && source.origin !== 'globalRule')) {
		return { accepted: false, code: 'unknownOrigin' };
	}
	if (source.path === 'outsideApprovedScope') {
		return { accepted: false, code: 'pathOutsideApprovedScope' };
	}
	if (source.path === 'externalSymlink') {
		return { accepted: false, code: 'externalSymlink' };
	}
	if (source.path === 'unavailable') {
		return { accepted: false, code: 'pathUnavailable' };
	}
	if (source.schema === 'invalid') {
		return { accepted: false, code: 'configurationInvalid' };
	}
	if (source.command === 'installer') {
		return { accepted: false, code: 'installerCommand' };
	}
	if (source.kind === 'plugin' && source.dependency === 'npmPackage') {
		return { accepted: false, code: 'npmPlugin' };
	}
	if (source.dependency === 'startupInstall') {
		return { accepted: false, code: 'startupInstallation' };
	}
	if (source.url === 'insecure' || source.url === 'unknown') {
		return { accepted: false, code: 'insecureUrl' };
	}
	if (source.oauth === 'silent') {
		return { accepted: false, code: 'silentOAuth' };
	}
	if (!source.approved) {
		return { accepted: false, code: 'permissionDenied' };
	}
	return { accepted: true };
}

/** Rechecks only sanitized inventory facts immediately before process startup. */
export function evaluateRuntimeLocalIntegrationPreflight(inventory: TransportLocalIntegrationInventory): TransportLocalIntegrationPreflight {
	if (!inventory.complete) {
		return { accepted: false, code: 'unknownOrigin' };
	}
	const names = new Set<string>();
	for (const source of inventory.sources) {
		if (names.has(source.name)) {
			return { accepted: false, code: 'ambiguousPrecedence' };
		}
		names.add(source.name);
	}
	for (const source of inventory.sources) {
		const decision = refusal(source);
		if (!decision.accepted) {
			return decision;
		}
	}
	return { accepted: true };
}
