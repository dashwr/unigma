/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
import { AGENT_PROTOCOL_VERSION, AgentCommandType, AgentErrorCode, AgentEventType, AgentResultStatus, AgentSessionState } from '../../common/agentProtocol.js';

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
});
