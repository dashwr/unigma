/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isChatPanelEnabled } from '../../../../../base/common/product.js';

suite('Chat panel product capability', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('defaults to enabled when the product omits the capability', () => {
		assert.strictEqual(isChatPanelEnabled({}), true);
	});

	test('supports explicit enabled and disabled products', () => {
		assert.strictEqual(isChatPanelEnabled({ chatPanelEnabled: true }), true);
		assert.strictEqual(isChatPanelEnabled({ chatPanelEnabled: false }), false);
	});
});
