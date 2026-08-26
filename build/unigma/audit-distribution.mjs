import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const expected = {
	licenseUrl: 'https://github.com/dashwr/unigma/blob/main/LICENSE.txt',
	repositoryUrl: 'https://github.com/dashwr/unigma.git',
	bugsUrl: 'https://github.com/dashwr/unigma/issues',
};
const prohibitedExtensions = new Set([
	'github',
	'github-authentication',
	'microsoft-authentication',
	'tunnel-forwarding',
]);

const results = [];
function check(name, passed) {
	results.push([name, passed ? 'pass' : 'fail']);
	return passed;
}

function isDirectory(path) {
	return existsSync(path) && statSync(path).isDirectory();
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

const [packageArgument, sourceArgument, ...extraArguments] = process.argv.slice(2);
if (!packageArgument || extraArguments.length > 0) {
	console.log('audit=fail');
	console.log('check.arguments=fail');
	process.exitCode = 1;
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
		} else {
			for (const name of ['product.identity', 'product.license', 'product.licenseFileName', 'product.licenseUrl', 'product.extensionsGallery']) {
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
		const extensionNames = isDirectory(packageExtensions)
			? readdirSync(packageExtensions, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
			: [];
		const prohibited = extensionNames.filter(name => prohibitedExtensions.has(name.toLowerCase()) || name.toLowerCase().includes('copilot'));
		check('extensions.prohibited', prohibited.length === 0);
		console.log(`extensions.prohibited.count=${prohibited.length}`);

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
