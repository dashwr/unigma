/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Internal types for the three read-only projections, and the normalisation of
 * what the pinned OpenCode artefact actually sends.
 *
 * Step `J-1` of the projections contract, `docs/PROJECTIONS-CONTRACT.md`.
 * Pure: no HTTP, no process, no state. Everything here takes a payload the
 * runtime already received and returns a value the RPC can carry.
 *
 * The contract's three load-bearing facts, restated because the code depends on
 * each of them:
 *
 * 1. `Todo` has **no `id`** and `todo.updated` carries the whole array, so
 *    identity is position and every update is a whole-list replacement.
 * 2. `status` and `priority` are **free strings** in the schema -- the values are
 *    only described in prose -- so an unknown value is rendered as text instead
 *    of being folded into a default.
 * 3. The artefact carries **two structurally identical question families**,
 *    `question.*` and `question.v2.*`. Both are accepted on input; the reply
 *    always goes out on the route without `v2`.
 */

/** The statuses the contract lists in prose. Not an enum in the schema. */
const KNOWN_TODO_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
const KNOWN_TODO_PRIORITY = ['high', 'medium', 'low'] as const;

export type KnownTodoStatus = typeof KNOWN_TODO_STATUS[number];
export type KnownTodoPriority = typeof KNOWN_TODO_PRIORITY[number];

/**
 * One todo item.
 *
 * `status` keeps the raw string always, and `knownStatus` is set only when the
 * value is one the contract names. The UI colours and orders from
 * `knownStatus`; when it is absent it prints `status` verbatim. Collapsing an
 * unknown value into a default would make the interface state something the
 * agent did not say.
 */
export interface AgentTodo {
	readonly content: string;
	readonly status: string;
	readonly knownStatus?: KnownTodoStatus;
	readonly priority: string;
	readonly knownPriority?: KnownTodoPriority;
}

export interface AgentQuestionOption {
	readonly label: string;
	readonly description: string;
}

/**
 * One question, normalised from either family.
 *
 * Deliberately **without** an `always` field, and without any route to a
 * permission. The contract keeps question and permission apart at every layer,
 * and the type is the cheapest layer to keep them apart in: a caller cannot
 * accidentally grant a standing permission through a question, because there is
 * no field to carry it.
 */
export interface AgentQuestion {
	readonly requestId: string;
	readonly sessionId: string;
	readonly question: string;
	readonly header: string;
	readonly options: readonly AgentQuestionOption[];
	/** The agent asked for more than one answer. */
	readonly multiple: boolean;
	/** The agent itself offers free text as one of its options. */
	readonly custom: boolean;
	/** Which family it arrived on. Recorded for evidence; never steers the reply. */
	readonly family: 'question' | 'question.v2';
}

export interface AgentChildSession {
	readonly sessionId: string;
	readonly parentId: string;
	readonly title?: string;
}

interface RecordValue { readonly [key: string]: unknown }

