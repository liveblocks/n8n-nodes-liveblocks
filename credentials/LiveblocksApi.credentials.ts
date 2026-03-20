import type { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class LiveblocksApi implements ICredentialType {
	name = 'liveblocksApi';
	displayName = 'Liveblocks API';
	documentationUrl = 'https://liveblocks.io/docs/api-reference/rest-api-endpoints';
	icon = 'file:liveblocks.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'The secret key from your Liveblocks project. You can find this in your project settings at https://liveblocks.io/dashboard',
			placeholder: 'sk_...',
		},
	];

	// Test the credentials by making a simple API call
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.liveblocks.io/v2',
			url: '/rooms',
			method: 'GET',
			headers: {
				Authorization: '=Bearer {{$credentials.secretKey}}',
			},
		},
	};
}
