/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { distributionExcludedExtensions, retiredExtensions } from './distribution-excluded-extensions.ts';

const expected = {
	licenseUrl: 'https://github.com/dashwr/unigma/blob/main/LICENSE.txt',
	repositoryUrl: 'https://github.com/dashwr/unigma.git',
	bugsUrl: 'https://github.com/dashwr/unigma/issues',
};
const prohibitedExtensions = new Set([
	...distributionExcludedExtensions,
	...retiredExtensions,
]);
const prohibitedPackagePaths = new Set([
	'.git',
	'cache',
	'cacheddata',
	'code cache',
	'gpucache',
	'logs',
]);
const prohibitedProductEndpoints = [
	'nodejsArtifactFeed',
	'electronArtifactFeed',
	'reportIssueUrl',
	'voiceWsUrl',
];

const results = [];
function check(name, passed) {
	results.push([name, passed ? 'pass' : 'fail']);
	return passed;
}

function isDirectory(path) {
	return existsSync(path) && statSync(path).isDirectory();
}

function isFile(path) {
	return existsSync(path) && statSync(path).isFile();
}

function isExecutable(path) {
	return isFile(path) && (statSync(path).mode & 0o111) !== 0;
}

function fileHash(path) {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return undefined;
	}
}

function resolveAppDirectory(packageDirectory) {
	const candidates = [
		...(basename(packageDirectory) === 'app' ? [packageDirectory] : []),
		join(packageDirectory, 'resources', 'app'),
	]
		.filter(candidate => isDirectory(candidate))
		.filter(candidate => existsSync(join(candidate, 'product.json')) && existsSync(join(candidate, 'package.json')));
	return candidates.length === 1 ? candidates[0] : undefined;
}

function extensionNotices(sourceDirectory) {
	const extensionsDirectory = join(sourceDirectory, 'extensions');
	if (!isDirectory(extensionsDirectory)) {
		return undefined;
	}
	return readdirSync(extensionsDirectory, { withFileTypes: true })
		.filter(entry => entry.isDirectory() && existsSync(join(extensionsDirectory, entry.name, 'ThirdPartyNotices.txt')))
		.map(entry => entry.name)
		.sort();
}

function getExtensionNames(extensionsDirectory) {
	return isDirectory(extensionsDirectory)
		? readdirSync(extensionsDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
		: [];
}

function prohibitedExtensionNames(names) {
	return names.filter(name => prohibitedExtensions.has(name.toLowerCase()) || name.toLowerCase().includes('copilot'));
}

function uiOnlyExtensionNames(extensionsDirectory) {
	return getExtensionNames(extensionsDirectory).filter(name => {
		const manifest = readJson(join(extensionsDirectory, name, 'package.json'));
		const extensionKind = manifest?.extensionKind;
		return Array.isArray(extensionKind) && extensionKind.length > 0 && extensionKind.every(kind => kind === 'ui');
	});
}

function auditUnigmaThemeExtension(appDirectory, product) {
	const extensionDirectory = join(appDirectory, 'extensions', 'theme-unigma');
	const manifest = readJson(join(extensionDirectory, 'package.json'));
	const darkTheme = join(extensionDirectory, 'themes', 'unigma-dark.json');
	const lightTheme = join(extensionDirectory, 'themes', 'unigma-light.json');
	const themes = manifest?.contributes?.themes;
	check('themeUnigma.present', isDirectory(extensionDirectory));
	check('themeUnigma.identity', manifest?.name === 'theme-unigma' && manifest?.publisher === 'unigma');
	check('themeUnigma.files', isFile(darkTheme) && isFile(lightTheme));
	check('themeUnigma.defaults', product?.onboardingThemes?.some(theme => theme.themeId === 'unigma Dark' && theme.type === 'dark') === true && product?.onboardingThemes?.some(theme => theme.themeId === 'unigma Light' && theme.type === 'light') === true);
	check('themeUnigma.contributes', Array.isArray(themes) && themes.some(theme => theme.id === 'unigma Dark' && theme.path === './themes/unigma-dark.json') && themes.some(theme => theme.id === 'unigma Light' && theme.path === './themes/unigma-light.json'));
}

function packagePaths(packageDirectory) {
	const paths = [];
	function walk(directory) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const entryPath = join(directory, entry.name);
			if (entry.isDirectory()) {
				// A runtime cache is written next to the application or into the
				// user data directory, never inside a dependency tree, while
				// dependency sources legitimately use these names: the server
				// package ships `node_modules/undici/lib/cache` and
				// `node_modules/undici/lib/web/cache`. Walking into node_modules
				// turned the check into a permanent, unavoidable failure for every
				// server build, which is worse than no check because the answer is
				// then to switch it off.
				if (entry.name === 'node_modules') {
					continue;
				}
				if (prohibitedPackagePaths.has(entry.name.toLowerCase())) {
					paths.push(relative(packageDirectory, entryPath).replace(/\\/g, '/'));
					continue;
				}
				walk(entryPath);
			} else if (entry.isFile() && entry.name === '.git') {
				paths.push(relative(packageDirectory, entryPath).replace(/\\/g, '/'));
			}
		}
	}
	walk(packageDirectory);
	return paths.sort();
}

