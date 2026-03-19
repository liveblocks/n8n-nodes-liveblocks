// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports -- dev-only OpenAPI codegen dependency
import { defineConfig } from '@hey-api/openapi-ts';

// TODO: use tagged version of the OpenAPI spec
export default defineConfig({
	input:
		'https://raw.githubusercontent.com/liveblocks/liveblocks/refs/heads/main/docs/references/v2.openapi.json',
	output: 'nodes/Liveblocks/client',
});
