/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { validateBootstrapManifest } from './bootstrapManifest.js';
import { createOpenSshVersionRunner, probeOpenSshClient } from './openSshClient.js';
import { stageRemotePayload, createRemotePayloadTarRunner, type RemoteStagingResult } from './remoteStagingTransfer.js';
import { createRemoteSshProcessRunner, openRemoteServer, type RemoteServerStagingSession, type RemoteServerSession } from './remoteServerTransport.js';
import { REMOTE_SSH_AUTHORITY_PREFIX } from './remoteSshAuthority.js';
import { CLIENT_COMMIT_UNAVAILABLE, isRemoteStagingConfirmed, isTransientRemoteSshFailure, REMOTE_SSH_STAGE_COMMAND_TITLE, resolveClientCommitFromProduct, resolveRemoteSsh, type RemoteSshResolverFailureCode, type RemoteSshResolverPhase } from './remoteSshResolver.js';
import { describeRemoteSshFailure, detectClientPlatform, type RemoteSshLocalObservation } from './remoteSshPreflight.js';

const STAGING_AVAILABLE_CONTEXT = 'unigma.remoteSsh.stagingAvailable';
const STAGE_COMMAND = 'unigma.remoteSsh.stageRemoteServer';
const STAGE_TITLE = REMOTE_SSH_STAGE_COMMAND_TITLE;

interface ActiveSession {
	readonly authority: string;
	readonly destination: string;
	readonly commit: string;
	readonly session: RemoteServerSession;
}

interface StagingLease {
	readonly authority: string;
	readonly destination: string;
	readonly commit: string;
	readonly session: RemoteServerStagingSession;
}

let outputChannel: vscode.OutputChannel | undefined;
const activeSessions = new Set<ActiveSession>();
const stagingLeases = new Map<string, StagingLease>();

/** Diagnostics carry category and phase only — never target, user, command or environment. */
function logDiagnostic(code: RemoteSshResolverFailureCode, phase: RemoteSshResolverPhase): void {
	outputChannel?.appendLine(`[${phase}] ${code}`);
}

function readProductJson(): unknown {
	const content = readFileSync(join(vscode.env.appRoot, 'product.json'), 'utf8');
	return JSON.parse(content) as unknown;
}

/** The build injects product.commit into appRoot/product.json; absent or malformed means no connection. */
function resolveRunningClientCommit() {
	try {
		return resolveClientCommitFromProduct(readProductJson());
	} catch {
		return { ok: false, code: CLIENT_COMMIT_UNAVAILABLE } as const;
	}
}

function allocateLocalPort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		const fail = (error: Error): void => reject(error);
		server.once('error', fail);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address() as AddressInfo | null;
			if (address === null) {
				server.close();
				reject(new Error('local port was not allocated'));
				return;
			}
			server.close(error => error ? reject(error) : resolve(address.port));
		});
	});
}

function setStagingContext(): void {
	void vscode.commands.executeCommand('setContext', STAGING_AVAILABLE_CONTEXT, stagingLeases.size > 0);
}

function replaceStagingLease(authority: string, lease: StagingLease): void {
	const previous = stagingLeases.get(authority);
	stagingLeases.set(authority, lease);
	setStagingContext();
	if (previous) {
		void previous.session.dispose();
	}
}

function failureMessage(code: RemoteSshResolverFailureCode, phase: RemoteSshResolverPhase): string {
	if (code === CLIENT_COMMIT_UNAVAILABLE) {
		return describeRemoteSshFailure(code);
	}
	if (code === 'ssh.remote-server-unavailable') {
		return describeRemoteSshFailure(code);
	}
	if (code === 'ssh.provisioning-denied') {
		return `${code}: remote server staging was refused during ${phase}.`;
	}
	return `${code}: remote SSH failed during ${phase}.`;
}

function reportFailure(code: RemoteSshResolverFailureCode, phase: RemoteSshResolverPhase): void {
	logDiagnostic(code, phase);
	void vscode.window.showErrorMessage(failureMessage(code, phase));
}

async function readSelectedManifest(uri: vscode.Uri): Promise<ReturnType<typeof validateBootstrapManifest>> {
	if (uri.scheme !== 'file') {
		return { valid: false, code: 'manifest-not-object' };
	}
	try {
		const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(uri, 'manifest.json'));
		return validateBootstrapManifest(JSON.parse(Buffer.from(bytes).toString('utf8')));
	} catch {
		return { valid: false, code: 'manifest-not-object' };
	}
}

