/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Upstream extensions that must not reach any unigma distribution.
 *
 * They bind the product to Microsoft and GitHub identity, endpoints and
 * accounts, which `AGENTS.md` forbids reusing. The list is shared so that the
 * desktop package, the remote server package and the distribution auditor
 * cannot drift apart: the desktop used to be the only one filtering, and the
 * server package shipped all three.
 */
export const distributionExcludedExtensions: readonly string[] = [
	'github',
	'github-authentication',
	'microsoft-authentication',
];

/**
 * Names that were distributed by an earlier build and must stay rejected.
 *
 * `tunnel-forwarding` was removed from the repository, so no build can emit it
 * any more, but a stale package or a reintroduction should still fail the
 * audit. Only the auditor consumes these: there is nothing left to filter.
 */
export const retiredExtensions: readonly string[] = [
	'tunnel-forwarding',
];
