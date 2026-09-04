/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkspaceReference } from '../domain/runtime';
import type {
	TransportLocalIntegrationInventory,
	TransportLocalIntegrationOrigin,
	TransportLocalIntegrationSource,
} from '../application/transport';

const PLUGIN_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts']);
const CONFIG_NAMES = ['opencode.json', 'opencode.jsonc'] as const;

interface SourceOptions {
	readonly kind: 'plugin' | 'rule';
	readonly name: string;
	readonly origin: TransportLocalIntegrationOrigin;
	readonly path: TransportLocalIntegrationSource['path'];
}

export interface LocalIntegrationInventoryOptions {
	readonly homeDirectory?: string;
	readonly environment?: NodeJS.ProcessEnv;
	readonly isApproved?: (source: Omit<TransportLocalIntegrationSource, 'approved'>) => boolean;
}

interface JsonObject {
	readonly [key: string]: unknown;
}

function isInside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripJsonComments(value: string): string {
	let result = '';
	let inString = false;
	let escaped = false;
	let inLineComment = false;
	let inBlockComment = false;
	for (let index = 0; index < value.length; index++) {
		const character = value[index];
		const next = value[index + 1];
		if (inLineComment) {
			if (character === '\n' || character === '\r') {
				inLineComment = false;
				result += character;
			} else {
				result += ' ';
			}
			continue;
		}
		if (inBlockComment) {
			if (character === '*' && next === '/') {
				inBlockComment = false;
				result += '  ';
				index++;
			} else {
				result += character === '\n' || character === '\r' ? character : ' ';
			}
			continue;
		}
		if (!inString && character === '/' && next === '/') {
			inLineComment = true;
			result += '  ';
			index++;
			continue;
		}
		if (!inString && character === '/' && next === '*') {
			inBlockComment = true;
			result += '  ';
			index++;
			continue;
		}
		result += character;
		if (character === '\\' && inString) {
			escaped = !escaped;
		} else {
			escaped = false;
		}
		if (character === '"' && !escaped) {
			inString = !inString;
		}
	}
	return result.replace(/,\s*([}\]])/g, '$1');
}

function sourceWithApproval(source: Omit<TransportLocalIntegrationSource, 'approved'>, isApproved: LocalIntegrationInventoryOptions['isApproved']): TransportLocalIntegrationSource {
	return { ...source, approved: isApproved?.(source) === true };
}

function sourceName(filePath: string): string {
	return path.basename(filePath).replace(/\.(?:cjs|js|mjs|ts)$/i, '');
}

function configuredPluginName(value: string, index: number): string {
	return /^@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)?$/i.test(value)
		? value
		: `configured-plugin-${index + 1}`;
}

function sourcePath(scopeRoot: string, target: string, insidePath: TransportLocalIntegrationSource['path']): TransportLocalIntegrationSource['path'] {
	return isInside(scopeRoot, target) ? insidePath : 'outsideApprovedScope';
}

async function classifyFile(filePath: string, scopeRoot: string, options: SourceOptions): Promise<Omit<TransportLocalIntegrationSource, 'approved'>> {
	try {
		const stat = await lstat(filePath);
		const resolved = await realpath(filePath);
		const filePathClass = stat.isSymbolicLink() && !isInside(scopeRoot, resolved)
			? 'externalSymlink'
			: sourcePath(scopeRoot, resolved, options.path);
		return {
			kind: options.kind,
			name: options.name,
			origin: options.origin,
			path: filePathClass,
			schema: 'valid',
			command: 'none',
			dependency: 'none',
			url: 'notApplicable',
			oauth: 'notApplicable',
		};
	} catch {
		return {
			kind: options.kind,
			name: options.name,
			origin: options.origin,
			path: 'unavailable',
			schema: 'valid',
			command: 'none',
			dependency: 'none',
			url: 'notApplicable',
			oauth: 'notApplicable',
		};
	}
}

async function scanPluginDirectory(directory: string, scopeRoot: string, origin: TransportLocalIntegrationOrigin, isApproved: LocalIntegrationInventoryOptions['isApproved']): Promise<TransportLocalIntegrationSource[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		throw error;
	}
	const sources: TransportLocalIntegrationSource[] = [];
	for (const entry of entries) {
		if (!entry.isFile() && !entry.isSymbolicLink()) {
			continue;
		}
		if (!PLUGIN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
			continue;
		}
		const source = await classifyFile(path.join(directory, entry.name), scopeRoot, {
			kind: 'plugin',
			name: sourceName(entry.name),
			origin,
			path: origin === 'workspacePluginDirectory' ? 'insideWorkspace' : 'insideApprovedLocalPath',
		});
		sources.push(sourceWithApproval(source, isApproved));
	}
	return sources;
}

