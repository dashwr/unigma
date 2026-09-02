/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IAgentFeedback } from './agentFeedbackModel.js';

export interface IAgentFeedbackItemsBackend {
	readonly onDidChangeItems: Event<URI>;
	getItems(sessionResource: URI): readonly IAgentFeedback[];
	hasLoaded(sessionResource: URI): boolean;
	upsert(feedback: IAgentFeedback): void;
	remove(sessionResource: URI, feedbackId: string): void;
	clear(sessionResource: URI): void;
	getSessionsWithItems(): URI[];
}

export function orderFeedbackItems(items: readonly IAgentFeedback[]): IAgentFeedback[] {
	const fileOrder = new Map<string, number>();
	for (const item of items) {
		const key = item.resourceUri.toString();
		if (!fileOrder.has(key)) {
			fileOrder.set(key, fileOrder.size);
		}
	}
	return items.slice().sort((a, b) => {
		const fa = fileOrder.get(a.resourceUri.toString())!;
		const fb = fileOrder.get(b.resourceUri.toString())!;
		if (fa !== fb) {
			return fa - fb;
		}
		return a.range.startLineNumber - b.range.startLineNumber;
	});
}

/** Client-side feedback store; provider-specific persistence is not part of Sessions. */
export class InMemoryAgentFeedbackItemsBackend extends Disposable implements IAgentFeedbackItemsBackend {
	private readonly _onDidChangeItems = this._register(new Emitter<URI>());
	readonly onDidChangeItems = this._onDidChangeItems.event;

	private readonly _bySession = new Map<string, IAgentFeedback[]>();
	private readonly _sessionResourceByKey = new Map<string, URI>();

	getItems(sessionResource: URI): readonly IAgentFeedback[] {
		return orderFeedbackItems(this._bySession.get(sessionResource.toString()) ?? []);
	}

	hasLoaded(_sessionResource: URI): boolean {
		return true;
	}

	upsert(feedback: IAgentFeedback): void {
		const key = feedback.sessionResource.toString();
		let items = this._bySession.get(key);
		if (!items) {
			items = [];
			this._bySession.set(key, items);
			this._sessionResourceByKey.set(key, feedback.sessionResource);
		}
		const idx = items.findIndex(f => f.id === feedback.id);
		if (idx >= 0) {
			items[idx] = feedback;
		} else {
			items.push(feedback);
		}
		this._onDidChangeItems.fire(feedback.sessionResource);
	}

	remove(sessionResource: URI, feedbackId: string): void {
		const key = sessionResource.toString();
		const items = this._bySession.get(key);
		if (!items) {
			return;
		}
		const idx = items.findIndex(f => f.id === feedbackId);
		if (idx < 0) {
			return;
		}
		items.splice(idx, 1);
		if (!items.length) {
			this._bySession.delete(key);
			this._sessionResourceByKey.delete(key);
		}
		this._onDidChangeItems.fire(sessionResource);
	}

	clear(sessionResource: URI): void {
		const key = sessionResource.toString();
		if (this._bySession.delete(key)) {
			this._sessionResourceByKey.delete(key);
			this._onDidChangeItems.fire(sessionResource);
		}
	}

	getSessionsWithItems(): URI[] {
		return [...this._sessionResourceByKey.values()];
	}
}
