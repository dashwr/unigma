/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type LocalIntegrationKind = 'mcp' | 'plugin' | 'rule';

/** Sanitized source classifications; no file path or configuration content crosses this boundary. */
export type LocalIntegrationOrigin = 'workspaceConfiguration' | 'globalConfiguration' | 'explicitLocalConfiguration' | 'workspacePluginDirectory' | 'globalPluginDirectory' | 'workspaceRule' | 'globalRule' | 'remote' | 'unknown';
export type LocalIntegrationPath = 'insideWorkspace' | 'insideApprovedLocalPath' | 'outsideApprovedScope' | 'externalSymlink' | 'unavailable';
export type LocalIntegrationSchema = 'valid' | 'invalid';
export type LocalIntegrationCommand = 'none' | 'directExecutable' | 'installer';
export type LocalIntegrationDependency = 'none' | 'npmPackage' | 'startupInstall';
export type LocalIntegrationUrl = 'notApplicable' | 'loopbackHttp' | 'https' | 'insecure' | 'unknown';
export type LocalIntegrationOAuth = 'notApplicable' | 'none' | 'interactive' | 'silent';
export type LocalIntegrationPrecedence = 'explained' | 'ambiguous';

/**
 * Facts established by the configuration boundary. They intentionally exclude paths,
 * command arguments, URLs, configuration, credentials, and rule contents.
 */
export interface LocalIntegrationRequest {
	readonly kind: LocalIntegrationKind;
	readonly workspaceTrusted: boolean;
	readonly approved: boolean;
	readonly origin: LocalIntegrationOrigin;
	readonly path: LocalIntegrationPath;
	readonly schema: LocalIntegrationSchema;
	readonly command: LocalIntegrationCommand;
	readonly dependency: LocalIntegrationDependency;
	readonly url: LocalIntegrationUrl;
	readonly oauth: LocalIntegrationOAuth;
	readonly precedence: LocalIntegrationPrecedence;
}

/** Metadata safe for UI state and structured diagnostics. */
export interface LocalIntegrationMetadata {
	readonly kind: LocalIntegrationKind;
	readonly origin: LocalIntegrationOrigin;
	readonly path: LocalIntegrationPath;
	readonly approval: 'approved' | 'missing';
}

export type LocalIntegrationRefusalCode =
	| 'workspaceUntrusted'
	| 'unknownOrigin'
	| 'ambiguousPrecedence'
	| 'pathOutsideApprovedScope'
	| 'externalSymlink'
	| 'pathUnavailable'
	| 'configurationInvalid'
	| 'installerCommand'
	| 'npmPlugin'
	| 'startupInstallation'
	| 'insecureUrl'
	| 'silentOAuth'
	| 'permissionDenied';

export type LocalIntegrationDecision =
	| { readonly accepted: true; readonly metadata: LocalIntegrationMetadata }
	| { readonly accepted: false; readonly code: LocalIntegrationRefusalCode; readonly metadata: LocalIntegrationMetadata };

function metadataFor(request: LocalIntegrationRequest): LocalIntegrationMetadata {
	return {
		kind: request.kind,
		origin: request.origin,
		path: request.path,
		approval: request.approved ? 'approved' : 'missing',
	};
}

function isExplicitOrigin(kind: LocalIntegrationKind, origin: LocalIntegrationOrigin): boolean {
	switch (kind) {
		case 'mcp':
			return origin === 'workspaceConfiguration' || origin === 'globalConfiguration' || origin === 'explicitLocalConfiguration';
		case 'plugin':
			return origin === 'workspacePluginDirectory' || origin === 'globalPluginDirectory';
		case 'rule':
			return origin === 'workspaceRule' || origin === 'globalRule';
	}
}

/**
 * Applies the preflight gates before a runtime may load, start, or connect an integration.
 * Startup integration belongs at ProcessManager.ensureStarted() in a later reviewed change.
 */
export function evaluateLocalIntegration(request: LocalIntegrationRequest): LocalIntegrationDecision {
	const metadata = metadataFor(request);
	const refuse = (code: LocalIntegrationRefusalCode): LocalIntegrationDecision => ({ accepted: false, code, metadata });

	if (!request.workspaceTrusted) {
		return refuse('workspaceUntrusted');
	}

	if (!isExplicitOrigin(request.kind, request.origin)) {
		return refuse('unknownOrigin');
	}

	if (request.precedence === 'ambiguous') {
		return refuse('ambiguousPrecedence');
	}

	switch (request.path) {
		case 'outsideApprovedScope': return refuse('pathOutsideApprovedScope');
		case 'externalSymlink': return refuse('externalSymlink');
		case 'unavailable': return refuse('pathUnavailable');
	}

	if (request.schema === 'invalid') {
		return refuse('configurationInvalid');
	}

	if (request.command === 'installer') {
		return refuse('installerCommand');
	}

	if (request.kind === 'plugin' && request.dependency === 'npmPackage') {
		return refuse('npmPlugin');
	}

	if (request.dependency === 'startupInstall') {
		return refuse('startupInstallation');
	}

	if (request.url === 'insecure' || request.url === 'unknown') {
		return refuse('insecureUrl');
	}

	if (request.oauth === 'silent') {
		return refuse('silentOAuth');
	}

	if (!request.approved) {
		return refuse('permissionDenied');
	}

	return { accepted: true, metadata };
}
