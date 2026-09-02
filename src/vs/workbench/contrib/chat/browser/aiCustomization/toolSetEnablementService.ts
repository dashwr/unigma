/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { derived, IObservable, IReader, ISettableObservable, observableValue } from '../../../../../base/common/observable.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';

export const IToolSetEnablementService = createDecorator<IToolSetEnablementService>('toolSetEnablementService');

export interface IToolEnablementState {
	readonly toolSets: ReadonlyMap<string, boolean>;
	readonly tools: ReadonlyMap<string, boolean>;
}

export type TriState = boolean | 'mixed';

export function isToolEnabledInSet(state: IToolEnablementState, toolSetId: string, toolId: string): boolean {
	return state.tools.get(toolId) ?? state.toolSets.get(toolSetId) ?? true;
}

export function getToolSetTriState(state: IToolEnablementState, toolSetId: string, toolIds: readonly string[]): TriState {
	let anyOn = false;
	let anyOff = false;
	for (const toolId of toolIds) {
		if (isToolEnabledInSet(state, toolSetId, toolId)) {
			anyOn = true;
		} else {
			anyOff = true;
		}
		if (anyOn && anyOff) {
			return 'mixed';
		}
	}
	return anyOn;
}

export interface ICountableToolSet {
	readonly id: string;
	readonly deprecated?: boolean;
	getTools(reader?: IReader): Iterable<{ readonly id: string }>;
}

export function countEnabledCustomizationTools(toolSets: Iterable<ICountableToolSet>, state: IToolEnablementState, reader?: IReader): number {
	const enabled = new Set<string>();
	for (const toolSet of toolSets) {
		if (toolSet.deprecated) {
			continue;
		}
		for (const tool of toolSet.getTools(reader)) {
			if (isToolEnabledInSet(state, toolSet.id, tool.id)) {
				enabled.add(tool.id);
			}
		}
	}
	return enabled.size;
}

export interface IToolSetEnablementService {
	readonly _serviceBrand: undefined;
	observe(sessionType: string): IObservable<IToolEnablementState>;
	getState(sessionType: string): IToolEnablementState;
	setToolSetEnabled(sessionType: string, toolSetId: string, toolIds: readonly string[], enabled: boolean): void;
	setToolEnabled(sessionType: string, toolSetId: string, toolId: string, enabled: boolean): void;
}

const STORAGE_KEY = 'chat.toolSetEnablement';
const EMPTY_STATE: IToolEnablementState = { toolSets: new Map(), tools: new Map() };

interface IStoredShape {
	readonly [sessionType: string]: {
		readonly toolSets?: { readonly [id: string]: boolean };
		readonly tools?: { readonly [id: string]: boolean };
	};
}

export class ToolSetEnablementService extends Disposable implements IToolSetEnablementService {
	declare readonly _serviceBrand: undefined;

	private readonly state: ISettableObservable<ReadonlyMap<string, IToolEnablementState>>;

	constructor(@IStorageService private readonly storageService: IStorageService) {
		super();
		this.state = observableValue('toolSetEnablement', this.load());
		const store = this._register(new DisposableStore());
		this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, STORAGE_KEY, store)(() => this.state.set(this.load(), undefined)));
	}

	observe(sessionType: string): IObservable<IToolEnablementState> {
		return derived(reader => this.state.read(reader).get(sessionType) ?? EMPTY_STATE);
	}

	getState(sessionType: string): IToolEnablementState {
		return this.state.get().get(sessionType) ?? EMPTY_STATE;
	}

	setToolSetEnabled(sessionType: string, toolSetId: string, toolIds: readonly string[], enabled: boolean): void {
		const current = this.getState(sessionType);
		const toolSets = new Map(current.toolSets);
		const tools = new Map(current.tools);
		if (enabled) {
			toolSets.delete(toolSetId);
		} else {
			toolSets.set(toolSetId, false);
		}
		for (const toolId of toolIds) {
			tools.delete(toolId);
		}
		this.setState(sessionType, { toolSets, tools });
	}

	setToolEnabled(sessionType: string, toolSetId: string, toolId: string, enabled: boolean): void {
		const current = this.getState(sessionType);
		const tools = new Map(current.tools);
		const setDefault = current.toolSets.get(toolSetId) ?? true;
		if (enabled === setDefault) {
			tools.delete(toolId);
		} else {
			tools.set(toolId, enabled);
		}
		this.setState(sessionType, { toolSets: current.toolSets, tools });
	}

	private setState(sessionType: string, next: IToolEnablementState): void {
		const state = new Map(this.state.get());
		if (next.toolSets.size === 0 && next.tools.size === 0) {
			state.delete(sessionType);
		} else {
			state.set(sessionType, { toolSets: new Map(next.toolSets), tools: new Map(next.tools) });
		}
		this.state.set(state, undefined);
		this.save(state);
	}

	private load(): ReadonlyMap<string, IToolEnablementState> {
		const raw = this.storageService.get(STORAGE_KEY, StorageScope.PROFILE);
		if (!raw) {
			return new Map();
		}
		try {
			const parsed = JSON.parse(raw) as IStoredShape;
			return new Map(Object.entries(parsed).map(([sessionType, entry]) => [sessionType, {
				toolSets: new Map(Object.entries(entry.toolSets ?? {})),
				tools: new Map(Object.entries(entry.tools ?? {})),
			}]));
		} catch {
			return new Map();
		}
	}

	private save(state: ReadonlyMap<string, IToolEnablementState>): void {
		if (state.size === 0) {
			this.storageService.remove(STORAGE_KEY, StorageScope.PROFILE);
			return;
		}
		const serialized: Record<string, { toolSets: Record<string, boolean>; tools: Record<string, boolean> }> = {};
		for (const [sessionType, entry] of state) {
			serialized[sessionType] = { toolSets: Object.fromEntries(entry.toolSets), tools: Object.fromEntries(entry.tools) };
		}
		this.storageService.store(STORAGE_KEY, JSON.stringify(serialized), StorageScope.PROFILE, StorageTarget.MACHINE);
	}
}

registerSingleton(IToolSetEnablementService, ToolSetEnablementService, InstantiationType.Delayed);
