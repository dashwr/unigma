/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DiagnosticSink } from '../application/runtimePorts';
import type { DiagnosticRecord, DisposableLike } from '../domain/runtime';

export interface DiagnosticWriter {
	appendLine(value: string): void;
	dispose?(): void;
}

function safeIdentifier(value: unknown): string {
	return typeof value !== 'string' ? '' : value.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128);
}

function safeLevel(value: DiagnosticRecord['level']): DiagnosticRecord['level'] {
	switch (value) {
		case 'debug':
		case 'info':
		case 'warn':
		case 'error':
			return value;
		default:
			return 'info';
	}
}

/** Writes only the allowlisted diagnostic fields; payloads never reach this sink. */
export class RedactedDiagnosticSink implements DiagnosticSink, DisposableLike {
	private readonly writer: DiagnosticWriter;

	public constructor(writer: DiagnosticWriter) {
		this.writer = writer;
	}

	public record(diagnostic: DiagnosticRecord): void {
		const level = safeLevel(diagnostic.level);
		const code = safeIdentifier(diagnostic.code);
		const request = safeIdentifier(diagnostic.requestId);
		const session = safeIdentifier(diagnostic.sessionId);
		const correlation = [request && `request=${request}`, session && `session=${session}`].filter(Boolean).join(' ');
		this.writer.appendLine(`[${level}] ${code}${correlation ? ` ${correlation}` : ''}`);
	}

	public dispose(): void {
		this.writer.dispose?.();
	}
}
