/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Well-known session configuration keys shared by session providers and clients. */
export const enum SessionConfigKey {
	Isolation = 'isolation',
	Branch = 'branch',
	WorktreeBranchPrefix = 'worktreeBranchPrefix',
	WorktreeIncludeFiles = 'worktreeIncludeFiles',
}
