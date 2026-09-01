/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ConfigurationScope } from '../../../../platform/configuration/common/configuration.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	ViewContainerLocation,
} from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { UNIGMA_AGENT_MANIFEST } from './unigmaAgentManifest.js';
import { IUnigmaAgentRuntime, UnigmaAgentRuntime } from './unigmaAgentRuntime.js';
import { UnigmaAgentViewPane } from './unigmaAgentView.js';

registerSingleton(IUnigmaAgentRuntime, UnigmaAgentRuntime, InstantiationType.Delayed);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'unigma.agent',
	properties: {
		'unigma.agent.hiddenModels': {
			scope: ConfigurationScope.APPLICATION,
			type: 'array',
			items: { type: 'string' },
			default: [],
			description: localize('unigmaAgent.hiddenModels', 'Model IDs hidden from the Unigma Agent model panel.'),
		},
	},
});

const unigmaAgentIcon = registerIcon(
	'unigma-agent-view-icon',
	Codicon.commentDiscussion,
	localize('unigmaAgentViewIcon', 'View icon of the unigma agent.'),
);

const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

const viewContainer = viewContainersRegistry.registerViewContainer({
	id: UNIGMA_AGENT_MANIFEST.containerId,
	title: localize2('unigmaAgentContainer', 'Unigma Agent'),
	icon: unigmaAgentIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [UNIGMA_AGENT_MANIFEST.containerId, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: UNIGMA_AGENT_MANIFEST.containerId,
	hideIfEmpty: true,
	order: 4,
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

viewsRegistry.registerViews([{
	id: UNIGMA_AGENT_MANIFEST.viewId,
	name: localize2('unigmaAgentView', 'Unigma Agent'),
	containerIcon: unigmaAgentIcon,
	ctorDescriptor: new SyncDescriptor(UnigmaAgentViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	openCommandActionDescriptor: {
		id: UNIGMA_AGENT_MANIFEST.openCommandId,
		title: localize2('unigmaAgentOpen', 'Unigma Agent'),
		mnemonicTitle: localize({ key: 'miUnigmaAgentOpen', comment: ['&& denotes a mnemonic'] }, '&&Unigma Agent'),
		order: 4,
	},
}], viewContainer);

registerAction2(class StartUnigmaAgentAction extends Action2 {
	constructor() {
		super({
			id: UNIGMA_AGENT_MANIFEST.startCommandId,
			title: localize2('unigmaAgentStart', 'Start Agent'),
			category: localize2('unigmaAgentCategory', 'Unigma Agent'),
			f1: true,
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', UNIGMA_AGENT_MANIFEST.viewId),
				group: 'navigation',
				order: 1,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const view = await accessor.get(IViewsService).openView<UnigmaAgentViewPane>(UNIGMA_AGENT_MANIFEST.viewId, true);
		await view?.start();
	}
});
