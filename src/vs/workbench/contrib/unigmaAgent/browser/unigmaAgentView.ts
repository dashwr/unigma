/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { ProgressBar } from '../../../../base/browser/ui/progressbar/progressbar.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { defaultButtonStyles, defaultProgressBarStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IUnigmaAgentRuntime } from './unigmaAgentRuntime.js';
import { UNIGMA_AGENT_MANIFEST } from './unigmaAgentManifest.js';

export const UNIGMA_AGENT_VIEW_STATES = {
	Empty: 'empty',
	Loading: 'loading',
	Error: 'error',
} as const;

export type UnigmaAgentViewState = typeof UNIGMA_AGENT_VIEW_STATES[keyof typeof UNIGMA_AGENT_VIEW_STATES];

export class UnigmaAgentViewPane extends ViewPane {
	static readonly ID = UNIGMA_AGENT_MANIFEST.viewId;

	private readonly renderDisposables = this._register(new DisposableStore());
	private stateContainer: HTMLElement | undefined;
	private agentProgressBar: ProgressBar | undefined;
	private state: UnigmaAgentViewState = UNIGMA_AGENT_VIEW_STATES.Empty;
	private disposed = false;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IUnigmaAgentRuntime private readonly runtime: IUnigmaAgentRuntime,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		parent.classList.add('unigma-agent-view');
		parent.style.display = 'flex';
		parent.style.flexDirection = 'column';
		parent.style.overflow = 'auto';
		parent.style.padding = '0 16px 16px';

		const progressContainer = DOM.append(parent, DOM.$('.unigma-agent-progress'));
		progressContainer.style.width = '100%';
		this.agentProgressBar = this._register(new ProgressBar(progressContainer, {
			...defaultProgressBarStyles,
			ariaLabel: localize('unigmaAgent.progress', 'Preparing the agent'),
		}));
		this.agentProgressBar.hide();

		this.stateContainer = DOM.append(parent, DOM.$('.unigma-agent-state'));
		this.stateContainer.style.display = 'flex';
		this.stateContainer.style.flexDirection = 'column';
		this.stateContainer.style.alignItems = 'flex-start';
		this.stateContainer.style.padding = '20px 0';
		this.stateContainer.style.gap = '8px';
		this.renderState();
	}

	async start(): Promise<void> {
		if (this.state === UNIGMA_AGENT_VIEW_STATES.Loading) {
			return;
		}

		this.setState(UNIGMA_AGENT_VIEW_STATES.Loading);

		try {
			await this.runtime.start();
			if (!this.disposed) {
				// T-030 has no session surface yet, so a successful seam call returns to empty.
				this.setState(UNIGMA_AGENT_VIEW_STATES.Empty);
			}
		} catch {
			if (!this.disposed) {
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
			}
		}
	}

	private setState(state: UnigmaAgentViewState): void {
		this.state = state;
		if (!this.stateContainer || !this.agentProgressBar) {
			return;
		}

		this.element.dataset['state'] = state;
		this.renderState();
	}

	private renderState(): void {
		if (!this.stateContainer || !this.agentProgressBar) {
			return;
		}

		this.renderDisposables.clear();
		DOM.clearNode(this.stateContainer);
		this.agentProgressBar.stop().hide();
		this.stateContainer.setAttribute('role', this.state === UNIGMA_AGENT_VIEW_STATES.Error ? 'alert' : 'status');
		this.stateContainer.setAttribute('aria-live', 'polite');

		const title = DOM.append(this.stateContainer, DOM.$('h3'));
		title.style.margin = '0';
		title.textContent = this.state === UNIGMA_AGENT_VIEW_STATES.Empty
			? localize('unigmaAgent.emptyTitle', 'Ready when you are')
			: this.state === UNIGMA_AGENT_VIEW_STATES.Loading
				? localize('unigmaAgent.loadingTitle', 'Preparing the agent')
				: localize('unigmaAgent.errorTitle', 'Agent unavailable');

		const message = DOM.append(this.stateContainer, DOM.$('p'));
		message.style.margin = '0';
		message.style.color = 'var(--vscode-descriptionForeground)';
		message.textContent = this.state === UNIGMA_AGENT_VIEW_STATES.Empty
			? localize('unigmaAgent.emptyMessage', 'No agent session is active.')
			: this.state === UNIGMA_AGENT_VIEW_STATES.Loading
				? localize('unigmaAgent.loadingMessage', 'Waiting for the agent runtime...')
				: localize('unigmaAgent.errorMessage', 'The agent runtime is not connected yet.');

		if (this.state === UNIGMA_AGENT_VIEW_STATES.Loading) {
			this.agentProgressBar.infinite().show();
			return;
		}

		const actionContainer = DOM.append(this.stateContainer, DOM.$('.unigma-agent-action'));
		actionContainer.style.marginTop = '8px';
		const actionLabel = this.state === UNIGMA_AGENT_VIEW_STATES.Error
			? localize('unigmaAgent.retry', 'Try again')
			: localize('unigmaAgent.start', 'Start agent');
		const action = this.renderDisposables.add(new Button(actionContainer, { ...defaultButtonStyles, ariaLabel: actionLabel }));
		action.label = actionLabel;
		this.renderDisposables.add(action.onDidClick(() => void this.start()));
	}

	override dispose(): void {
		this.disposed = true;
		super.dispose();
	}
}
