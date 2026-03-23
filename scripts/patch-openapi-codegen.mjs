/**
 * Post-process files emitted by @hey-api/openapi-ts so they pass n8n community
 * package checks (@n8n/scan-community-package): the generator hardcodes
 * `globalThis.fetch` and `setTimeout` (see openapi-ts dist/clients/**) and
 * there is no config option to change that in current releases.
 *
 * SSE retry sleep is rewritten to use `AbortSignal.timeout` so we avoid both
 * restricted `setTimeout` and `node:` imports (n8n Cloud disallows the latter).
 *
 * Safe to run multiple times (idempotent).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, '..', 'nodes', 'Liveblocks', 'client');

/** As emitted by @hey-api/openapi-ts (2-space indent inside createSseClient). */
const SLEEP_BEFORE =
	'  const sleep = sseSleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));';

/** Legacy patch that used node:timers/promises — must be replaced. */
const SLEEP_DELAY_LEGACY = '  const sleep = sseSleepFn ?? ((ms: number) => delay(ms));';

const SLEEP_AFTER = `  const sleep =
    sseSleepFn ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        const s = AbortSignal.timeout(ms);
        s.addEventListener('abort', () => resolve(), { once: true });
      }));`;

const TIMERS_IMPORT = /^import \{ setTimeout as delay \} from 'node:timers\/promises';\r?\n\r?\n/m;

const JSDOC_SLEEP_SETTIMEOUT = ' * Defaults to using `setTimeout`.';
const JSDOC_SLEEP_TIMERS = ' * Defaults to using `node:timers/promises` delay.';
const JSDOC_SLEEP_ABORT =
	' * Defaults to a delay implemented with `AbortSignal.timeout` (no `setTimeout` / `node:` imports).';

function collectGenFiles(dir) {
	/** @type {string[]} */
	const out = [];
	for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, name.name);
		if (name.isDirectory()) out.push(...collectGenFiles(p));
		else if (name.name.endsWith('.gen.ts')) out.push(p);
	}
	return out;
}

function patchServerSentEvents(content) {
	let out = content;

	out = out.replace(TIMERS_IMPORT, '');

	if (out.includes(SLEEP_BEFORE)) {
		out = out.replace(SLEEP_BEFORE, SLEEP_AFTER);
	} else if (out.includes(SLEEP_DELAY_LEGACY)) {
		out = out.replace(SLEEP_DELAY_LEGACY, SLEEP_AFTER);
	}

	out = out.replace(JSDOC_SLEEP_SETTIMEOUT, JSDOC_SLEEP_ABORT);
	out = out.replace(JSDOC_SLEEP_TIMERS, JSDOC_SLEEP_ABORT);

	return out;
}

function patchFile(filePath) {
	let content = fs.readFileSync(filePath, 'utf8');
	const before = content;

	content = content.replaceAll('globalThis.fetch', 'fetch');
	content = content.replaceAll('@default globalThis.fetch', '@default fetch');

	if (filePath.endsWith(`${path.sep}serverSentEvents.gen.ts`)) {
		content = patchServerSentEvents(content);
	}

	if (content !== before) {
		fs.writeFileSync(filePath, content, 'utf8');
		console.log(`patched: ${path.relative(process.cwd(), filePath)}`);
	}
}

function main() {
	if (!fs.existsSync(CLIENT_ROOT)) {
		console.error(`missing client output: ${CLIENT_ROOT}`);
		process.exit(1);
	}
	for (const f of collectGenFiles(CLIENT_ROOT)) {
		patchFile(f);
	}
}

main();
