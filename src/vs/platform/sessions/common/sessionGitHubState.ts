/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type SessionSummaryMeta = Record<string, unknown>;

export interface ISessionGitHubState {
	readonly owner?: string;
	readonly repo?: string;
	readonly pullRequestUrls?: readonly string[];
	readonly initialPullRequestUrls?: readonly string[];
	readonly associatedPullRequestUrls?: readonly string[];
	readonly issueUrls?: readonly string[];
	readonly pullRequestBranchName?: string;
}

const SESSION_META_GITHUB_KEY = 'github';
const MAX_SESSION_PULL_REQUEST_REFERENCES = 10;

function normalizePullRequestUrls(urls: readonly string[]): string[] {
	const normalized = urls.map(url => {
		const match = /^https:\/\/(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<number>\d+)\/?$/.exec(url);
		const groups = match?.groups;
		return groups
			? `https://${groups['host'].toLowerCase()}/${groups['owner']}/${groups['repo']}/pull/${groups['number']}`
			: url;
	});
	return Array.from(new Map(normalized.map(url => [url.toLowerCase(), url])).values()).slice(0, MAX_SESSION_PULL_REQUEST_REFERENCES);
}

export function readSessionGitHubState(meta: SessionSummaryMeta | undefined): ISessionGitHubState | undefined {
	const value = meta?.[SESSION_META_GITHUB_KEY];
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const raw = value as Record<string, unknown>;
	const result: ISessionGitHubState = {
		...(typeof raw.owner === 'string' ? { owner: raw.owner } : {}),
		...(typeof raw.repo === 'string' ? { repo: raw.repo } : {}),
		...(typeof raw.pullRequestBranchName === 'string' ? { pullRequestBranchName: raw.pullRequestBranchName } : {}),
	};
	const pullRequestUrls = Array.isArray(raw.pullRequestUrls)
		? raw.pullRequestUrls.filter((url): url is string => typeof url === 'string')
		: typeof raw.pullRequestUrl === 'string' ? [raw.pullRequestUrl] : [];
	if (pullRequestUrls.length > 0) {
		(result as { pullRequestUrls: readonly string[] }).pullRequestUrls = normalizePullRequestUrls(pullRequestUrls);
	}
	return result;
}

export function withSessionGitHubState(meta: SessionSummaryMeta | undefined, gitHubState: ISessionGitHubState | undefined): SessionSummaryMeta | undefined {
	const next = { ...meta };
	if (gitHubState !== undefined) {
		next[SESSION_META_GITHUB_KEY] = gitHubState;
	} else {
		delete next[SESSION_META_GITHUB_KEY];
	}
	return Object.keys(next).length > 0 ? next : undefined;
}
