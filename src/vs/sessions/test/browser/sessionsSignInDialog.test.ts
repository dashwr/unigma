/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mock } from '../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { createSessionsSignInDialogOptions } from '../../browser/sessionsSignInDialog.js';

suite('Sessions - Sign-In Dialog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('requires sign-in and optionally offers a return to the editor', () => {
		const commandService = new class extends mock<ICommandService>() { }();
		const required = createSessionsSignInDialogOptions(commandService, false);

		assert.deepStrictEqual({
			disableCloseButton: required.disableCloseButton,
			hasFooter: required.renderDialogFooter !== undefined,
		}, {
			disableCloseButton: true,
			hasFooter: false,
		});
	});
});