function auditServerPackage(packageDirectory) {
	const layoutChecks = [
		['server.layout.bin', isExecutable(join(packageDirectory, 'bin', 'unigma-server'))],
		['server.layout.productJson', isFile(join(packageDirectory, 'product.json'))],
		['server.layout.packageJson', isFile(join(packageDirectory, 'package.json'))],
		['server.layout.out', isDirectory(join(packageDirectory, 'out'))],
		['server.layout.extensions', isDirectory(join(packageDirectory, 'extensions'))],
		['server.layout.node', isFile(join(packageDirectory, 'node'))],
		['server.layout.license', isFile(join(packageDirectory, 'LICENSE'))],
	];
	check('package.layout', layoutChecks.every(([, passed]) => passed));
	for (const [name, passed] of layoutChecks) {
		check(name, passed);
	}

	const product = readJson(join(packageDirectory, 'product.json'));
	const packageJson = readJson(join(packageDirectory, 'package.json'));
	check('product.json', Boolean(product));
	check('package.json', Boolean(packageJson));

	if (product) {
		check('product.identity', product.nameShort === 'unigma' && product.nameLong === 'unigma' && product.applicationName === 'unigma' && product.serverApplicationName === 'unigma-server' && product.serverDataFolderName === '.unigma-server');
		// The REH packaging profile writes false explicitly; omission is only valid for desktop.
		check('product.extensionsGallery', product.extensionsGallery === false);
		check('product.builtInExtensions', product.builtInExtensions === undefined || (Array.isArray(product.builtInExtensions) && product.builtInExtensions.length === 0));
		check('product.autoUpdateExtensions', product.builtInExtensionsEnabledWithAutoUpdates === undefined || (Array.isArray(product.builtInExtensionsEnabledWithAutoUpdates) && product.builtInExtensionsEnabledWithAutoUpdates.length === 0));
		check('product.endpoints', prohibitedProductEndpoints.every(name => product[name] === ''));
	} else {
		for (const name of ['product.identity', 'product.extensionsGallery', 'product.builtInExtensions', 'product.autoUpdateExtensions', 'product.endpoints']) {
			check(name, false);
		}
	}

	const packageExtensions = join(packageDirectory, 'extensions');
	check('extensions.directory', isDirectory(packageExtensions));
	const names = getExtensionNames(packageExtensions);
	const prohibited = prohibitedExtensionNames(names);
	check('extensions.prohibited', prohibited.length === 0);
	console.log(`extensions.prohibited.count=${prohibited.length}`);
	console.log(`extensions.prohibited.names=${prohibited.join(',')}`);
	const uiOnly = uiOnlyExtensionNames(packageExtensions);
	check('extensions.uiOnly', uiOnly.length === 0);
	console.log(`extensions.uiOnly.count=${uiOnly.length}`);
	console.log(`extensions.uiOnly.names=${uiOnly.join(',')}`);

	const packageDirectoryExists = isDirectory(packageDirectory);
	const prohibitedPaths = packageDirectoryExists ? packagePaths(packageDirectory) : [];
	check('package.transientContent', packageDirectoryExists && prohibitedPaths.length === 0);
	console.log(`package.transientContent.count=${prohibitedPaths.length}`);
	console.log(`package.transientContent.paths=${prohibitedPaths.join(',')}`);
}

