/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { RedactedDiagnosticSink } from '../infrastructure/diagnostics';

suite('Unigma redacted diagnostics', () => {
	test('writes only bounded allowlisted correlation fields', () => {
		const lines: string[] = [];
		const sink = new RedactedDiagnosticSink({ appendLine: line => lines.push(line) });

		sink.record({
			level: 'error',
			code: 'runtime.failed/with secret',
			requestId: 'request with secret',
			sessionId: 'session\nwith secret',
		});

		assert.deepStrictEqual(lines, ['[error] runtime.failed_with_secret request=request_with_secret session=session_with_secret']);
	});
});