async function stageRemoteServer(): Promise<void> {
	const authority = vscode.env.remoteAuthority;
	const lease = authority === undefined
		? stagingLeases.size === 1 ? [...stagingLeases.values()][0] : undefined
		: stagingLeases.get(authority);
	if (lease === undefined) {
		reportFailure('ssh.remote-server-unavailable', 'lifecycle');
		return;
	}

	const selected = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		canSelectFiles: false,
		canSelectMany: false,
		openLabel: 'Select Local Payload Directory',
		title: 'Select Local Payload Directory'
	});
	const payloadUri = selected?.[0];
	if (payloadUri === undefined) {
		return;
	}
	const validation = await readSelectedManifest(payloadUri);
	if (!validation.valid || validation.manifest.clientCommit.toLowerCase() !== lease.commit) {
		reportFailure('ssh.provisioning-denied', 'validation');
		return;
	}

	const result: RemoteStagingResult = await stageRemotePayload({
		destination: lease.destination,
		controlPath: lease.session.controlPath,
		payloadDirectory: payloadUri.fsPath,
		commit: lease.commit,
		manifest: validation.manifest,
		confirm: async summary => isRemoteStagingConfirmed(await vscode.window.showWarningMessage(
			`Stage the remote server on ${summary.host}?\nVersion: ${summary.version}\nTotal size: ${summary.totalSizeBytes} bytes\nManifest SHA-256: ${summary.manifestHash}`,
			{ modal: true },
			STAGE_TITLE
		))
	}, {
		spawn: createRemoteSshProcessRunner(),
		spawnPayloadTar: createRemotePayloadTarRunner(),
		diagnose: diagnostic => logDiagnostic(diagnostic.category, diagnostic.phase)
	});
	await lease.session.dispose();
	stagingLeases.delete(lease.authority);
	setStagingContext();
	if (!result.ok) {
		reportFailure(result.code === 'invalid-input' ? 'ssh.provisioning-denied' : result.code, result.phase);
		return;
	}
	void vscode.window.showInformationMessage(`Remote server ${result.status === 'already-activated' ? 'was already staged' : 'staged successfully'}.`);
}

export function activate(context: vscode.ExtensionContext): void {
	outputChannel = vscode.window.createOutputChannel('unigma Remote SSH');
	context.subscriptions.push(outputChannel);
	context.subscriptions.push(vscode.commands.registerCommand(STAGE_COMMAND, stageRemoteServer));

	context.subscriptions.push(vscode.workspace.registerRemoteAuthorityResolver(REMOTE_SSH_AUTHORITY_PREFIX, {
		async resolve(authority: string): Promise<vscode.ResolverResult> {
			const openSsh = await probeOpenSshClient(createOpenSshVersionRunner());
			const local: RemoteSshLocalObservation = {
				authority,
				workspaceTrusted: vscode.workspace.isTrusted,
				clientPlatform: detectClientPlatform(process.platform, process.arch),
				openSsh
			};
			const created: { value?: ActiveSession } = {};
			const result = await resolveRemoteSsh(local, {
				resolveClientCommit: resolveRunningClientCommit,
				openRemoteServer: async (input, onConnectionLost) => openRemoteServer(input, {
					allocateLocalPort,
					spawn: createRemoteSshProcessRunner(),
					diagnose: diagnostic => logDiagnostic(diagnostic.category, diagnostic.phase),
					onConnectionLost
				}),
				onConnectionLost: () => {
					if (created.value) {
						activeSessions.delete(created.value);
					}
				}
			});
			if (!result.ok) {
				if (result.stagingSession && result.destination !== undefined && result.commit !== undefined) {
					replaceStagingLease(authority, { authority, destination: result.destination, commit: result.commit, session: result.stagingSession });
				}
				reportFailure(result.code, result.phase);
				const message = failureMessage(result.code, result.phase);
				// The extension already showed the message, so `handled` keeps the
				// workbench from stacking a second notification saying the same thing.
				// The classification matters more: during reconnection the workbench
				// treats `NotAvailable` as final, so reporting a dropped channel that
				// way ended the window instead of letting it come back.
				throw isTransientRemoteSshFailure(result.code)
					? vscode.RemoteAuthorityResolverError.TemporarilyNotAvailable(message)
					: vscode.RemoteAuthorityResolverError.NotAvailable(message, true);
			}
			created.value = { authority, destination: result.destination, commit: result.commit, session: result.session };
			activeSessions.add(created.value);
			return new vscode.ResolvedAuthority(result.session.endpoint.host, result.session.endpoint.port);
		}
	}));
}

export function deactivate(): void {
	const sessions = [...activeSessions].map(entry => entry.session);
	activeSessions.clear();
	const staging = [...stagingLeases.values()].map(entry => entry.session);
	stagingLeases.clear();
	setStagingContext();
	void Promise.allSettled([...sessions, ...staging].map(session => session.dispose()));
}
