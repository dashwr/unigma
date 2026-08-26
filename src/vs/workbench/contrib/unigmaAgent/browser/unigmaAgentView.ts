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

export function getUnigmaAgentStateAccessibility(state: UnigmaAgentSessionViewModel['state']): { readonly role?: string; readonly live?: string; readonly busy?: boolean } {
	switch (state) {
		case UNIGMA_AGENT_VIEW_STATES.Loading:
			return { role: 'status', live: 'polite', busy: true };
		case UNIGMA_AGENT_VIEW_STATES.Error:
			return { role: 'alert', live: 'assertive', busy: false };
		case UNIGMA_AGENT_VIEW_STATES.Result:
			return { role: 'status', live: 'polite', busy: false };
		default:
			return {};
	}
}

export class UnigmaAgentViewPane extends ViewPane {
	static readonly ID = UNIGMA_AGENT_MANIFEST.viewId;

	private readonly renderDisposables = this._register(new DisposableStore());
	private stateContainer: HTMLElement | undefined;
	private agentProgressBar: ProgressBar | undefined;
	private model: UnigmaAgentSessionViewModel = EMPTY_UNIGMA_AGENT_SESSION;
	private inputValue = '';
	private isSubmitting = false;
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
		this.stateContainer.tabIndex = -1;
		this.renderState();
	}

	async start(): Promise<void> {
		if (this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading) {
			return;
		}

		this.model = startUnigmaAgentSession();
		this.renderState();
		this.stateContainer?.focus();

		try {
			await this.runtime.start();
		} catch {
			if (!this.disposed) {
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
				this.stateContainer?.focus();
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
		const accessibility = getUnigmaAgentStateAccessibility(this.model.state);
		for (const [attribute, value] of [['role', accessibility.role], ['aria-live', accessibility.live], ['aria-busy', accessibility.busy === undefined ? undefined : String(accessibility.busy)]]) {
			if (value === undefined) {
				this.stateContainer.removeAttribute(attribute);
			} else {
				this.stateContainer.setAttribute(attribute, value);
			}
		}
		this.stateContainer.style.borderLeft = this.model.state === UNIGMA_AGENT_VIEW_STATES.Error
			? '2px solid var(--vscode-inputValidation-errorBorder)'
			: this.model.state === UNIGMA_AGENT_VIEW_STATES.Result
				? '2px solid var(--vscode-testing-iconPassed)'
				: '';
		this.stateContainer.style.paddingLeft = this.model.state === UNIGMA_AGENT_VIEW_STATES.Error || this.model.state === UNIGMA_AGENT_VIEW_STATES.Result ? '8px' : '';

		const title = DOM.append(this.stateContainer, DOM.$('h3'));
		title.style.margin = '0';
		title.style.color = this.model.state === UNIGMA_AGENT_VIEW_STATES.Error
			? 'var(--vscode-errorForeground)'
			: this.model.state === UNIGMA_AGENT_VIEW_STATES.Result
				? 'var(--vscode-testing-iconPassed)'
				: '';
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
		inputContainer.style.display = 'flex';
		inputContainer.style.flexDirection = 'column';
		inputContainer.style.alignItems = 'flex-start';
		inputContainer.style.gap = '8px';
		inputContainer.setAttribute('aria-busy', String(this.isSubmitting));
		const input = DOM.append(inputContainer, DOM.$('textarea')) as HTMLTextAreaElement;
		input.rows = 3;
		input.placeholder = localize('unigmaAgent.inputPlaceholder', 'Ask the agent about this workspace');
		input.setAttribute('aria-label', localize('unigmaAgent.inputLabel', 'Agent input'));
		input.style.width = '100%';
		input.style.boxSizing = 'border-box';
		input.style.backgroundColor = 'var(--vscode-input-background)';
		input.style.color = 'var(--vscode-input-foreground)';
		input.style.borderColor = 'var(--vscode-input-border)';
		input.value = this.inputValue;
		input.disabled = !this.model.sessionId || this.isSubmitting;

		const submitLabel = this.isSubmitting
			? localize('unigmaAgent.sending', 'Sending...')
			: localize('unigmaAgent.submit', 'Send');
		const submitButton = this.renderDisposables.add(new Button(inputContainer, {
			...defaultButtonStyles,
			ariaLabel: submitLabel,
			disabled: !this.model.sessionId || this.isSubmitting || !this.inputValue.trim(),
		}));
		submitButton.label = submitLabel;

		const submit = (): void => {
			const text = input.value.trim();
			if (!text || !this.model.sessionId || this.isSubmitting) {
				return;
			}
			this.inputValue = input.value;
			this.isSubmitting = true;
			input.disabled = true;
			inputContainer.setAttribute('aria-busy', 'true');
			submitButton.enabled = false;
			submitButton.label = localize('unigmaAgent.sending', 'Sending...');
			submitButton.setAriaLabel(localize('unigmaAgent.sending', 'Sending...'));
			void this.runtime.sendInput(this.model.sessionId, text).then(() => {
				this.inputValue = '';
				this.isSubmitting = false;
				input.value = '';
				input.disabled = false;
				inputContainer.setAttribute('aria-busy', 'false');
			}, () => {
				this.isSubmitting = false;
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
				this.stateContainer?.focus();
			});
		};
		this.renderDisposables.add(DOM.addDisposableListener(input, DOM.EventType.INPUT, () => {
			this.inputValue = input.value;
			submitButton.enabled = !!this.model.sessionId && !this.isSubmitting && !!this.inputValue.trim();
		}));
		this.renderDisposables.add(submitButton.onDidClick(submit));
		this.renderDisposables.add(DOM.addDisposableListener(input, DOM.EventType.KEY_DOWN, (event: KeyboardEvent) => {
			if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
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
