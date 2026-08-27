/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 unigma contributors
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AgentRuntimeApplication, RUNTIME_DEMAND_COMMAND } from '../application/runtimeApplication';

interface RuntimeManifest {
	readonly activationEvents?: readonly string[];
	readonly contributes?: {
		readonly commands?: readonly { readonly command?: string }[];
	};
}

suite('Unigma agent runtime activation', () => {
	test('activates only on explicit runtime demand commands', () => {
		const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as RuntimeManifest;
		assert.deepStrictEqual(manifest.activationEvents, [
			`onCommand:${RUNTIME_DEMAND_COMMAND}`,
			'onCommand:unigma.agent.runtime.transport.send',
		]);
		const commands = manifest.contributes?.commands?.map(command => command.command) ?? [];
		assert.ok(commands.includes(RUNTIME_DEMAND_COMMAND), 'activation command must be registered');
		assert.ok(commands.includes('unigma.agent.runtime.transport.send'), 'transport command must be registered');
		assert.ok(!commands.includes('unigma.agent.runtime.registerTransport'), 'transport objects must not cross executeCommand');
	});

	test('does not leave the idle state until demand is received', () => {
		const application = new AgentRuntimeApplication();

		assert.strictEqual(application.state, 'idle');
		assert.strictEqual(application.lastDemand, undefined);

		application.acceptDemand({ source: 'command' });

		assert.strictEqual(application.state, 'demanded');
		assert.deepStrictEqual(application.lastDemand, { source: 'command' });

		application.dispose();
		assert.strictEqual(application.state, 'disposed');
		assert.strictEqual(application.lastDemand, undefined);
	});
});