const arguments_ = process.argv.slice(2);
const serverProfile = arguments_.includes('--server');
const positionalArguments = serverProfile ? arguments_.filter(argument => argument !== '--server') : arguments_;
const [packageArgument, sourceArgument, ...extraArguments] = positionalArguments;
if (!packageArgument || extraArguments.length > 0) {
	console.log('audit=fail');
	console.log('check.arguments=fail');
	process.exitCode = 1;
} else if (serverProfile) {
	auditServerPackage(resolve(packageArgument));

	for (const [name, value] of results) {
		console.log(`${name}=${value}`);
	}
	const passed = results.length > 0 && results.every(([, value]) => value === 'pass');
	console.log(`audit=${passed ? 'pass' : 'fail'}`);
	if (!passed) {
		process.exitCode = 1;
	}
} else {
	const packageDirectory = resolve(packageArgument);
	const appDirectory = resolveAppDirectory(packageDirectory);
	check('package.layout', Boolean(appDirectory));

	if (appDirectory) {
		const product = readJson(join(appDirectory, 'product.json'));
		const packageJson = readJson(join(appDirectory, 'package.json'));
		check('product.json', Boolean(product));
		check('package.json', Boolean(packageJson));

		if (product) {
			check('product.identity', product.nameShort === 'unigma' && product.nameLong === 'unigma' && product.applicationName === 'unigma');
			check('product.license', product.licenseName === 'MIT');
			check('product.licenseFileName', product.licenseFileName === 'LICENSE.txt');
			check('product.licenseUrl', product.licenseUrl === expected.licenseUrl);
			check('product.extensionsGallery', product.extensionsGallery === undefined || product.extensionsGallery === null);
			check('product.builtInExtensions', Array.isArray(product.builtInExtensions) && product.builtInExtensions.length === 0);
			check('product.autoUpdateExtensions', Array.isArray(product.builtInExtensionsEnabledWithAutoUpdates) && product.builtInExtensionsEnabledWithAutoUpdates.length === 0);
			check('product.endpoints', prohibitedProductEndpoints.every(name => product[name] === ''));
		} else {
			for (const name of ['product.identity', 'product.license', 'product.licenseFileName', 'product.licenseUrl', 'product.extensionsGallery', 'product.builtInExtensions', 'product.autoUpdateExtensions', 'product.endpoints']) {
				check(name, false);
			}
		}

		if (packageJson) {
			check('package.name', packageJson.name === 'unigma');
			check('package.author', packageJson.author?.name === 'Unigma contributors');
			check('package.repository', packageJson.repository?.type === 'git' && packageJson.repository?.url === expected.repositoryUrl);
			check('package.bugs', packageJson.bugs?.url === expected.bugsUrl);
		} else {
			for (const name of ['package.name', 'package.author', 'package.repository', 'package.bugs']) {
				check(name, false);
			}
		}

		const packageExtensions = join(appDirectory, 'extensions');
		check('extensions.directory', isDirectory(packageExtensions));
		auditUnigmaThemeExtension(appDirectory, product);
		const extensionNames = getExtensionNames(packageExtensions);
		const prohibited = prohibitedExtensionNames(extensionNames);
		check('extensions.prohibited', prohibited.length === 0);
		console.log(`extensions.prohibited.count=${prohibited.length}`);

		const prohibitedPaths = packagePaths(packageDirectory);
		check('package.transientContent', prohibitedPaths.length === 0);
		console.log(`package.transientContent.count=${prohibitedPaths.length}`);

		if (sourceArgument) {
			const sourceDirectory = resolve(sourceArgument);
			check('source.layout', isDirectory(sourceDirectory));
			for (const file of ['LICENSE.txt', 'ThirdPartyNotices.txt']) {
				const packageFile = join(appDirectory, file);
				const sourceFile = join(sourceDirectory, file);
				const present = existsSync(packageFile) && existsSync(sourceFile);
				check(`${file}.present`, present);
				check(`${file}.sha256`, present && fileHash(packageFile) === fileHash(sourceFile));
			}

			const notices = extensionNotices(sourceDirectory);
			check('extensions.notices.source', Boolean(notices));
			if (notices) {
				check('extensions.notices', notices.every(name => existsSync(join(packageExtensions, name, 'ThirdPartyNotices.txt'))));
				console.log(`extensions.notices.expected=${notices.length}`);
			} else {
				check('extensions.notices', false);
			}
		}
	}

	for (const [name, value] of results) {
		console.log(`${name}=${value}`);
	}
	const passed = results.length > 0 && results.every(([, value]) => value === 'pass');
	console.log(`audit=${passed ? 'pass' : 'fail'}`);
	if (!passed) {
		process.exitCode = 1;
	}
}