function isRecord(value: unknown): value is RecordValue {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/**
 * Normalises a `todo.updated` payload or a `GET /session/{id}/todo` response.
 *
 * Whole-list replacement is the caller's contract, and this function makes it
 * hard to do otherwise: it returns a complete array and carries no key by which
 * a merge could be attempted. An entry missing any of the three required fields
 * is **dropped**, not defaulted -- a todo whose content did not arrive is not a
 * todo, and inventing an empty one would put a blank row on the screen that the
 * agent never sent.
 */
export function normalizeTodoList(payload: unknown): readonly AgentTodo[] {
	const raw = Array.isArray(payload)
		? payload
		: isRecord(payload) && Array.isArray(payload.todos)
			? payload.todos
			: undefined;
	if (!raw) {
		return [];
	}
	const todos: AgentTodo[] = [];
	for (const entry of raw) {
		if (!isRecord(entry)) {
			continue;
		}
		const content = asString(entry.content);
		const status = asString(entry.status);
		const priority = asString(entry.priority);
		if (content === undefined || status === undefined || priority === undefined) {
			continue;
		}
		const knownStatus = (KNOWN_TODO_STATUS as readonly string[]).includes(status) ? status as KnownTodoStatus : undefined;
		const knownPriority = (KNOWN_TODO_PRIORITY as readonly string[]).includes(priority) ? priority as KnownTodoPriority : undefined;
		todos.push({ content, status, knownStatus, priority, knownPriority });
	}
	return todos;
}

/**
 * Classifies a question event from either family.
 *
 * Ignoring an event because it arrived as `question.v2.asked` would leave a
 * question on screen with no way to answer it, which is the failure this
 * function exists to prevent.
 */
export function classifyQuestionEvent(type: unknown): { readonly kind: 'asked' | 'replied' | 'rejected'; readonly family: 'question' | 'question.v2' } | undefined {
	const name = asString(type);
	if (name === undefined) {
		return undefined;
	}
	for (const family of ['question.v2', 'question'] as const) {
		if (!name.startsWith(`${family}.`)) {
			continue;
		}
		const kind = name.slice(family.length + 1);
		if (kind === 'asked' || kind === 'replied' || kind === 'rejected') {
			return { kind, family };
		}
		return undefined;
	}
	return undefined;
}

/**
 * Normalises one `QuestionRequest` from either family into the internal type.
 *
 * The artefact nests `questions: QuestionInfo[]` inside a request, but the
 * reply body is `{ answers: string[][] }` -- one answer array per question. This
 * function returns **one `AgentQuestion` per `QuestionInfo`**, and the index is
 * the position in that outer array, so a reply can be assembled positionally
 * without inventing an id the schema does not have.
 */
export function normalizeQuestionRequest(payload: unknown, family: 'question' | 'question.v2' = 'question'): readonly AgentQuestion[] {
	if (!isRecord(payload)) {
		return [];
	}
	const requestId = asString(payload.id);
	const sessionId = asString(payload.sessionID);
	if (requestId === undefined || sessionId === undefined || !Array.isArray(payload.questions)) {
		return [];
	}
	const questions: AgentQuestion[] = [];
	for (const entry of payload.questions) {
		if (!isRecord(entry)) {
			continue;
		}
		const question = asString(entry.question);
		const header = asString(entry.header);
		if (question === undefined || header === undefined) {
			continue;
		}
		const options: AgentQuestionOption[] = [];
		if (Array.isArray(entry.options)) {
			for (const option of entry.options) {
				if (!isRecord(option)) {
					continue;
				}
				const label = asString(option.label);
				if (label === undefined) {
					continue;
				}
				options.push({ label, description: asString(option.description) ?? '' });
			}
		}
		questions.push({
			requestId,
			sessionId,
			question,
			header,
			options,
			multiple: entry.multiple === true,
			custom: entry.custom === true,
			family,
		});
	}
	return questions;
}

/** The two choices the product adds to every question, decided in `D-047`. */
export const SYNTHETIC_QUESTION_CHOICES = ['unigma.question.type', 'unigma.question.cancel'] as const;
export type SyntheticQuestionChoice = typeof SYNTHETIC_QUESTION_CHOICES[number];

export interface AgentQuestionChoice {
	readonly label: string;
	readonly description: string;
	/** Absent for an option the agent sent; set for the two the product adds. */
	readonly synthetic?: SyntheticQuestionChoice;
}

/**
 * The choices a question offers, with the product's two appended.
 *
 * `D-047`: a pending question disables the composer, and the way out lives
 * inside the question -- `type` for free text and `cancel` to drop it. That is
 * what makes a disabled composer safe rather than a trap.
 *
 * **Always the last two, never fixed positions.** The decision was phrased as
 * "options 4 and 5", which is right when the agent sends three; with six agent
 * options they are the seventh and eighth. Pinning them to an index would put
 * `cancel` under whatever the keyboard or a repeated keystroke lands on when
 * the count changes, and cancelling by accident is the one outcome that cannot
 * be undone from the question.
 */
export function questionChoices(question: AgentQuestion): readonly AgentQuestionChoice[] {
	return [
		...question.options.map(option => ({ label: option.label, description: option.description })),
		{ label: 'Type an answer', description: 'Answer in your own words instead of choosing.', synthetic: 'unigma.question.type' as const },
		{ label: 'Cancel', description: 'Dismiss this question without answering it.', synthetic: 'unigma.question.cancel' as const },
	];
}

/**
 * Normalises `GET /session/{id}/children`.
 *
 * The contract records that there is **no subagent event**: the relationship is
 * `parentID` and the child's life shows up in the parent's own session and
 * message events. An entry whose `parentID` does not match the session being
 * asked about is dropped rather than adopted, so a mislabelled response cannot
 * graft a stranger's session into this tree.
 */
export function normalizeChildSessions(payload: unknown, parentId: string): readonly AgentChildSession[] {
	if (!Array.isArray(payload)) {
		return [];
	}
	const children: AgentChildSession[] = [];
	for (const entry of payload) {
		if (!isRecord(entry)) {
			continue;
		}
		const sessionId = asString(entry.id);
		const entryParent = asString(entry.parentID);
		if (sessionId === undefined || entryParent !== parentId) {
			continue;
		}
		children.push({ sessionId, parentId, title: asString(entry.title) });
	}
	return children;
}
