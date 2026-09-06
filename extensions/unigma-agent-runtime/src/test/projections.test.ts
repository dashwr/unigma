/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import {
	classifyQuestionEvent,
	normalizeChildSessions,
	normalizeQuestionRequest,
	normalizeTodoList,
	questionChoices,
} from '../domain/projections';

suite('projections J-1', () => {

	suite('todo', () => {

		test('accepts both the event envelope and the bare array', () => {
			const todos = [{ content: 'read the contract', status: 'pending', priority: 'high' }];
			assert.deepStrictEqual(normalizeTodoList(todos), normalizeTodoList({ sessionID: 'ses_1', todos }));
		});

		test('a known status and priority are recognised, and the raw value is kept anyway', () => {
			assert.deepStrictEqual(normalizeTodoList([{ content: 'c', status: 'in_progress', priority: 'medium' }]), [
				{ content: 'c', status: 'in_progress', knownStatus: 'in_progress', priority: 'medium', knownPriority: 'medium' }
			]);
		});

		test('an unknown status survives as text instead of becoming a default', () => {
			// `status` is a free string in the schema; folding `blocked` into
			// `pending` would make the interface state something the agent
			// never said.
			assert.deepStrictEqual(normalizeTodoList([{ content: 'c', status: 'blocked', priority: 'urgent' }]), [
				{ content: 'c', status: 'blocked', knownStatus: undefined, priority: 'urgent', knownPriority: undefined }
			]);
		});

		test('an entry missing a required field is dropped, not defaulted', () => {
			// A todo whose content did not arrive is not a todo. Inventing an
			// empty one would put a blank row on screen.
			const todos = normalizeTodoList([
				{ content: 'kept', status: 'pending', priority: 'low' },
				{ status: 'pending', priority: 'low' },
				{ content: 'no status', priority: 'low' },
				'not an object',
			]);
			assert.deepStrictEqual(todos.map(todo => todo.content), ['kept']);
		});

		test('anything that is not a list yields an empty list, never a throw', () => {
			for (const value of [undefined, null, 'todo', 42, {}, { todos: 'nope' }]) {
				assert.deepStrictEqual(normalizeTodoList(value), []);
			}
		});
	});

	suite('questions', () => {

		function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
			return {
				id: 'que_1',
				sessionID: 'ses_1',
				questions: [{ question: 'Which branch?', header: 'Branch', options: [{ label: 'main', description: 'the default' }] }],
				...overrides,
			};
		}

		test('both families are accepted on input', () => {
			// Ignoring a `question.v2.asked` would leave a question on screen
			// with no way to answer it.
			assert.deepStrictEqual(classifyQuestionEvent('question.asked'), { kind: 'asked', family: 'question' });
			assert.deepStrictEqual(classifyQuestionEvent('question.v2.asked'), { kind: 'asked', family: 'question.v2' });
			assert.deepStrictEqual(classifyQuestionEvent('question.v2.rejected'), { kind: 'rejected', family: 'question.v2' });
			assert.deepStrictEqual(classifyQuestionEvent('question.replied'), { kind: 'replied', family: 'question' });
		});

		test('a neighbouring event name is not mistaken for a question', () => {
			for (const value of ['permission.asked', 'question', 'question.v3.asked', 'question.unknown', 'session.idle', undefined, 42]) {
				assert.strictEqual(classifyQuestionEvent(value), undefined, String(value));
			}
		});

		test('one AgentQuestion per QuestionInfo, so a positional reply can be assembled', () => {
			// The reply body is `{ answers: string[][] }` -- one array per
			// question -- and the schema gives no id for an individual question.
			const questions = normalizeQuestionRequest(request({
				questions: [
					{ question: 'first', header: 'A', options: [] },
					{ question: 'second', header: 'B', options: [], multiple: true, custom: true },
				]
			}));
			assert.deepStrictEqual(questions.map(entry => [entry.question, entry.multiple, entry.custom]), [
				['first', false, false],
				['second', true, true],
			]);
			assert.deepStrictEqual([...new Set(questions.map(entry => entry.requestId))], ['que_1']);
		});

		test('an option without a label is dropped and a missing description becomes empty', () => {
			const [question] = normalizeQuestionRequest(request({
				questions: [{ question: 'q', header: 'h', options: [{ label: 'kept' }, { description: 'no label' }] }]
			}));
			assert.deepStrictEqual(question.options, [{ label: 'kept', description: '' }]);
		});

		test('a request without ids yields nothing', () => {
			assert.deepStrictEqual(normalizeQuestionRequest(request({ id: undefined })), []);
			assert.deepStrictEqual(normalizeQuestionRequest(request({ sessionID: undefined })), []);
			assert.deepStrictEqual(normalizeQuestionRequest(undefined), []);
		});

		test('the normalised question carries no way to grant a standing permission', () => {
			// The type is the cheapest layer to keep question and permission
			// apart in: there is no field for `always` to travel through.
			const [question] = normalizeQuestionRequest(request());
			const fields = Object.keys(question);
			for (const forbidden of ['always', 'response', 'permissionId']) {
				assert.ok(!fields.includes(forbidden), `${forbidden} must not travel on a question`);
			}
		});
	});

	suite('question choices (D-047)', () => {

		function questionWith(count: number) {
			const options = Array.from({ length: count }, (_unused, index) => ({ label: `option ${index}`, description: '' }));
			return normalizeQuestionRequest({
				id: 'que_1',
				sessionID: 'ses_1',
				questions: [{ question: 'q', header: 'h', options }],
			})[0];
		}

		test('type and cancel are always the last two, whatever the agent sent', () => {
			// Phrased in the decision as "options 4 and 5", which is right for
			// three agent options. Pinning them to an index would put `cancel`
			// under whatever a changed count lands on.
			for (const count of [0, 1, 3, 6, 11]) {
				const choices = questionChoices(questionWith(count));
				assert.strictEqual(choices.length, count + 2, `count ${count}`);
				assert.deepStrictEqual(
					choices.slice(-2).map(choice => choice.synthetic),
					['unigma.question.type', 'unigma.question.cancel'],
					`count ${count}`
				);
			}
		});

		test('the agent options keep their order and stay unmarked', () => {
			const choices = questionChoices(questionWith(3));
			assert.deepStrictEqual(choices.slice(0, 3).map(choice => choice.label), ['option 0', 'option 1', 'option 2']);
			assert.ok(choices.slice(0, 3).every(choice => choice.synthetic === undefined));
		});

		test('cancel is last, so it is never where a repeated keystroke lands first', () => {
			const choices = questionChoices(questionWith(4));
			assert.strictEqual(choices[choices.length - 1].synthetic, 'unigma.question.cancel');
		});
	});

	suite('child sessions', () => {

		test('only children of the session asked about are returned', () => {
			// A mislabelled response must not graft a stranger's session into
			// this tree.
			const children = normalizeChildSessions([
				{ id: 'ses_child', parentID: 'ses_parent', title: 'reading' },
				{ id: 'ses_other', parentID: 'ses_elsewhere' },
				{ parentID: 'ses_parent' },
				'not an object',
			], 'ses_parent');
			assert.deepStrictEqual(children, [{ sessionId: 'ses_child', parentId: 'ses_parent', title: 'reading' }]);
		});

		test('anything that is not a list yields an empty list', () => {
			for (const value of [undefined, null, {}, 'ses']) {
				assert.deepStrictEqual(normalizeChildSessions(value, 'ses_parent'), []);
			}
		});
	});
});
