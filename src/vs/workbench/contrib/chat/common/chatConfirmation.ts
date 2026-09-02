/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const enum ConfirmationOptionKind {
	Approve = 'approve',
	Deny = 'deny',
}

export interface ConfirmationOption {
	readonly id: string;
	readonly label: string;
	readonly kind: ConfirmationOptionKind;
	readonly group?: number;
}

export interface McpOAuthClient {
	readonly clientId: string;
	readonly clientSecret?: string;
}
