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
import { UNIGMA_AGENT_MANIFEST } from './unigmaAgentManifest.js';
import { IUnigmaAgentRuntime } from './unigmaAgentRuntime.js';
import {
	EMPTY_UNIGMA_AGENT_SESSION,
	reduceUnigmaAgentSessionEvent,
	startUnigmaAgentSession,
	UNIGMA_AGENT_VIEW_STATES,
	UnigmaAgentSessionViewModel,
} from './unigmaAgentSession.js';

export { UNIGMA_AGENT_VIEW_STATES } from './unigmaAgentSession.js';

export class UnigmaAgentViewPane extends ViewPane {
	static readonly ID = UNIGMA_AGENT_MANIFEST.viewId;

	private readonly renderDisposables = this._register(new DisposableStore());
	private stateContainer: HTMLElement | undefined;
	private agentProgressBar: ProgressBar | undefined;
	private model: UnigmaAgentSessionViewModel = EMPTY_UNIGMA_AGENT_SESSION;
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
		this._register(this.runtime.onDidReceiveEvent(event => {
			this.model = reduceUnigmaAgentSessionEvent(this.model, event);
			this.renderState();
		}));
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
		if (this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading) {
			return;
		}

		this.model = startUnigmaAgentSession();
		this.renderState();

		try {
			await this.runtime.start();
		} catch {
			if (!this.disposed) {
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
			}
		}
	}

	private setState(state: UnigmaAgentSessionViewModel['state']): void {
		this.model = { state, sessionId: this.model.sessionId };
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

		this.element.dataset['state'] = this.model.state;
		this.renderDisposables.clear();
		DOM.clearNode(this.stateContainer);
		this.agentProgressBar.stop().hide();
		this.stateContainer.setAttribute('role', this.model.state === UNIGMA_AGENT_VIEW_STATES.Error ? 'alert' : 'status');
		this.stateContainer.setAttribute('aria-live', 'polite');
		this.stateContainer.setAttribute('aria-busy', String(this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading));

		const title = DOM.append(this.stateContainer, DOM.$('h3'));
		title.style.margin = '0';
		title.textContent = this.model.state === UNIGMA_AGENT_VIEW_STATES.Empty
			? localize('unigmaAgent.emptyTitle', 'Ready when you are')
			: this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading
				? localize('unigmaAgent.loadingTitle', 'Preparing the agent')
				: this.model.state === UNIGMA_AGENT_VIEW_STATES.Result
					? localize('unigmaAgent.resultTitle', 'Agent result')
					: localize('unigmaAgent.errorTitle', 'Agent unavailable');

		const message = DOM.append(this.stateContainer, DOM.$('p'));
		message.style.margin = '0';
		message.style.color = 'var(--vscode-descriptionForeground)';
		message.textContent = this.model.state === UNIGMA_AGENT_VIEW_STATES.Empty
			? localize('unigmaAgent.emptyMessage', 'No agent session is active.')
			: this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading
				? localize('unigmaAgent.loadingMessage', 'Waiting for the agent runtime...')
				: this.model.state === UNIGMA_AGENT_VIEW_STATES.Result
					? this.model.result || localize('unigmaAgent.resultEmpty', 'The agent completed without a message.')
					: localize('unigmaAgent.errorMessage', 'The agent runtime is not connected yet.');

		if (this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading) {
			this.agentProgressBar.infinite().show();
			return;
		}

		this.renderInput();
		if (this.model.sessionId && this.model.state !== UNIGMA_AGENT_VIEW_STATES.Error) {
			return;
		}

		const actionContainer = DOM.append(this.stateContainer, DOM.$('.unigma-agent-action'));
		actionContainer.style.marginTop = '8px';
		const actionLabel = this.model.state === UNIGMA_AGENT_VIEW_STATES.Error
			? localize('unigmaAgent.retry', 'Try again')
			: localize('unigmaAgent.start', 'Start agent');
		const action = this.renderDisposables.add(new Button(actionContainer, { ...defaultButtonStyles, ariaLabel: actionLabel }));
		action.label = actionLabel;
		this.renderDisposables.add(action.onDidClick(() => void this.start()));
	}

	private renderInput(): void {
		const inputContainer = DOM.append(this.stateContainer!, DOM.$('.unigma-agent-input'));
		inputContainer.style.width = '100%';
		const input = DOM.append(inputContainer, DOM.$('textarea')) as HTMLTextAreaElement;
		input.rows = 3;
		input.placeholder = localize('unigmaAgent.inputPlaceholder', 'Ask the agent about this workspace');
		input.setAttribute('aria-label', localize('unigmaAgent.inputLabel', 'Agent input'));
		input.disabled = !this.model.sessionId;

		const submit = (): void => {
			const text = input.value.trim();
			if (!text || !this.model.sessionId) {
				return;
			}
			void this.runtime.sendInput(this.model.sessionId, text).then(() => input.value = '', () => this.setState(UNIGMA_AGENT_VIEW_STATES.Error));
		};
		this.renderDisposables.add(DOM.addDisposableListener(input, DOM.EventType.KEY_DOWN, (event: KeyboardEvent) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				submit();
			}
		}));
	}

	override dispose(): void {
		this.disposed = true;
		super.dispose();
	}
}