async function scanWorkspaceRules(directory: string, scopeRoot: string, isApproved: LocalIntegrationInventoryOptions['isApproved'], visited = new Set<string>()): Promise<TransportLocalIntegrationSource[]> {
	let resolvedDirectory: string;
	try {
		resolvedDirectory = await realpath(directory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		throw error;
	}
	if (visited.has(resolvedDirectory)) {
		return [];
	}
	visited.add(resolvedDirectory);
	let entries: Dirent[];
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		throw error;
	}
	const sources: TransportLocalIntegrationSource[] = [];
	for (const entry of entries) {
		if (entry.name === '.git' || entry.name === 'node_modules') {
			continue;
		}
		const entryPath = path.join(directory, entry.name);
		if (entry.isSymbolicLink() && entry.name === 'AGENTS.md') {
			const source = await classifyFile(entryPath, scopeRoot, {
				kind: 'rule',
				name: entry.name,
				origin: 'workspaceRule',
				path: 'insideWorkspace',
			});
			sources.push(sourceWithApproval(source, isApproved));
			continue;
		}
		if (entry.isSymbolicLink()) {
			try {
				if ((await stat(entryPath)).isDirectory()) {
					const resolved = await realpath(entryPath);
					if (isInside(scopeRoot, resolved)) {
						sources.push(...await scanWorkspaceRules(entryPath, scopeRoot, isApproved, visited));
						continue;
					}
					const source = await classifyFile(entryPath, scopeRoot, {
						kind: 'rule',
						name: 'AGENTS.md',
						origin: 'workspaceRule',
						path: 'insideWorkspace',
					});
					if (source.path === 'externalSymlink') {
						sources.push(sourceWithApproval(source, isApproved));
					}
				}
			} catch {
				const source = await classifyFile(entryPath, scopeRoot, {
					kind: 'rule',
					name: 'AGENTS.md',
					origin: 'workspaceRule',
					path: 'insideWorkspace',
				});
				sources.push(sourceWithApproval(source, isApproved));
			}
			continue;
		}
		if (entry.isFile() || entry.isSymbolicLink()) {
			if (entry.name === 'AGENTS.md') {
				const source = await classifyFile(entryPath, scopeRoot, {
					kind: 'rule',
					name: entry.name,
					origin: 'workspaceRule',
					path: 'insideWorkspace',
				});
				sources.push(sourceWithApproval(source, isApproved));
			}
			continue;
		}
		if (entry.isDirectory()) {
			sources.push(...await scanWorkspaceRules(entryPath, scopeRoot, isApproved, visited));
		}
	}
	return sources;
}

function configScope(configPath: string, workspaceRoot: string, globalRoot: string): { readonly origin: TransportLocalIntegrationOrigin; readonly root: string } {
	if (isInside(workspaceRoot, configPath)) {
		return { origin: 'workspaceRule', root: workspaceRoot };
	}
	if (isInside(globalRoot, configPath)) {
		return { origin: 'globalRule', root: globalRoot };
	}
	return { origin: 'unknown', root: path.dirname(configPath) };
}

async function readConfig(configPath: string): Promise<{ readonly exists: boolean; readonly config?: JsonObject }> {
	let value: string;
	try {
		value = (await readFile(configPath, 'utf8')).toString();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { exists: false };
		}
		throw error;
	}
	try {
		const parsed: unknown = JSON.parse(stripJsonComments(value));
		return isRecord(parsed) ? { exists: true, config: parsed } : { exists: true };
	} catch {
		return { exists: true };
	}
}

