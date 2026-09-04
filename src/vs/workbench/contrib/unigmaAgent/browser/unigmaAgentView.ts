/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { ProgressBar } from '../../../../base/browser/ui/progressbar/progressbar.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IAllowedMcpServersService } from '../../../../platform/mcp/common/mcpManagement.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { defaultButtonStyles, defaultProgressBarStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IWorkbenchMcpManagementService } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { UNIGMA_AGENT_MANIFEST } from './unigmaAgentManifest.js';
import { IUnigmaAgentRuntime } from './unigmaAgentRuntime.js';
import { evaluateWorkbenchLocalIntegrationPreflight } from '../common/localIntegrationPreflight.js';
import { AgentEventType, type AgentCatalogEntry, type AgentLocalIntegrationPreflight, type AgentModelEntry } from '../common/agentProtocol.js';
import { getUnigmaAgentInputAction, parseUnigmaAgentInput } from '../common/agentInput.js';
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
	private isStopping = false;
	private catalogEntries: readonly AgentCatalogEntry[] = [];
	private catalogSessionId: string | undefined;
	private catalogUnavailable = false;
	private modelsRequestedSession: string | undefined;
	private modelsUnavailable = false;
	private configurationError: string | undefined;
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
		@IWorkbenchMcpManagementService private readonly mcpManagementService: IWorkbenchMcpManagementService,
		@IAllowedMcpServersService private readonly allowedMcpServersService: IAllowedMcpServersService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustService: IWorkspaceTrustManagementService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.runtime.onDidReceiveEvent(event => {
			if (event.type === AgentEventType.Configuration) {
				this.configurationError = undefined;
			}
			this.model = reduceUnigmaAgentSessionEvent(this.model, event);
			if (!this.model.sessionId) {
				this.catalogSessionId = undefined;
				this.catalogEntries = [];
				this.catalogUnavailable = false;
			}
			if (this.model.sessionId && this.model.sessionId !== this.catalogSessionId) {
				void this.loadCatalog(this.model.sessionId);
			}
			if (this.model.state === UNIGMA_AGENT_VIEW_STATES.Empty && this.model.sessionId && this.modelsRequestedSession !== this.model.sessionId) {
				void this.loadModels(this.model.sessionId);
			}
			this.renderState();
		}));
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (!this.disposed && event.affectsConfiguration('unigma.agent.hiddenModels')) {
				this.renderState();
			}
		}));
	}

	private async loadModels(sessionId: string): Promise<void> {
		this.modelsRequestedSession = sessionId;
		this.modelsUnavailable = false;
		try {
			await this.runtime.requestModels(sessionId);
		} catch {
			if (this.modelsRequestedSession === sessionId) {
				this.modelsUnavailable = true;
				this.renderState();
			}
		}
	}

	private async loadCatalog(sessionId: string): Promise<void> {
		this.catalogSessionId = sessionId;
		this.catalogEntries = [];
		this.catalogUnavailable = false;
		try {
			const result = await this.runtime.getCatalog(sessionId);
			if (this.catalogSessionId !== sessionId || this.disposed) {
				return;
			}
			if (result.available) {
				this.catalogEntries = result.entries;
			} else {
				this.catalogUnavailable = true;
			}
		} catch {
			if (this.catalogSessionId === sessionId) {
				this.catalogUnavailable = true;
			}
		}
		if (!this.disposed) {
			this.renderState();
		}
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

		this.isStopping = false;
		this.model = startUnigmaAgentSession();
		this.renderState();
		this.stateContainer?.focus();

		try {
			const workspace = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			let preflight: AgentLocalIntegrationPreflight;
			if (!workspace) {
				preflight = { accepted: false, code: 'pathUnavailable' };
			} else {
				try {
					const installed = await this.mcpManagementService.getInstalled();
					const inventory = await this.runtime.getLocalIntegrations(workspace.toString());
					preflight = evaluateWorkbenchLocalIntegrationPreflight({
						workspaceTrusted: this.workspaceTrustService.isWorkspaceTrusted(),
						workspaceUri: workspace,
						servers: installed.map(server => ({
							name: server.name,
							scope: server.scope,
							config: server.config,
							location: server.location,
							approved: this.allowedMcpServersService.isAllowed(server) === true,
						})),
						sources: inventory.sources,
						sourceInventoryComplete: inventory.complete,
					});
				} catch {
					preflight = { accepted: false, code: 'configurationInvalid' };
				}
			}
			if (this.disposed) {
				return;
			}
			await this.runtime.start(preflight, workspace?.toString());
		} catch {
			if (!this.disposed) {
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
				this.stateContainer?.focus();
			}
		}
	}

	private async stop(cancelButton: Button): Promise<void> {
		const sessionId = this.model.sessionId;
		if (!sessionId || this.isStopping) {
			return;
		}

		this.isStopping = true;
		const cancellingLabel = localize('unigmaAgent.cancelling', 'Cancelling...');
		cancelButton.enabled = false;
		cancelButton.label = cancellingLabel;
		cancelButton.setAriaLabel(cancellingLabel);
		try {
			await this.runtime.stopSession(sessionId);
		} catch {
			if (!this.disposed) {
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
			}
		} finally {
			// Keep the guard until a runtime event leaves Loading after success.
			// On failure setState renders Error and clears it below.
			if (this.model.state !== UNIGMA_AGENT_VIEW_STATES.Loading) {
				this.isStopping = false;
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
		if (this.model.state !== UNIGMA_AGENT_VIEW_STATES.Loading) {
			this.isStopping = false;
		}
		this.renderDisposables.clear();
		DOM.clearNode(this.stateContainer);
		this.agentProgressBar.stop().hide();
		const accessibility = getUnigmaAgentStateAccessibility(this.model.state);
		if (accessibility.role === undefined) {
			this.stateContainer.removeAttribute('role');
		} else {
			this.stateContainer.setAttribute('role', accessibility.role);
		}
		if (accessibility.live === undefined) {
			this.stateContainer.removeAttribute('aria-live');
		} else {
			this.stateContainer.setAttribute('aria-live', accessibility.live);
		}
		if (accessibility.busy === undefined) {
			this.stateContainer.removeAttribute('aria-busy');
		} else {
			this.stateContainer.setAttribute('aria-busy', String(accessibility.busy));
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
					: this.model.errorMessage || localize('unigmaAgent.errorMessage', 'The agent runtime is not connected yet.');

		if (this.model.content) {
			const content = DOM.append(this.stateContainer, DOM.$('pre'));
			content.textContent = this.model.content;
			content.style.whiteSpace = 'pre-wrap';
			content.style.width = '100%';
			content.style.boxSizing = 'border-box';
			content.style.margin = '8px 0 0';
		}
		this.renderModels();

		if (this.model.diff) {
			const diffContainer = DOM.append(this.stateContainer, DOM.$('.unigma-agent-diff'));
			diffContainer.style.width = '100%';
			const diffTitle = DOM.append(diffContainer, DOM.$('strong'));
			diffTitle.textContent = localize('unigmaAgent.diffTitle', 'Proposed changes');
			for (const file of this.model.diff.files) {
				const fileLabel = DOM.append(diffContainer, DOM.$('div'));
				fileLabel.textContent = file.path;
				fileLabel.style.fontFamily = 'var(--vscode-editor-font-family)';
			}
		}

		if (this.model.permission && this.model.sessionId) {
			const permissionContainer = DOM.append(this.stateContainer, DOM.$('.unigma-agent-permission'));
			permissionContainer.style.display = 'flex';
			permissionContainer.style.flexDirection = 'column';
			permissionContainer.style.gap = '8px';
			const permissionTitle = DOM.append(permissionContainer, DOM.$('strong'));
			permissionTitle.textContent = this.model.permission.title;
			if (this.model.permission.description) {
				const permissionDescription = DOM.append(permissionContainer, DOM.$('p'));
				permissionDescription.textContent = this.model.permission.description;
				permissionDescription.style.margin = '0';
			}
			const permissionActions = DOM.append(permissionContainer, DOM.$('div'));
			const approve = this.renderDisposables.add(new Button(permissionActions, { ...defaultButtonStyles, ariaLabel: localize('unigmaAgent.approve', 'Approve') }));
			approve.label = localize('unigmaAgent.approve', 'Approve');
			const reject = this.renderDisposables.add(new Button(permissionActions, { ...defaultButtonStyles, ariaLabel: localize('unigmaAgent.reject', 'Reject') }));
			reject.label = localize('unigmaAgent.reject', 'Reject');
			this.renderDisposables.add(approve.onDidClick(() => void this.runtime.approve(this.model.sessionId!, this.model.permission!.approvalId)));
			this.renderDisposables.add(reject.onDidClick(() => void this.runtime.reject(this.model.sessionId!, this.model.permission!.approvalId)));
		}

		if (this.model.state === UNIGMA_AGENT_VIEW_STATES.Loading) {
			this.agentProgressBar.infinite().show();
			if (this.model.sessionId) {
				const actionContainer = DOM.append(this.stateContainer, DOM.$('.unigma-agent-action'));
				actionContainer.style.marginTop = '8px';
				const cancelLabel = this.isStopping
					? localize('unigmaAgent.cancelling', 'Cancelling...')
					: localize('unigmaAgent.cancel', 'Cancel');
				const cancelButton = this.renderDisposables.add(new Button(actionContainer, { ...defaultButtonStyles, ariaLabel: cancelLabel, disabled: this.isStopping }));
				cancelButton.label = cancelLabel;
				this.renderDisposables.add(cancelButton.onDidClick(() => void this.stop(cancelButton)));
			}
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
				if (this.disposed) {
					return;
				}
				this.inputValue = '';
				this.isSubmitting = false;
				this.renderState();
			}, () => {
				if (this.disposed) {
					return;
				}
				this.isSubmitting = false;
				this.setState(UNIGMA_AGENT_VIEW_STATES.Error);
				this.stateContainer?.focus();
			});
		};
		const suggestions = DOM.append(inputContainer, DOM.$('.unigma-agent-suggestions'));
		const suggestionDisposables = this.renderDisposables.add(new DisposableStore());
		suggestions.setAttribute('role', 'listbox');
		suggestions.setAttribute('aria-label', localize('unigmaAgent.suggestions', 'Agent suggestions'));
		const renderSuggestions = (): void => {
			suggestionDisposables.clear();
			DOM.clearNode(suggestions);
			const parsed = parseUnigmaAgentInput(input.value, this.catalogEntries);
			if (!parsed || this.catalogUnavailable || !parsed.entries.length) {
				suggestions.hidden = true;
				return;
			}
			suggestions.hidden = false;
			for (const entry of parsed.entries) {
				const option = suggestionDisposables.add(new Button(suggestions, { ...defaultButtonStyles, ariaLabel: entry.name }));
				option.label = `${parsed.marker}${entry.name}`;
				option.element.setAttribute('role', 'option');
				suggestionDisposables.add(option.onDidClick(() => {
					this.inputValue = `${parsed.text}${parsed.marker}${entry.id} `;
					renderSuggestions();
					input.value = this.inputValue;
					input.focus();
				}));
			}
		};
		renderSuggestions();
		this.renderDisposables.add(DOM.addDisposableListener(input, DOM.EventType.INPUT, () => {
			this.inputValue = input.value;
			submitButton.enabled = !!this.model.sessionId && !this.isSubmitting && !!this.inputValue.trim();
			renderSuggestions();
		}));
		this.renderDisposables.add(submitButton.onDidClick(submit));
		this.renderDisposables.add(DOM.addDisposableListener(input, DOM.EventType.KEY_DOWN, (event: KeyboardEvent) => {
			const action = getUnigmaAgentInputAction(event.key, event.shiftKey);
			if (action === 'dismiss') {
				suggestions.hidden = true;
				event.preventDefault();
				return;
			}
			if (action === 'submit' && !event.isComposing) {
				event.preventDefault();
				submit();
			}
		}));
		if (this.catalogUnavailable) {
			const unavailable = DOM.append(inputContainer, DOM.$('p'));
			unavailable.setAttribute('role', 'status');
			unavailable.textContent = localize('unigmaAgent.catalogUnavailable', 'Agent suggestions are unavailable.');
			unavailable.style.color = 'var(--vscode-descriptionForeground)';
		}
	}

	private renderModels(): void {
		if (!this.model.sessionId || (!this.model.models && !this.modelsUnavailable)) {
			return;
		}
		const container = DOM.append(this.stateContainer!, DOM.$('.unigma-agent-models'));
		const title = DOM.append(container, DOM.$('h4'));
		title.textContent = localize('unigmaAgent.models', 'Models');
		if (this.modelsUnavailable) {
			const unavailable = DOM.append(container, DOM.$('p'));
			unavailable.setAttribute('role', 'status');
			unavailable.textContent = localize('unigmaAgent.modelsUnavailable', 'Models are unavailable.');
			return;
		}
		if (this.configurationError) {
			const error = DOM.append(container, DOM.$('p'));
			error.setAttribute('role', 'alert');
			error.textContent = this.configurationError;
		}
		const configured = this.configurationService.getValue<unknown>('unigma.agent.hiddenModels');
		const hiddenModels = new Set(Array.isArray(configured) ? configured.filter((id): id is string => typeof id === 'string' && /^[^/]+\/[^/]+$/.test(id)) : []);
		const models = this.model.models ?? [];
		const visible = models.filter(model => !hiddenModels.has(`${model.providerId}/${model.modelId}`));
		const hidden = models.filter(model => hiddenModels.has(`${model.providerId}/${model.modelId}`));
		if (visible.length === 0) {
			const empty = DOM.append(container, DOM.$('p'));
			empty.textContent = localize('unigmaAgent.noVisibleModels', 'No models are visible.');
		}
		for (const model of visible) {
			this.renderModel(container, model, false, hiddenModels);
		}
		if (hidden.length > 0) {
			const hiddenTitle = DOM.append(container, DOM.$('h5'));
			hiddenTitle.textContent = localize('unigmaAgent.hiddenModels', 'Hidden models');
			for (const model of hidden) {
				this.renderModel(container, model, true, hiddenModels);
			}
		}
	}

	private renderModel(container: HTMLElement, model: AgentModelEntry, isHidden: boolean, hiddenModels: ReadonlySet<string>): void {
		const id = `${model.providerId}/${model.modelId}`;
		const row = DOM.append(container, DOM.$('.unigma-agent-model'));
		const label = DOM.append(row, DOM.$('span'));
		label.textContent = `${model.providerLabel} / ${model.label}`;
		const toggle = this.renderDisposables.add(new Button(row, { ...defaultButtonStyles, ariaLabel: isHidden ? localize('unigmaAgent.showModel', 'Show model') : localize('unigmaAgent.hideModel', 'Hide model') }));
		toggle.label = isHidden ? localize('unigmaAgent.show', 'Show') : localize('unigmaAgent.hide', 'Hide');
		this.renderDisposables.add(toggle.onDidClick(() => {
			const next = isHidden ? [...hiddenModels].filter(value => value !== id) : [...hiddenModels, id];
			void this.configurationService.updateValue('unigma.agent.hiddenModels', next, ConfigurationTarget.USER).then(() => this.renderState(), () => undefined);
		}));
		const active = this.model.activeModel?.providerId === model.providerId && this.model.activeModel.modelId === model.modelId;
		const use = this.renderDisposables.add(new Button(row, { ...defaultButtonStyles, ariaLabel: active ? localize('unigmaAgent.activeModel', 'Active model') : localize('unigmaAgent.useModel', 'Use model'), disabled: active }));
		use.label = active ? localize('unigmaAgent.active', 'Active') : localize('unigmaAgent.use', 'Use');
		this.renderDisposables.add(use.onDidClick(() => {
			if (!active && this.model.sessionId) {
				void this.runtime.applyModel(this.model.sessionId, model.providerId, model.modelId).then(result => {
					if (!result.selected) {
						this.configurationError = result.error.message;
						this.renderState();
					}
				});
			}
		}));
	}

	override dispose(): void {
		this.disposed = true;
		super.dispose();
	}
}
