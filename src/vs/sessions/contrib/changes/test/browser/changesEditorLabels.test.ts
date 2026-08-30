/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getChangesEditorFileStats } from '../../browser/changesEditorLabels.js';

suite('ChangesEditorLabels', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('file stats resolve from canonical, modified, and original resources', () => {
		const canonicalResource = URI.file('/workspace/renamed.ts');
		const originalResource = URI.file('/workspace/original.ts');
		const modifiedResource = URI.file('/workspace/modified.ts');
		const changes = [{
			uri: canonicalResource,
			originalUri: originalResource,
			modifiedUri: modifiedResource,
			insertions: 12,
			deletions: 3,
		}];

		assert.deepStrictEqual({
			canonical: getChangesEditorFileStats(canonicalResource, changes),
			modified: getChangesEditorFileStats(modifiedResource, changes),
			original: getChangesEditorFileStats(originalResource, changes),
			unrelated: getChangesEditorFileStats(URI.file('/workspace/unrelated.ts'), changes),
		}, {
			canonical: { insertions: 12, deletions: 3 },
			modified: { insertions: 12, deletions: 3 },
			original: { insertions: 12, deletions: 3 },
			unrelated: undefined,
		});
	});
});