async function scanConfig(configPath: string, workspaceRoot: string, globalRoot: string, isApproved: LocalIntegrationInventoryOptions['isApproved']): Promise<{ readonly sources: readonly TransportLocalIntegrationSource[]; readonly complete: boolean }> {
	const loaded = await readConfig(configPath);
	if (!loaded.exists) {
		return { sources: [], complete: true };
	}
	if (!loaded.config) {
		return { sources: [], complete: false };
	}
	const scope = configScope(configPath, workspaceRoot, globalRoot);
	const sources: TransportLocalIntegrationSource[] = [];
	const configuredPlugins = loaded.config.plugin;
	if (configuredPlugins !== undefined) {
		if (!Array.isArray(configuredPlugins) || !configuredPlugins.every(plugin => typeof plugin === 'string' && plugin.trim().length > 0)) {
			return { sources: [], complete: false };
		}
		for (const [index, plugin] of configuredPlugins.entries()) {
			const source: Omit<TransportLocalIntegrationSource, 'approved'> = {
				kind: 'plugin' as const,
				name: configuredPluginName(plugin.trim(), index),
				origin: scope.origin === 'workspaceRule' ? 'workspacePluginDirectory' : scope.origin === 'globalRule' ? 'globalPluginDirectory' : 'unknown',
				path: scope.origin === 'workspaceRule' ? 'insideWorkspace' : scope.origin === 'globalRule' ? 'insideApprovedLocalPath' : 'unavailable',
				schema: 'valid' as const,
				command: 'none' as const,
				dependency: 'npmPackage' as const,
				url: 'notApplicable' as const,
				oauth: 'notApplicable' as const,
			};
			sources.push(sourceWithApproval(source, isApproved));
		}
	}
	const instructions = loaded.config.instructions;
	if (instructions === undefined) {
		return { sources, complete: true };
	}
	const references = typeof instructions === 'string' ? [instructions] : Array.isArray(instructions) ? instructions : undefined;
	if (!references || !references.every(reference => typeof reference === 'string' && reference.trim().length > 0)) {
		return { sources, complete: false };
	}
	for (const reference of references) {
		if (/[\*?\[\]]/.test(reference)) {
			return { sources, complete: false };
		}
		const target = path.resolve(path.dirname(configPath), reference);
		const source = await classifyFile(target, scope.root, {
			kind: 'rule',
			name: path.basename(target),
			origin: scope.origin,
			path: scope.origin === 'workspaceRule' ? 'insideWorkspace' : 'insideApprovedLocalPath',
		});
		sources.push(sourceWithApproval(source, isApproved));
	}
	return { sources, complete: true };
}

export async function enumerateLocalIntegrations(workspace: WorkspaceReference, options: LocalIntegrationInventoryOptions = {}): Promise<TransportLocalIntegrationInventory> {
	let workspaceRoot: string;
	try {
		workspaceRoot = await realpath(fileURLToPath(workspace.uri));
	} catch {
		return { complete: false, sources: [] };
	}
	const homeRoot = options.homeDirectory ?? homedir();
	const globalRoot = path.join(homeRoot, '.config', 'opencode');
	const sources: TransportLocalIntegrationSource[] = [];
	let complete = true;
	try {
		sources.push(...await scanPluginDirectory(path.join(workspaceRoot, '.opencode', 'plugins'), workspaceRoot, 'workspacePluginDirectory', options.isApproved));
		sources.push(...await scanPluginDirectory(path.join(globalRoot, 'plugins'), globalRoot, 'globalPluginDirectory', options.isApproved));
		sources.push(...await scanWorkspaceRules(workspaceRoot, workspaceRoot, options.isApproved));
		const globalRule = path.join(globalRoot, 'AGENTS.md');
		try {
			const globalRuleStat = await lstat(globalRule);
			if (globalRuleStat.isFile() || globalRuleStat.isSymbolicLink()) {
				const source = await classifyFile(globalRule, globalRoot, { kind: 'rule', name: 'AGENTS.md', origin: 'globalRule', path: 'insideApprovedLocalPath' });
				sources.push(sourceWithApproval(source, options.isApproved));
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				complete = false;
			}
		}
		const configPaths = new Set<string>();
		for (const name of CONFIG_NAMES) {
			configPaths.add(path.join(workspaceRoot, name));
			configPaths.add(path.join(globalRoot, name));
		}
		const environment = options.environment ?? process.env;
		if (environment.OPENCODE_CONFIG) {
			configPaths.add(path.resolve(workspaceRoot, environment.OPENCODE_CONFIG));
		}
		if (environment.OPENCODE_CONFIG_DIR) {
			for (const name of CONFIG_NAMES) {
				configPaths.add(path.resolve(workspaceRoot, environment.OPENCODE_CONFIG_DIR, name));
			}
		}
		for (const configPath of configPaths) {
			const result = await scanConfig(configPath, workspaceRoot, globalRoot, options.isApproved);
			sources.push(...result.sources);
			complete &&= result.complete;
		}
	} catch {
		complete = false;
	}
	return { complete, sources };
}
