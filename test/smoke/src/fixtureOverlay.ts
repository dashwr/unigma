/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';

const neutralReadme = `# unigma smoke fixture

This is a deterministic workspace used by the smoke test suite.
`;

export function applyNeutralFixtureOverlay(workspacePath: string): void {
	const readmePath = path.join(workspacePath, 'readme.md');
	if (!fs.existsSync(readmePath)) {
		throw new Error(`Smoke fixture is missing ${readmePath}`);
	}

	fs.writeFileSync(readmePath, neutralReadme, 'utf8');

	const git = (args: string[], env?: NodeJS.ProcessEnv): void => {
		const result = cp.spawnSync('git', args, { cwd: workspacePath, env, stdio: 'inherit' });
		if (result.status !== 0) {
			throw new Error(`Could not apply smoke fixture overlay: git ${args.join(' ')}`);
		}
	};

	git(['add', '--', 'readme.md']);
	const commitEnv = {
		...process.env,
		GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
		GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z'
	};
	const staged = cp.spawnSync('git', ['diff', '--cached', '--quiet', '--', 'readme.md'], { cwd: workspacePath });
	if (staged.status === 1) {
		git(['-c', 'user.name=unigma smoke fixture', '-c', 'user.email=unigma-smoke-fixture@invalid', 'commit', '--quiet', '-m', 'Apply neutral smoke fixture overlay'], commitEnv);
	} else if (staged.status !== 0) {
		throw new Error('Could not inspect smoke fixture overlay changes');
	}
}
