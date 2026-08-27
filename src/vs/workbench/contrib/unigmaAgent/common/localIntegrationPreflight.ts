/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { hasKey } from '../../../../base/common/types.js';
import { McpServerType, type IMcpServerConfiguration } from '../../../../platform/mcp/common/mcpPlatformTypes.js';
import { LocalMcpServerScope } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import type { AgentLocalIntegrationPreflight } from './agentProtocol.js';
import {
	evaluateLocalIntegration,
	type LocalIntegrationKind,
	type LocalIntegrationCommand,
	type LocalIntegrationDependency,
	type LocalIntegrationOAuth,
	type LocalIntegrationOrigin,
	type LocalIntegrationPath,
	type LocalIntegrationPrecedence,
	type LocalIntegrationSchema,
	type LocalIntegrationUrl,
	type LocalIntegrationRequest,
} from './localIntegrationPolicy.js';

/** Reduced local data before any decision crosses the transport. */
export interface WorkbenchMcpIntegrationSource {
	readonly name: string;
	readonly scope: LocalMcpServerScope;
	readonly config: IMcpServerConfiguration;
	readonly location?: URI;
	readonly approved: boolean;
}

/** Sanitized classification of a local plugin or rule source. */
export interface WorkbenchLocalIntegrationSource {
	readonly kind: Exclude<LocalIntegrationKind, 'mcp'>;
	readonly name: string;
	readonly origin: Exclude<LocalIntegrationOrigin, 'workspaceConfiguration' | 'globalConfiguration' | 'explicitLocalConfiguration'>;
	readonly path: LocalIntegrationPath;
	readonly schema: LocalIntegrationSchema;
	readonly command: LocalIntegrationCommand;
	readonly dependency: LocalIntegrationDependency;
	readonly url: LocalIntegrationUrl;
	readonly oauth: LocalIntegrationOAuth;
	readonly approved: boolean;
}

function isInside(parent: URI, child: URI): boolean {
	if (parent.scheme !== child.scheme) {
		return false;
	}
	const parentPath = parent.path.replace(/\/+$/, '') || '/';
	const childPath = child.path.replace(/\/+$/, '') || '/';
	return childPath === parentPath || childPath.startsWith(parentPath.endsWith('/') ? parentPath : `${parentPath}/`);
}

function pathFor(source: WorkbenchMcpIntegrationSource, workspaceUri: URI | undefined): LocalIntegrationPath {
	if (source.scope === LocalMcpServerScope.RemoteUser || !source.location) {
		return 'unavailable';
	}
	if (source.scope === LocalMcpServerScope.User) {
		return source.location.scheme === 'file' ? 'insideApprovedLocalPath' : 'unavailable';
	}
	if (!workspaceUri) {
		return 'unavailable';
	}
	return isInside(workspaceUri, source.location) ? 'insideWorkspace' : 'outsideApprovedScope';
}

function originFor(scope: LocalMcpServerScope): LocalIntegrationOrigin {
	switch (scope) {
		case LocalMcpServerScope.Workspace:
			return 'workspaceConfiguration';
		case LocalMcpServerScope.User:
			return 'globalConfiguration';
		case LocalMcpServerScope.RemoteUser:
			return 'remote';
		default:
			return 'unknown';
	}
}

function commandFor(command: string, args: readonly string[] | undefined): LocalIntegrationCommand {
	const executable = command.trim().split(/[\\/]/).pop()?.toLowerCase();
	const installers = new Set(['npx', 'npm', 'pnpm', 'yarn', 'bun', 'curl', 'wget', 'sh', 'bash', 'zsh', 'powershell', 'pwsh', 'cmd']);
	return executable && (installers.has(executable) || args?.some(arg => arg === '-y' || arg === '--yes'))
		? 'installer'
		: 'directExecutable';
}

function urlFor(url: string): LocalIntegrationUrl {
	try {
		const parsed = URI.parse(url);
		const authority = parsed.authority.toLowerCase();
		const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
		const host = hostPort.startsWith('[') ? hostPort.slice(1, hostPort.indexOf(']')) : hostPort.split(':')[0];
		if (parsed.scheme === 'https' && parsed.authority) {
			return 'https';
		}
		if (parsed.scheme === 'http' && parsed.authority) {
			return host === 'localhost' || host === '127.0.0.1' || host === '::1' ? 'loopbackHttp' : 'insecure';
		}
	} catch {
		// Unknown classification remains refused by policy.
	}
	return 'unknown';
}

