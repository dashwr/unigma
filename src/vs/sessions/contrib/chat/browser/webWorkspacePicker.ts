/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionWidgetService } from '../../../../platform/actionWidget/browser/actionWidget.js';
import { IMenuService } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkbenchLayoutService } from '../../../../workbench/services/layout/browser/layoutService.js';
import { ISessionsProvidersService } from '../../../services/sessions/browser/sessionsProvidersService.js';
import { ISessionsRecentWorkspacesService } from '../../../services/sessions/browser/sessionsRecentWorkspacesService.js';
import { IWorkspacePickerOptions, WorkspacePicker } from './sessionWorkspacePicker.js';
import { showMobileWorkspacePickerSheet, shouldUseMobileWorkspacePickerSheet } from './mobile/mobileWorkspacePickerSheet.js';

/**
 * Web variant of {@link WorkspacePicker} for the Agents window's
 * vscode.dev / insiders.vscode.dev surface. Two responsibilities on
 * top of the desktop picker:
 *
 *  1. Scopes its contents to the host currently selected in the agent
 *     host filter — recent workspaces for that host plus a single
 *     "Select Folder..." entry that invokes the host's browse action.
 *  2. On phone-layout viewports renders the picker as a bottom sheet
 *     (via `showMobileWorkspacePickerSheet`) instead of the desktop
 *     action-widget popup. Falls through to `super.showPicker()` on
 *     non-phone viewports, so a single instance works correctly
 *     across rotation across the phone breakpoint.
 *
 * Falls back to the Copilot local provider when no host is selected
 * (e.g. on Electron desktop, where the host filter UI is not
 * surfaced).
 */
export class WebWorkspacePicker extends WorkspacePicker {

	constructor(
		options: IWorkspacePickerOptions,
		@IActionWidgetService actionWidgetService: IActionWidgetService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@ISessionsProvidersService sessionsProvidersService: ISessionsProvidersService,
		@ISessionsRecentWorkspacesService recentWorkspacesService: ISessionsRecentWorkspacesService,
		@ICommandService commandService: ICommandService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IFileDialogService fileDialogService: IFileDialogService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchLayoutService private readonly _layoutService: IWorkbenchLayoutService,
	) {
		super(
			{
				...options,
			},
			actionWidgetService,
			uriIdentityService,
			sessionsProvidersService,
			recentWorkspacesService,
			commandService,
			menuService,
			contextKeyService,
			instantiationService,
			fileDialogService,
			telemetryService,
		);
	}

	override showPicker(): void {
		if (!this._triggerElement) {
			return;
		}
		// On phone, render the picker as a bottom sheet instead of the
		// desktop action-widget popup. Falls through to `super` on non-
		// phone viewports so a single instance handles both desktop
		// browsers and rotation across the phone breakpoint.
		if (!shouldUseMobileWorkspacePickerSheet(this._layoutService)) {
			super.showPicker();
			return;
		}
		const items = this._buildItems();
		showMobileWorkspacePickerSheet(
			this._layoutService,
			this._triggerElement,
			items,
			item => this._dispatchPickerItem(item),
			this._getAllBrowseActions(),
		);
	}

}
