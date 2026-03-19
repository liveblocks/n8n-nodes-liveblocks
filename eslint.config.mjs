import { config } from '@n8n/node-cli/eslint';

/** hey-api generated client — excluded from lint (see package.json n8n.strict) */
export default [
	...(Array.isArray(config) ? config : [config]),
	{ ignores: ['nodes/Liveblocks/client/**/*.gen.ts'] },
];
