/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

type Rgb = readonly [number, number, number];

const root = resolve(import.meta.dirname, '../..');
const minimumTextContrast = 4.5;
const minimumFocusContrast = 3;

function parseJsonc(file: string): Record<string, any> {
	const input = readFileSync(file, 'utf8');
	let source = '';
	let quoted = false;
	let escaped = false;
	for (let index = 0; index < input.length; index++) {
		const character = input[index];
		if (quoted) {
			source += character;
			escaped = character === '\\' && !escaped;
			if (character === '"' && !escaped) {
				quoted = false;
			}
			continue;
		}
		if (character === '"') {
			quoted = true;
			source += character;
		} else if (character === '/' && input[index + 1] === '/') {
			while (index < input.length && input[index] !== '\n') {
				index++;
			}
			source += '\n';
		} else {
			source += character;
		}
	}
	source = source.replace(/,\s*([}\]])/g, '$1');
	return JSON.parse(source);
}

function loadTheme(file: string, seen = new Set<string>()): Record<string, any> {
	const absoluteFile = resolve(file);
	if (seen.has(absoluteFile)) {
		throw new Error(`ciclo de include em ${absoluteFile}`);
	}
	seen.add(absoluteFile);
	const theme = parseJsonc(absoluteFile);
	const inherited = theme.include ? loadTheme(join(dirname(absoluteFile), theme.include), seen) : {};
	return {
		...inherited,
		...theme,
		colors: { ...(inherited.colors ?? {}), ...(theme.colors ?? {}) },
	};
}

function parseColor(value: unknown): Rgb | undefined {
	if (typeof value !== 'string' || !/^#[\da-f]{6,8}$/i.test(value)) {
		return undefined;
	}
	const hex = value.slice(1, 7);
	return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function luminance(color: Rgb): number {
	const channels = color.map(channel => channel / 255).map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: Rgb, background: Rgb): number {
	const light = Math.max(luminance(foreground), luminance(background));
	const dark = Math.min(luminance(foreground), luminance(background));
	return (light + 0.05) / (dark + 0.05);
}

function color(theme: Record<string, any>, key: string): Rgb {
	const parsed = parseColor(theme.colors?.[key]);
	if (!parsed) {
		throw new Error(`${theme.name}: ${key} nao e uma cor opaca hexadecimal`);
	}
	return parsed;
}

const pairs = [
	['editor.foreground', 'editor.background'],
	['sideBar.foreground', 'sideBar.background'],
	['statusBar.foreground', 'statusBar.background'],
	['tab.activeForeground', 'tab.activeBackground'],
	['tab.inactiveForeground', 'tab.inactiveBackground'],
	['panelTitle.activeForeground', 'panel.background'],
	['panelTitle.inactiveForeground', 'panel.background'],
	['menu.foreground', 'menu.background'],
	['notifications.foreground', 'notifications.background'],
	['terminal.foreground', 'terminal.background'],
	['list.activeSelectionForeground', 'list.activeSelectionBackground'],
	['list.inactiveSelectionForeground', 'list.inactiveSelectionBackground'],
] as const;

let failed = false;
for (const fileName of ['unigma-dark.json', 'unigma-light.json']) {
	const theme = loadTheme(join(root, 'extensions/theme-unigma/themes', fileName));
	console.log(`theme=${theme.name}`);
	for (const [foregroundKey, backgroundKey] of pairs) {
		const ratio = contrast(color(theme, foregroundKey), color(theme, backgroundKey));
		const result = ratio >= minimumTextContrast ? 'pass' : 'fail';
		console.log(`contrast.${foregroundKey}.on.${backgroundKey}=${ratio.toFixed(2)}:${result}`);
		failed ||= result === 'fail';
	}
	const focusRatio = contrast(color(theme, 'focusBorder'), color(theme, 'sideBar.background'));
	const selectionDifference = Math.abs(luminance(color(theme, 'editor.selectionBackground')) - luminance(color(theme, 'editor.background')));
	console.log(`focusBorder.on.sideBar.background=${focusRatio.toFixed(2)}:${focusRatio >= minimumFocusContrast ? 'pass' : 'fail'}`);
	console.log(`editor.selection.luminanceDifference=${selectionDifference.toFixed(3)}:${selectionDifference >= 0.1 ? 'pass' : 'fail'}`);
	failed ||= focusRatio < minimumFocusContrast || selectionDifference < 0.1;
}

if (failed) {
	console.log('themeContrast=fail');
	process.exitCode = 1;
} else {
	console.log('themeContrast=pass');
}
