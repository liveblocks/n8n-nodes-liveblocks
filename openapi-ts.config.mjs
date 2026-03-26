/**
 * 
 * Note: to stay compliant with n8n's package checks ,@hey-api/openapi-ts MUST NOT be installed,
 * even as a devDependency, so this file must stay plain JS with no imports from that package.
 *
 * Excludes the Management tag (Liveblocks `/management/projects/...` REST API) from codegen.
 * @see https://heyapi.dev/openapi-ts/configuration/parser
 */
export default {
	input:
		'https://raw.githubusercontent.com/liveblocks/liveblocks/refs/heads/main/docs/references/v2.openapi.json',
	output: 'nodes/Liveblocks/client',
	parser: {
		filters: {
			tags: {
				exclude: ['Management'],
			},
		},
	},
};
