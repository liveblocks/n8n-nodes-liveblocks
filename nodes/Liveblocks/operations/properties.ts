import type { INodeProperties } from 'n8n-workflow';

import {
	getDefinitionsForResource,
	LIVEBLOCKS_RESOURCES,
	operationsUsingPathKey,
	operationsWithBinaryDownload,
	operationsWithBinaryUpload,
	operationsWithSplit,
} from './registry';
import { buildStructuredOperationProperties } from './structuredFields';
import type { LiveblocksResource, PathParamKey } from './types';

const RESOURCE_MENU: Array<{ name: string; value: LiveblocksResource; description: string }> = [
	{
		name: 'Room',
		value: 'room',
		description: 'Rooms, presence, and broadcast',
	},
	{ name: 'Storage', value: 'storage', description: 'Liveblocks Storage document' },
	{ name: 'Yjs', value: 'yjs', description: 'Yjs documents and versions' },
	{ name: 'Thread', value: 'thread', description: 'Comment threads' },
	{ name: 'Comment', value: 'comment', description: 'Comments and reactions' },
	{ name: 'Attachment', value: 'attachment', description: 'Attachment metadata and URLs' },
	{ name: 'Auth', value: 'auth', description: 'Access tokens and ID tokens' },
	{
		name: 'User',
		value: 'user',
		description: 'Inbox notifications, settings, and subscriptions',
	},
	{ name: 'Inbox', value: 'inbox', description: 'Trigger and system inbox actions' },
	{ name: 'Group', value: 'group', description: 'Groups and membership' },
	{ name: 'AI Copilot', value: 'aiCopilot', description: 'AI copilots' },
	{ name: 'AI Knowledge', value: 'aiKnowledge', description: 'Knowledge sources' },
];

const PATH_LABELS: Record<PathParamKey, { displayName: string; description: string }> = {
	roomId: {
		displayName: 'Room ID',
		description: 'Liveblocks room identifier',
	},
	threadId: {
		displayName: 'Thread ID',
		description: 'Thread identifier',
	},
	commentId: {
		displayName: 'Comment ID',
		description: 'Comment identifier',
	},
	userId: {
		displayName: 'User ID',
		description: 'User identifier',
	},
	groupId: {
		displayName: 'Group ID',
		description: 'Group identifier',
	},
	copilotId: {
		displayName: 'Copilot ID',
		description: 'AI copilot identifier',
	},
	knowledgeSourceId: {
		displayName: 'Knowledge Source ID',
		description: 'Knowledge source identifier',
	},
	versionId: {
		displayName: 'Version ID',
		description: 'Yjs version identifier',
	},
	attachmentId: {
		displayName: 'Attachment ID',
		description: 'Attachment identifier',
	},
	inboxNotificationId: {
		displayName: 'Inbox Notification ID',
		description: 'Inbox notification identifier',
	},
	name: {
		displayName: 'Knowledge File Name',
		description: 'File name segment in the URL when uploading (e.g. document.pdf)',
	},
};

function pathProperty(key: PathParamKey): INodeProperties {
	const meta = PATH_LABELS[key];
	return {
		displayName: meta.displayName,
		name: key,
		type: 'string',
		default: '',
		required: true,
		description: meta.description,
		displayOptions: {
			show: {
				operation: operationsUsingPathKey(key),
			},
		},
	};
}

export function buildLiveblocksProperties(): INodeProperties[] {
	const properties: INodeProperties[] = [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: RESOURCE_MENU.filter((r) => LIVEBLOCKS_RESOURCES.includes(r.value)),
			default: 'room',
		},
	];

	for (const res of LIVEBLOCKS_RESOURCES) {
		const defs = getDefinitionsForResource(res);
		const firstOp = defs[0]?.operation ?? '';
		properties.push({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: [res],
				},
			},
			options: defs.map((d) => ({
				name: d.name,
				value: d.operation,
				description: d.description,
				action: d.action,
			})),
			default: firstOp,
		});
	}

	const pathKeys: PathParamKey[] = [
		'roomId',
		'threadId',
		'commentId',
		'userId',
		'groupId',
		'copilotId',
		'knowledgeSourceId',
		'versionId',
		'attachmentId',
		'inboxNotificationId',
		'name',
	];
	for (const pk of pathKeys) {
		properties.push(pathProperty(pk));
	}

	properties.push(...buildStructuredOperationProperties());

	properties.push(
		{
			displayName: 'Input Binary Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			description: 'Input binary field name on the item to send as application/octet-stream',
			displayOptions: {
				show: {
					operation: operationsWithBinaryUpload(),
				},
			},
		},
		{
			displayName: 'Output Binary Field',
			name: 'binaryOutputProperty',
			type: 'string',
			default: 'data',
			description: 'Binary field name to store downloaded octet-stream responses',
			displayOptions: {
				show: {
					operation: operationsWithBinaryDownload(),
				},
			},
		},
		{
			displayName: 'Output File Name',
			name: 'binaryOutputFileName',
			type: 'string',
			default: 'liveblocks.bin',
			description: 'File name attached to downloaded binary data',
			displayOptions: {
				show: {
					operation: operationsWithBinaryDownload(),
				},
			},
		},
		{
			displayName: 'MIME Type',
			name: 'binaryMimeType',
			type: 'string',
			default: 'application/octet-stream',
			description: 'MIME type for downloaded binary data',
			displayOptions: {
				show: {
					operation: operationsWithBinaryDownload(),
				},
			},
		},
		{
			displayName: 'Split Into Items',
			name: 'splitIntoItems',
			type: 'boolean',
			default: true,
			description:
				'Whether to output one n8n item per element when the API returns a list under `data` (includes `nextCursor` on each item when present)',
			displayOptions: {
				show: {
					operation: operationsWithSplit(),
				},
			},
		},
		{
			displayName: 'Include Request in Error',
			name: 'includeRequestInError',
			type: 'boolean',
			default: false,
			description:
				'Whether failed API calls should include the outgoing URL, method, redacted headers, body, and response body (truncated) in the error description for debugging',
		},
	);

	return properties;
}
