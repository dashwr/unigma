/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry, type ICommandService } from '../../../../../platform/commands/common/commands.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	ViewContainerLocation,
} from '../../../../common/views.js';
import { UNIGMA_AGENT_MANIFEST } from '../../browser/unigmaAgentManifest.js';
import { IUnigmaAgentRpcTransport, UNIGMA_AGENT_RUNTIME_TRANSPORT_COMMAND, UNIGMA_AGENT_RUNTIME_TRANSPORT_EVENT_COMMAND, UnigmaAgentRuntime, UnigmaAgentRuntimeConnectionState } from '../../browser/unigmaAgentRuntime.js';
import { EMPTY_UNIGMA_AGENT_SESSION, reduceUnigmaAgentSessionEvent, startUnigmaAgentSession } from '../../browser/unigmaAgentSession.js';
import { getUnigmaAgentStateAccessibility, UNIGMA_AGENT_VIEW_STATES, UnigmaAgentViewPane } from '../../browser/unigmaAgentView.js';
import { AGENT_PROTOCOL_VERSION, AgentCommandType, AgentErrorCode, AgentEventType, AgentResultStatus, AgentSessionState, validateAgentCommand } from '../../common/agentProtocol.js';

import '../../browser/unigmaAgent.contribution.js';

suite('Unigma Agent contribution', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('registers a native panel and start command', () => {
		const container = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).get(UNIGMA_AGENT_MANIFEST.containerId);
		if (!container) {
			assert.fail('Unigma Agent view container was not registered.');
		}

		assert.strictEqual(
			Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).getViewContainerLocation(container),
			ViewContainerLocation.Panel,
		);

		const view = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getView(UNIGMA_AGENT_MANIFEST.viewId);
		if (!view) {
			assert.fail('Unigma Agent view was not registered.');
		}

		assert.strictEqual(view.ctorDescriptor.ctor, UnigmaAgentViewPane);
		assert.strictEqual(view.openCommandActionDescriptor?.id, UNIGMA_AGENT_MANIFEST.openCommandId);
		assert.ok(CommandsRegistry.getCommand(UNIGMA_AGENT_MANIFEST.startCommandId));
		assert.deepStrictEqual(Object.values(UNIGMA_AGENT_VIEW_STATES), ['empty', 'loading', 'error', 'result']);
	});

	test('exposes coherent live-region semantics for agent states', () => {
		assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Empty), {});
		assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Loading), { role: 'status', live: 'polite', busy: true });
		assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Error), { role: 'alert', live: 'assertive', busy: false });
		assert.deepStrictEqual(getUnigmaAgentStateAccessibility(UNIGMA_AGENT_VIEW_STATES.Result), { role: 'status', live: 'polite', busy: false });
	});

	test('keeps an unregistered transport observably disconnected', async () => {
		const runtime = new UnigmaAgentRuntime();
		const events: unknown[] = [];
		const eventSubscription = runtime.onDidReceiveEvent(event => events.push(event));

		assert.strictEqual(runtime.connectionState, UnigmaAgentRuntimeConnectionState.Disconnected);
		await assert.rejects(runtime.start({ accepted: true }, 'file:///workspace'), /No unigma agent RPC transport is registered/);
		assert.deepStrictEqual(events, [{
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Error,
			requestId: 'unigma-agent-1',
			error: { code: AgentErrorCode.RuntimeUnavailable, message: 'No unigma agent RPC transport is registered.', retryable: true },
		}]);
		eventSubscription.dispose();
		runtime.dispose();
	});

	test('translates versioned transport events and propagates the created session to input', async () => {
		const received = new Emitter<unknown>();
		const sent: unknown[] = [];
		const transport: IUnigmaAgentRpcTransport = {
			onDidReceiveEvent: received.event,
			send: async command => { sent.push(command); },
		};
		const runtime = new UnigmaAgentRuntime();
		const events: unknown[] = [];
		const eventSubscription = runtime.onDidReceiveEvent(event => events.push(event));
		const registration = runtime.registerTransport(transport);

		assert.strictEqual(runtime.connectionState, UnigmaAgentRuntimeConnectionState.Connected);
		await runtime.start({ accepted: true }, 'file:///workspace');
		received.fire({ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.State, sessionId: 'session-1', state: AgentSessionState.Starting });
		await runtime.sendInput('session-1', 'Explain this change.');
		await runtime.stopSession('session-1');

		assert.deepStrictEqual(events, [{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.State, sessionId: 'session-1', state: AgentSessionState.Starting }]);
		assert.deepStrictEqual(sent, [
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-1', type: AgentCommandType.StartSession, workspaceUri: 'file:///workspace', localIntegrationPreflight: { accepted: true } },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-2', type: AgentCommandType.SendInput, sessionId: 'session-1', text: 'Explain this change.' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-3', type: AgentCommandType.StopSession, sessionId: 'session-1' },
		]);

		registration.dispose();
		assert.strictEqual(runtime.connectionState, UnigmaAgentRuntimeConnectionState.Disconnected);
		eventSubscription.dispose();
		runtime.dispose();
		received.dispose();
	});

	test('translates invalid transport events and send failures to protocol errors', async () => {
		const received = new Emitter<unknown>();
		const runtime = new UnigmaAgentRuntime();
		const events: unknown[] = [];
		const eventSubscription = runtime.onDidReceiveEvent(event => events.push(event));
		const registration = runtime.registerTransport({
			onDidReceiveEvent: received.event,
			send: async () => { throw new Error('offline'); },
		});

		received.fire({ version: 2, type: AgentEventType.State, sessionId: 'session-1', state: AgentSessionState.Running });
		await assert.rejects(runtime.sendInput('session-1', 'hello'), /The unigma agent RPC transport disconnected/);

		assert.deepStrictEqual(events, [
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Error, sessionId: 'session-1', error: { code: AgentErrorCode.UnsupportedVersion, message: 'Unsupported agent protocol version.', retryable: false } },
			{ version: AGENT_PROTOCOL_VERSION, type: AgentEventType.Error, requestId: 'unigma-agent-1', sessionId: 'session-1', error: { code: AgentErrorCode.ConnectionLost, message: 'The unigma agent RPC transport disconnected.', retryable: true } },
		]);

		registration.dispose();
		eventSubscription.dispose();
		runtime.dispose();
		received.dispose();
	});

	test('uses serializable commands and events for the extension-host bridge', async () => {
		const calls: unknown[][] = [];
		const commandService = {
			executeCommand: async (commandId: string, ...args: unknown[]) => {
				calls.push([commandId, ...args]);
				return undefined;
			},
		} as unknown as ICommandService;
		const runtime = new UnigmaAgentRuntime(commandService);
		const events: unknown[] = [];
		const eventSubscription = runtime.onDidReceiveEvent(event => events.push(event));

		await runtime.start({ accepted: true }, 'file:///workspace');

		assert.deepStrictEqual(calls, [[
			UNIGMA_AGENT_RUNTIME_TRANSPORT_COMMAND,
			{
				version: AGENT_PROTOCOL_VERSION,
				requestId: 'unigma-agent-1',
				type: AgentCommandType.StartSession,
				workspaceUri: 'file:///workspace',
				localIntegrationPreflight: { accepted: true },
			},
		]]);

		const eventCommand = CommandsRegistry.getCommand(UNIGMA_AGENT_RUNTIME_TRANSPORT_EVENT_COMMAND);
		if (!eventCommand) {
			assert.fail('event command must be registered');
		}
		eventCommand.handler(undefined as never, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.State,
			sessionId: 'session-1',
			state: AgentSessionState.Running,
		});
		assert.deepStrictEqual(events, [{
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.State,
			sessionId: 'session-1',
			state: AgentSessionState.Running,
		}]);

		eventSubscription.dispose();
		runtime.dispose();
	});

	test('serializes diff and approval commands the runtime bridge already implements', async () => {
		const calls: unknown[][] = [];
		const commandService = {
			executeCommand: async (commandId: string, ...args: unknown[]) => {
				calls.push([commandId, ...args]);
				return undefined;
			},
		} as unknown as ICommandService;
		const runtime = new UnigmaAgentRuntime(commandService);

		await runtime.requestDiff('session-1');
		await runtime.approve('session-1', 'approval-1');
		await runtime.reject('session-1', 'approval-2', 'Not this file.');
		await runtime.reject('session-1', 'approval-3');

		assert.deepStrictEqual(calls.map(call => call[0]), new Array(4).fill(UNIGMA_AGENT_RUNTIME_TRANSPORT_COMMAND));
		assert.deepStrictEqual(calls.map(call => call[1]), [
			// No diffId is sent: the documented OpenCode diff operation declares no such parameter.
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-1', type: AgentCommandType.RequestDiff, sessionId: 'session-1' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-2', type: AgentCommandType.Approve, sessionId: 'session-1', approvalId: 'approval-1' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-3', type: AgentCommandType.Reject, sessionId: 'session-1', approvalId: 'approval-2', reason: 'Not this file.' },
			{ version: AGENT_PROTOCOL_VERSION, requestId: 'unigma-agent-4', type: AgentCommandType.Reject, sessionId: 'session-1', approvalId: 'approval-3' },
		]);
		for (const call of calls) {
			assert.strictEqual(validateAgentCommand(call[1]).valid, true, 'every serialized command must satisfy the protocol validator');
		}

		runtime.dispose();
	});

	test('fails closed for diff and approval commands without a transport', async () => {
		const runtime = new UnigmaAgentRuntime();
		const events: unknown[] = [];
		const eventSubscription = runtime.onDidReceiveEvent(event => events.push(event));

		await assert.rejects(runtime.requestDiff('session-1'), /No unigma agent RPC transport is registered/);
		await assert.rejects(runtime.approve('session-1', 'approval-1'), /No unigma agent RPC transport is registered/);
		await assert.rejects(runtime.reject('session-1', 'approval-1', 'no'), /No unigma agent RPC transport is registered/);

		assert.deepStrictEqual(events, ['unigma-agent-1', 'unigma-agent-2', 'unigma-agent-3'].map(requestId => ({
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Error,
			requestId,
			sessionId: 'session-1',
			error: { code: AgentErrorCode.RuntimeUnavailable, message: 'No unigma agent RPC transport is registered.', retryable: true },
		})));

		eventSubscription.dispose();
		runtime.dispose();
	});

	test('does not expose runtime capabilities the bridge refuses', () => {
		const runtime = new UnigmaAgentRuntime();
		const surface = runtime as unknown as Record<string, unknown>;

		// The bridge answers both commands with an explicit error; the UI must not advertise them.
		assert.strictEqual(surface['listWorktrees'], undefined);
		assert.strictEqual(surface['applyConfiguration'], undefined);

		runtime.dispose();
	});

	test('reduces RPC session events without retaining another session', () => {
		const loading = startUnigmaAgentSession();
		const earlyResult = reduceUnigmaAgentSessionEvent(loading, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Result,
			sessionId: 'session-1',
			result: { status: AgentResultStatus.Completed, content: 'Old result.' },
		});
		const starting = reduceUnigmaAgentSessionEvent(loading, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.State,
			sessionId: 'session-1',
			state: AgentSessionState.Starting,
		});
		const result = reduceUnigmaAgentSessionEvent(starting, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Result,
			sessionId: 'session-1',
			result: { status: AgentResultStatus.Completed, content: 'Completed.' },
		});
		const ignored = reduceUnigmaAgentSessionEvent(result, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Error,
			sessionId: 'session-2',
			error: { code: AgentErrorCode.ConnectionLost, message: 'Lost.', retryable: true },
		});
		const stopped = reduceUnigmaAgentSessionEvent(result, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.State,
			sessionId: 'session-1',
			state: AgentSessionState.Stopped,
		});
		const lateResult = reduceUnigmaAgentSessionEvent(stopped, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Result,
			sessionId: 'session-1',
			result: { status: AgentResultStatus.Completed, content: 'Late result.' },
		});
		const lateError = reduceUnigmaAgentSessionEvent(loading, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Error,
			sessionId: 'session-1',
			error: { code: AgentErrorCode.ConnectionLost, message: 'Late error.', retryable: true },
		});

		assert.deepStrictEqual(EMPTY_UNIGMA_AGENT_SESSION, { state: UNIGMA_AGENT_VIEW_STATES.Empty });
		assert.strictEqual(earlyResult, loading);
		assert.deepStrictEqual(result, { state: UNIGMA_AGENT_VIEW_STATES.Result, sessionId: 'session-1', result: 'Completed.' });
		assert.strictEqual(ignored, result);
		assert.strictEqual(stopped, EMPTY_UNIGMA_AGENT_SESSION);
		assert.strictEqual(lateResult, stopped);
		assert.strictEqual(lateError, loading);
	});

	test('retires an approval only after the runtime reports the real reply', () => {
		const permission = { approvalId: 'per-1', kind: AgentApprovalKind.Tool, title: 'bash' };
		const started = reduceUnigmaAgentSessionEvent(startUnigmaAgentSession(), {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.State,
			sessionId: 'session-1',
			state: AgentSessionState.Starting,
		});
		const asked = reduceUnigmaAgentSessionEvent(started, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.Permission,
			sessionId: 'session-1',
			permission,
		});
		assert.deepStrictEqual(asked.permission, permission);

		// A reply for another approval or another session leaves the request pending.
		const otherApproval = reduceUnigmaAgentSessionEvent(asked, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.PermissionResolved,
			sessionId: 'session-1',
			resolution: { approvalId: 'per-2', reply: 'once' },
		});
		const otherSession = reduceUnigmaAgentSessionEvent(asked, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.PermissionResolved,
			sessionId: 'session-2',
			resolution: { approvalId: 'per-1', reply: 'once' },
		});
		assert.strictEqual(otherApproval, asked);
		assert.strictEqual(otherSession, asked);

		const replied = reduceUnigmaAgentSessionEvent(asked, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.PermissionResolved,
			sessionId: 'session-1',
			resolution: { approvalId: 'per-1', reply: 'reject' },
		});
		assert.strictEqual(Object.hasOwn(replied, 'permission'), false, 'the pending approval must be removed, not blanked');
		assert.strictEqual(replied.sessionId, 'session-1');
		assert.strictEqual(replied.state, asked.state);

		// A repeated reply is idempotent and never resurrects the approval.
		assert.strictEqual(reduceUnigmaAgentSessionEvent(replied, {
			version: AGENT_PROTOCOL_VERSION,
			type: AgentEventType.PermissionResolved,
			sessionId: 'session-1',
			resolution: { approvalId: 'per-1', reply: 'reject' },
		}), replied);
	});

	test('serializes Cancel clicks while stopSession is pending', async () => {
		let resolveStop!: () => void;
		let stopCalls = 0;
		const pane = Object.create(UnigmaAgentViewPane.prototype) as {
			model: { state: string; sessionId?: string };
			runtime: { stopSession(sessionId: string): Promise<void> };
			isStopping: boolean;
			disposed: boolean;
			stop(button: Button): Promise<void>;
		};
		pane.model = { state: UNIGMA_AGENT_VIEW_STATES.Loading, sessionId: 'session-1' };
		pane.isStopping = false;
		pane.disposed = false;
		pane.runtime = {
			stopSession: async sessionId => {
				stopCalls++;
				assert.strictEqual(sessionId, 'session-1');
				await new Promise<void>(resolve => { resolveStop = resolve; });
			},
		};
		const button = { enabled: true, label: 'Cancel', setAriaLabel: (_label: string) => undefined } as unknown as Button;

		const first = pane.stop(button);
		const second = pane.stop(button);
		assert.strictEqual(stopCalls, 1);
		assert.strictEqual(button.enabled, false);
		assert.strictEqual(button.label, 'Cancelling...');
		resolveStop();
		await Promise.all([first, second]);
		assert.strictEqual(pane.isStopping, true);
	});
});