function requestFor(source: WorkbenchMcpIntegrationSource, workspaceTrusted: boolean, workspaceUri: URI | undefined, precedence: LocalIntegrationPrecedence): LocalIntegrationRequest {
	const rawConfig = source.config as unknown;
	let schema: LocalIntegrationSchema = 'valid';
	let command: LocalIntegrationCommand = 'none';
	const dependency: LocalIntegrationDependency = 'none';
	let url: LocalIntegrationUrl = 'notApplicable';
	let oauth: 'notApplicable' | 'none' | 'interactive' | 'silent' = 'notApplicable';

	if (typeof rawConfig !== 'object' || rawConfig === null || !hasKey(rawConfig, { type: true })) {
		schema = 'invalid';
	} else if ((rawConfig as { readonly type?: unknown }).type === McpServerType.LOCAL) {
		const config = rawConfig as { command?: unknown; args?: unknown };
		if (typeof config.command !== 'string' || config.command.trim().length === 0 || (config.args !== undefined && !Array.isArray(config.args))) {
			schema = 'invalid';
		} else {
			command = commandFor(config.command, config.args as readonly string[] | undefined);
		}
	} else if ((rawConfig as { readonly type?: unknown }).type === McpServerType.REMOTE) {
		const config = rawConfig as { url?: unknown; oauth?: unknown };
		if (typeof config.url !== 'string' || config.url.trim().length === 0) {
			schema = 'invalid';
		} else {
			url = urlFor(config.url);
			oauth = config.oauth === undefined ? 'none' : 'silent';
		}
	} else {
		schema = 'invalid';
	}

	return {
		kind: 'mcp' as const,
		workspaceTrusted,
		approved: source.approved,
		origin: originFor(source.scope),
		path: pathFor(source, workspaceUri),
		schema,
		command,
		dependency,
		url,
		oauth,
		precedence,
	};
}

function requestForLocalSource(source: WorkbenchLocalIntegrationSource, workspaceTrusted: boolean, precedence: LocalIntegrationPrecedence): LocalIntegrationRequest {
	return {
		kind: source.kind,
		workspaceTrusted,
		approved: source.approved,
		origin: source.origin,
		path: source.path,
		schema: source.schema,
		command: source.command,
		dependency: source.dependency,
		url: source.url,
		oauth: source.oauth,
		precedence,
	};
}

export interface WorkbenchLocalIntegrationPreflightOptions {
	readonly workspaceTrusted: boolean;
	readonly workspaceUri?: URI;
	readonly servers: readonly WorkbenchMcpIntegrationSource[];
	readonly sources?: readonly WorkbenchLocalIntegrationSource[];
	/** False means plugin/rule discovery is incomplete; the session must stop. */
	readonly sourceInventoryComplete?: boolean;
}

/** Evaluates MCP, plugin, and rule sources with one set of gates and precedence. */
export function evaluateWorkbenchLocalIntegrationPreflight(options: WorkbenchLocalIntegrationPreflightOptions): AgentLocalIntegrationPreflight {
	if (!options.workspaceTrusted) {
		return { accepted: false, code: 'workspaceUntrusted' };
	}
	if (options.sourceInventoryComplete === false) {
		return { accepted: false, code: 'unknownOrigin' };
	}

	const sources = options.sources ?? [];
	const counts = new Map<string, number>();
	for (const server of options.servers) {
		counts.set(server.name, (counts.get(server.name) ?? 0) + 1);
	}
	for (const source of sources) {
		counts.set(source.name, (counts.get(source.name) ?? 0) + 1);
	}

	for (const server of options.servers) {
		const precedence: LocalIntegrationPrecedence = (counts.get(server.name) ?? 0) > 1 ? 'ambiguous' : 'explained';
		const decision = evaluateLocalIntegration(requestFor(server, options.workspaceTrusted, options.workspaceUri, precedence));
		if (!decision.accepted) {
			return { accepted: false, code: decision.code };
		}
	}
	for (const source of sources) {
		const precedence: LocalIntegrationPrecedence = (counts.get(source.name) ?? 0) > 1 ? 'ambiguous' : 'explained';
		const decision = evaluateLocalIntegration(requestForLocalSource(source, options.workspaceTrusted, precedence));
		if (!decision.accepted) {
			return { accepted: false, code: decision.code };
		}
	}

	return { accepted: true };
}

export function evaluateWorkbenchMcpPreflight(options: {
	readonly workspaceTrusted: boolean;
	readonly workspaceUri?: URI;
	readonly servers: readonly WorkbenchMcpIntegrationSource[];
}): AgentLocalIntegrationPreflight {
	return evaluateWorkbenchLocalIntegrationPreflight(options);
}
