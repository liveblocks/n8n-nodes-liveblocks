/* eslint-disable @n8n/community-nodes/credential-test-required -- disabled because webhooks can't be tested against an API */
import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class LiveblocksWebhookSigningSecretApi implements ICredentialType {
	name = 'liveblocksWebhookSigningSecretApi';
	displayName = 'Liveblocks Webhook Signing Secret API';
	documentationUrl = 'https://liveblocks.io/docs/platform/webhooks';
	icon = 'file:liveblocks.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'Webhook Signing Secret',
			name: 'webhookSigningSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				"The webhook signing secret from your Liveblocks project. You can find this in your project's webhook settings at https://liveblocks.io/dashboard",
			placeholder: 'whsec_...',
		},
	];

	// Note: Webhook credentials can't be tested directly since they're only used
	// for signature verification, not API calls
}
