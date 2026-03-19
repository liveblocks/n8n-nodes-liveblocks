import { client } from '../client/client.gen';

const DEFAULT_BASE_URL = 'https://api.liveblocks.io/v2';

/**
 * Applies Liveblocks secret key to the generated OpenAPI client (global config).
 * Call once per item before invoking SDK methods.
 */
export function configureLiveblocksClient(secretKey: string): void {
	client.setConfig({
		baseUrl: DEFAULT_BASE_URL,
		headers: {
			Authorization: `Bearer ${secretKey}`,
		},
	});
}
