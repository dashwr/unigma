/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	ViewContainerLocation,
} from '../../../../common/views.js';
import { UNIGMA_AGENT_MANIFEST } from '../../browser/unigmaAgentManifest.js';
import { UnigmaAgentRuntimePlaceholder } from '../../browser/unigmaAgentRuntime.js';
import { UNIGMA_AGENT_VIEW_STATES, UnigmaAgentViewPane } from '../../browser/unigmaAgentView.js';

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
		assert.ok(CommandsRegistry.getCommand(UNIGMA_AGENT_MANIFEST.startCommandId));
		assert.deepStrictEqual(Object.values(UNIGMA_AGENT_VIEW_STATES), ['empty', 'loading', 'error']);
	});

	test('placeholder reports unavailable without starting a runtime', async () => {
		await assert.rejects(
			() => new UnigmaAgentRuntimePlaceholder().start(),
			/The unigma agent runtime is not available yet\./,
		);
	});
});
