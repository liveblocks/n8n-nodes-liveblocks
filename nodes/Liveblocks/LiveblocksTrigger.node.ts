
import type {
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies the webhook signature from Liveblocks
 * This implements the same signature verification as @liveblocks/node WebhookHandler
 * Reference: https://github.com/liveblocks/liveblocks/blob/main/packages/liveblocks-node/src/webhooks.ts
 */
function verifyWebhookSignature(
	secret: string,
	rawBody: string,
	headers: Record<string, string | undefined>,
): boolean {
	try {
		// Extract required headers
		const webhookId = headers['webhook-id'];
		const timestamp = headers['webhook-timestamp'];
		const rawSignatures = headers['webhook-signature'];
		if (!webhookId || !timestamp || !rawSignatures) {
			return false;
		}

		// Verify timestamp is recent (within 5 minutes)
		const currentTime = Math.floor(Date.now() / 1000);
		const signatureTime = parseInt(timestamp, 10);

		if (isNaN(signatureTime)) {
			return false;
		}

		if (signatureTime < currentTime - 300) {
			return false;
		}

		if (signatureTime > currentTime + 300) {
			return false;
		}

		// Extract secret key (remove "whsec_" prefix if present)
		let secretKey = secret;
		if (secret.startsWith('whsec_')) {
			secretKey = secret.slice('whsec_'.length);
		}

		// Decode the base64 secret
		const secretBuffer = Buffer.from(secretKey, 'base64');

		// Create the signed payload: {webhookId}.{timestamp}.{rawBody}
		const signedPayload = `${webhookId}.${timestamp}.${rawBody}`;

		// Calculate expected signature using HMAC-SHA256
		const hmac = createHmac('sha256', secretBuffer);
		hmac.update(signedPayload, 'utf8');
		const expectedSignature = hmac.digest('base64');

		// Parse signatures from header (format: "v1,sig1 v2,sig2")
		// Split by space to get individual version/signature pairs
		const signatures = rawSignatures
			.split(' ')
			.map((rawSig) => {
				const [, sig] = rawSig.split(',');
				return sig;
			})
			.filter((sig) => sig !== undefined);

		// Check if any of the provided signatures match
		for (const providedSignature of signatures) {
			try {
				const providedBuffer = Buffer.from(providedSignature, 'base64');
				const expectedBuffer = Buffer.from(expectedSignature, 'base64');

				if (
					providedBuffer.length === expectedBuffer.length &&
					timingSafeEqual(providedBuffer, expectedBuffer)
				) {
					return true;
				}
			} catch {
				// Continue to next signature if this one fails
				continue;
			}
		}

		return false;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(error);
		return false;
	}
}

export class LiveblocksTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Liveblocks Trigger',
		name: 'liveblocksTrigger',
		icon: {
			light: 'file:liveblocks.svg',
			dark: 'file:liveblocks.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		description: 'Receives webhook events from Liveblocks',
		subtitle:
			'={{(() => { const events = $parameter["events"] ?? []; const actionLabels = { created: "create", deleted: "delete", updated: "update", sent: "send", opened: "open", clicked: "click", bounced: "bounce", complained: "complain", delivered: "deliver", delivery_delayed: "delay", failed: "fail", received: "receive", scheduled: "schedule", suppressed: "suppress" }; return events.map((event) => { const [resource, action] = event.split("."); if (!resource || !action) { return event; } const actionLabel = actionLabels[action] ?? action.replace(/_/g, " "); return actionLabel + ": " + resource; }).join(", "); })() }}',
		defaults: {
			name: 'Liveblocks Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'liveblocksWebhookSigningSecretApi',
				required: true,
			},
		],
		triggerPanel: {
			header:
				'Copy the webhook URL below and paste it into your Liveblocks dashboard webhook configuration.',
			executionsHelp: {
				inactive:
					'Webhooks have two modes: test and production.<br><br><b>Use test mode while you build your workflow</b>. Click the "Listen for test event" button, then paste the test URL into your Liveblocks webhook configuration. The webhook executions will show up in the editor.<br><br><b>Use production mode to run your workflow automatically</b>. Activate the workflow, then paste the production URL into your Liveblocks webhook configuration. These executions will show up in the executions list, but not in the editor.',
				active:
					'Webhooks have two modes: test and production.<br><br><b>Use test mode while you build your workflow</b>. Click the "Listen for test event" button, then paste the test URL into your Liveblocks webhook configuration. The webhook executions will show up in the editor.<br><br><b>Use production mode to run your workflow automatically</b>. Since the workflow is activated, you can paste the production URL into your Liveblocks webhook configuration. These executions will show up in the executions list, but not in the editor.',
			},
			activationHint:
				"Once you've finished building your workflow, activate it to use the production webhook URL in your Liveblocks dashboard.",
		},
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		usableAsTool: undefined,
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: [],
				description: 'Filter for specific event types. Leave empty to receive all events.',
				options: [
					{
						name: 'Comment Created',
						value: 'commentCreated',
						description: 'Triggered when a comment is created',
					},
					{
						name: 'Comment Deleted',
						value: 'commentDeleted',
						description: 'Triggered when a comment is deleted',
					},
					{
						name: 'Comment Edited',
						value: 'commentEdited',
						description: 'Triggered when a comment is edited',
					},
					{
						name: 'Notification',
						value: 'notification',
						description: 'Triggered for notification events',
					},
					{
						name: 'Storage Updated',
						value: 'storageUpdated',
						description: 'Triggered when storage is updated',
					},
					{
						name: 'Thread Created',
						value: 'threadCreated',
						description: 'Triggered when a thread is created',
					},
					{
						name: 'Thread Deleted',
						value: 'threadDeleted',
						description: 'Triggered when a thread is deleted',
					},
					{
						name: 'Thread Metadata Updated',
						value: 'threadMetadataUpdated',
						description: 'Triggered when thread metadata is updated',
					},
					{
						name: 'User Entered',
						value: 'userEntered',
						description: 'Triggered when a user enters a room',
					},
					{
						name: 'User Left',
						value: 'userLeft',
						description: 'Triggered when a user leaves a room',
					},
					{
						name: 'Yjs Update',
						value: 'yjsUpdate',
						description: 'Triggered when Yjs document is updated',
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Include Headers',
						name: 'includeHeaders',
						type: 'boolean',
						default: false,
						description: 'Whether to include the webhook request headers in the output',
					},
				],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const credentials = await this.getCredentials('liveblocksWebhookSigningSecretApi');
		const webhookSecret = credentials.webhookSigningSecret as string;

		if (!webhookSecret) {
			throw new NodeOperationError(
				this.getNode(),
				'Webhook secret is required. Please configure your credentials.',
			);
		}

		// Get webhook request data
		const headers = this.getHeaderData();
		const bodyData = this.getBodyData();

		// Convert body to string for signature verification
		let rawBody: string;

		if (typeof bodyData === 'string') {
			rawBody = bodyData;
		} else {
			rawBody = JSON.stringify(bodyData);
		}

		// Normalize headers to lowercase for case-insensitive comparison
		const normalizedHeaders: Record<string, string | undefined> = {};
		Object.keys(headers).forEach((key) => {
			const value = headers[key];
			normalizedHeaders[key.toLowerCase()] = typeof value === 'string' ? value : String(value);
		});

		// Verify the webhook signature
		const isValid = verifyWebhookSignature(webhookSecret, rawBody, normalizedHeaders);

		if (!isValid) {
			throw new NodeOperationError(
				this.getNode(),
				'Webhook verification failed: Invalid signature',
				{
					description:
						'Make sure your webhook secret is correct and the request is coming from Liveblocks.',
				},
			);
		}

		// Parse the event
		let event: Record<string, unknown>;
		if (typeof bodyData === 'string') {
			event = JSON.parse(bodyData) as Record<string, unknown>;
		} else {
			event = bodyData as Record<string, unknown>;
		}

		// Get configured event types filter
		const eventsFilter = this.getNodeParameter('events', []) as string[];
		const additionalFields = this.getNodeParameter('additionalFields', {}) as {
			includeHeaders?: boolean;
		};

		// Filter by event type if specified
		if (eventsFilter.length > 0 && !eventsFilter.includes(event.type as string)) {
			// Return empty response if event type doesn't match filter
			return {
				webhookResponse: { status: 200, body: { message: 'Event type filtered' } },
				workflowData: [],
			};
		}

		// Prepare output data
		let outputData: Record<string, unknown> = event;

		if (additionalFields.includeHeaders) {
			outputData = {
				...outputData,
				_headers: headers,
			};
		}

		// Add metadata about the event
		const workflowData = [
			[
				{
					json: {
						event: outputData,
						eventType: event.type as string,
						timestamp: new Date().toISOString(),
					},
				},
			],
		];

		return {
			webhookResponse: { status: 200, body: { message: 'Webhook received successfully' } },
			workflowData,
		};
	}
}
