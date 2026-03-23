import type { INodeProperties } from 'n8n-workflow';

import { RAW_BODY_OPERATIONS, ROOM_PERMISSION_OPTIONS } from './requestAssembly';

function showOp(operation: string): { displayOptions: { show: { operation: string[] } } } {
	return {
		displayOptions: {
			show: {
				operation: [operation],
			},
		},
	};
}

function accessRowsProperty(
	name: string,
	displayName: string,
	description: string,
	operation: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Access',
		default: {},
		description,
		options: [
			{
				displayName: 'Entry',
				name: 'entries',
				values: [
					{
						displayName: 'User or Group ID',
						name: 'subjectId',
						type: 'string',
						default: '',
						description: 'User ID or group ID for this access row',
					},
					{
						displayName: 'Clear Access for This ID',
						name: 'clearAccess',
						type: 'boolean',
						default: false,
						description:
							'Whether to clear all access for this ID (update/upsert only; ignored for create when granting)',
					},
					{
						displayName: 'Permissions',
						name: 'permissions',
						type: 'multiOptions',
						options: ROOM_PERMISSION_OPTIONS,
						default: [],
						description: 'Permissions to grant when not clearing',
					},
				],
			},
		],
		...showOp(operation),
	};
}

/** Extra node parameters for structured query/body (see requestAssembly.ts). */
export function buildStructuredOperationProperties(): INodeProperties[] {
	const props: INodeProperties[] = [
		// --- Query: getRooms ---
		{
			displayName: 'Limit',
			name: 'q_getRooms_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			description: 'Max rooms to return (1–100, default 20)',
			...showOp('getRooms'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getRooms_startingAfter',
			type: 'string',
			default: '',
			description: 'Pagination cursor from previous response `nextCursor`',
			...showOp('getRooms'),
		},
		{
			displayName: 'Organization ID',
			name: 'q_getRooms_organizationId',
			type: 'string',
			default: '',
			description: 'Filter by organization ID',
			...showOp('getRooms'),
		},
		{
			displayName: 'Search Query',
			name: 'q_getRooms_query',
			type: 'string',
			default: '',
			description: 'Room filter query language expression',
			...showOp('getRooms'),
		},
		{
			displayName: 'Filter by User ID',
			name: 'q_getRooms_userId',
			type: 'string',
			default: '',
			description: 'Filter on users accesses',
			...showOp('getRooms'),
		},
		{
			displayName: 'Filter by Group IDs',
			name: 'q_getRooms_groupIds',
			type: 'string',
			default: '',
			description: 'Filter on group accesses',
			...showOp('getRooms'),
		},
		// --- Query: createRoom ---
		{
			displayName: 'Idempotent Create',
			name: 'q_createRoom_idempotent',
			type: 'boolean',
			default: false,
			description:
				'Whether to return the existing room when it already exists instead of returning 409 (get-or-create)',
			...showOp('createRoom'),
		},
		// --- Query: getStorageDocument ---
		{
			displayName: 'Format',
			name: 'q_getStorageDocument_format',
			type: 'options',
			options: [
				{ name: 'Plain LSON', value: 'plain-lson' },
				{ name: 'JSON', value: 'json' },
			],
			default: 'plain-lson',
			description: 'Storage output format',
			...showOp('getStorageDocument'),
		},
		// --- Query: getYjsDocument ---
		{
			displayName: 'Formatting',
			name: 'q_getYjsDocument_formatting',
			type: 'boolean',
			default: false,
			description: 'Whether to include YText formatting',
			...showOp('getYjsDocument'),
		},
		{
			displayName: 'Key',
			name: 'q_getYjsDocument_key',
			type: 'string',
			default: '',
			description: 'Return only this key’s value',
			...showOp('getYjsDocument'),
		},
		{
			displayName: 'Yjs Type Override',
			name: 'q_getYjsDocument_type',
			type: 'options',
			options: [
				{ name: 'Y.Array', value: 'yarray' },
				{ name: 'Y.Map', value: 'ymap' },
				{ name: 'Y.Text', value: 'ytext' },
				{ name: 'Y.XmlFragment', value: 'yxmlfragment' },
				{ name: 'Y.XmlText', value: 'yxmltext' },
			],
			default: 'ymap',
			description: 'Used with Key to override inferred type',
			...showOp('getYjsDocument'),
		},
		// --- Query: sendYjsBinaryUpdate ---
		{
			displayName: 'Subdocument GUID',
			name: 'q_sendYjsBinaryUpdate_guid',
			type: 'string',
			default: '',
			description: 'Optional subdocument ID',
			...showOp('sendYjsBinaryUpdate'),
		},
		// --- Query: getYjsDocumentAsBinaryUpdate ---
		{
			displayName: 'Subdocument GUID',
			name: 'q_getYjsDocumentAsBinaryUpdate_guid',
			type: 'string',
			default: '',
			description: 'Optional subdocument ID',
			...showOp('getYjsDocumentAsBinaryUpdate'),
		},
		// --- Query: getYjsVersions ---
		{
			displayName: 'Limit',
			name: 'q_getYjsVersions_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			...showOp('getYjsVersions'),
		},
		{
			displayName: 'Cursor',
			name: 'q_getYjsVersions_cursor',
			type: 'string',
			default: '',
			...showOp('getYjsVersions'),
		},
		// --- Query: getThreads ---
		{
			displayName: 'Search Query',
			name: 'q_getThreads_query',
			type: 'string',
			default: '',
			description: 'Thread filter query language expression',
			...showOp('getThreads'),
		},
		// --- Query: getInboxNotifications ---
		{
			displayName: 'Organization ID',
			name: 'q_getInboxNotifications_organizationId',
			type: 'string',
			default: '',
			...showOp('getInboxNotifications'),
		},
		{
			displayName: 'Search Query',
			name: 'q_getInboxNotifications_query',
			type: 'string',
			default: '',
			...showOp('getInboxNotifications'),
		},
		{
			displayName: 'Limit',
			name: 'q_getInboxNotifications_limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1, maxValue: 50 },
			...showOp('getInboxNotifications'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getInboxNotifications_startingAfter',
			type: 'string',
			default: '',
			...showOp('getInboxNotifications'),
		},
		// --- Query: getUserRoomSubscriptionSettings ---
		{
			displayName: 'Starting After',
			name: 'q_getUserRoomSubscriptionSettings_startingAfter',
			type: 'string',
			default: '',
			...showOp('getUserRoomSubscriptionSettings'),
		},
		{
			displayName: 'Limit',
			name: 'q_getUserRoomSubscriptionSettings_limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1, maxValue: 50 },
			...showOp('getUserRoomSubscriptionSettings'),
		},
		{
			displayName: 'Organization ID',
			name: 'q_getUserRoomSubscriptionSettings_organizationId',
			type: 'string',
			default: '',
			...showOp('getUserRoomSubscriptionSettings'),
		},
		// --- Query: getGroups ---
		{
			displayName: 'Limit',
			name: 'q_getGroups_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			...showOp('getGroups'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getGroups_startingAfter',
			type: 'string',
			default: '',
			...showOp('getGroups'),
		},
		// --- Query: getUserGroups ---
		{
			displayName: 'Limit',
			name: 'q_getUserGroups_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			...showOp('getUserGroups'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getUserGroups_startingAfter',
			type: 'string',
			default: '',
			...showOp('getUserGroups'),
		},
		// --- Query: getAiCopilots ---
		{
			displayName: 'Limit',
			name: 'q_getAiCopilots_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			...showOp('getAiCopilots'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getAiCopilots_startingAfter',
			type: 'string',
			default: '',
			...showOp('getAiCopilots'),
		},
		// --- Query: getKnowledgeSources ---
		{
			displayName: 'Limit',
			name: 'q_getKnowledgeSources_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			...showOp('getKnowledgeSources'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getKnowledgeSources_startingAfter',
			type: 'string',
			default: '',
			...showOp('getKnowledgeSources'),
		},
		// --- Query: getWebKnowledgeSourceLinks ---
		{
			displayName: 'Limit',
			name: 'q_getWebKnowledgeSourceLinks_limit',
			type: 'number',
			default: 20,
			typeOptions: { minValue: 1, maxValue: 100 },
			...showOp('getWebKnowledgeSourceLinks'),
		},
		{
			displayName: 'Starting After',
			name: 'q_getWebKnowledgeSourceLinks_startingAfter',
			type: 'string',
			default: '',
			...showOp('getWebKnowledgeSourceLinks'),
		},
	];

	// Raw JSON body (broadcast, patch storage)
	for (const op of Array.from(RAW_BODY_OPERATIONS)) {
		// eslint-disable-next-line n8n-nodes-base/node-param-default-missing
		props.push({
			displayName: 'Body',
			name: 'body',
			type: 'json',
			default: op === 'patchStorageDocument' ? '[]' : '{}',
			description:
				op === 'patchStorageDocument'
					? 'JSON Patch array (RFC 6902 operations)'
					: 'Any JSON payload to broadcast to the room',
			...showOp(op),
		});
	}

	// --- createRoom body ---
	props.push(
		{
			displayName: 'Room ID',
			name: 'createRoom_id',
			type: 'string',
			default: '',
			required: true,
			description: 'Unique room identifier',
			...showOp('createRoom'),
		},
		{
			displayName: 'Default Accesses',
			name: 'createRoom_defaultAccesses',
			type: 'multiOptions',
			options: ROOM_PERMISSION_OPTIONS,
			default: [],
			required: true,
			description: 'Default permissions for the room',
			...showOp('createRoom'),
		},
		{
			displayName: 'Organization ID',
			name: 'createRoom_organizationId',
			type: 'string',
			default: '',
			description: 'Defaults to "default" if empty',
			...showOp('createRoom'),
		},
		accessRowsProperty(
			'createRoom_usersAccessEntries',
			'Users Access',
			'Per-user permission overrides',
			'createRoom',
		),
		accessRowsProperty(
			'createRoom_groupsAccessEntries',
			'Groups Access',
			'Per-group permission overrides',
			'createRoom',
		),
		{
			displayName: 'Metadata',
			name: 'createRoom_metadata',
			type: 'json',
			default: '{}',
			description: 'String or string[] values per key',
			...showOp('createRoom'),
		},
		{
			displayName: 'Storage Engine',
			name: 'createRoom_engine',
			type: 'options',
			options: [
				{ name: 'Default (Omit)', value: '' },
				{ name: '1', value: '1' },
				{ name: '2', value: '2' },
			],
			default: '',
			description: 'Preferred storage engine version when creating the room',
			...showOp('createRoom'),
		},
	);

	// --- updateRoom ---
	props.push(
		{
			displayName: 'Clear Default Accesses',
			name: 'updateRoom_clearDefaultAccesses',
			type: 'boolean',
			default: false,
			description: 'Whether to set defaultAccesses to null',
			...showOp('updateRoom'),
		},
		{
			displayName: 'Default Accesses',
			name: 'updateRoom_defaultAccesses',
			type: 'multiOptions',
			options: ROOM_PERMISSION_OPTIONS,
			default: [],
			description: 'Ignored when clearing default accesses',
			...showOp('updateRoom'),
		},
		accessRowsProperty(
			'updateRoom_usersAccessEntries',
			'Users Access',
			'Per-user permissions; use Clear on a row to remove a user’s access',
			'updateRoom',
		),
		accessRowsProperty(
			'updateRoom_groupsAccessEntries',
			'Groups Access',
			'Per-group permissions; use Clear on a row to remove a group’s access',
			'updateRoom',
		),
		{
			displayName: 'Metadata',
			name: 'updateRoom_metadata',
			type: 'json',
			default: '{}',
			description: 'String, string[], or null per key',
			...showOp('updateRoom'),
		},
	);

	// --- upsertRoom ---
	props.push(
		{
			displayName: 'Clear Default Accesses',
			name: 'upsertRoom_clearDefaultAccesses',
			type: 'boolean',
			default: false,
			...showOp('upsertRoom'),
		},
		{
			displayName: 'Default Accesses',
			name: 'upsertRoom_defaultAccesses',
			type: 'multiOptions',
			options: ROOM_PERMISSION_OPTIONS,
			default: [],
			...showOp('upsertRoom'),
		},
		accessRowsProperty(
			'upsertRoom_usersAccessEntries',
			'Users Access (update)',
			'Applied in the `update` object',
			'upsertRoom',
		),
		accessRowsProperty(
			'upsertRoom_groupsAccessEntries',
			'Groups Access (update)',
			'Applied in the `update` object',
			'upsertRoom',
		),
		{
			displayName: 'Metadata (update)',
			name: 'upsertRoom_metadata',
			type: 'json',
			default: '{}',
			...showOp('upsertRoom'),
		},
		{
			displayName: 'Create Branch',
			name: 'upsertRoom_create',
			type: 'json',
			default: '{}',
			description:
				'Optional fields used when the room is created (no `ID` in the body — it comes from the path). When non-empty, must include `defaultAccesses` (array). May include organizationId, usersAccesses, groupsAccesses, metadata',
			...showOp('upsertRoom'),
		},
	);

	props.push(
		{
			displayName: 'New Room ID',
			name: 'updateRoomId_newRoomId',
			type: 'string',
			default: '',
			required: true,
			...showOp('updateRoomId'),
		},
		{
			displayName: 'From Organization ID',
			name: 'updateRoomOrganizationId_fromOrganizationId',
			type: 'string',
			default: '',
			required: true,
			...showOp('updateRoomOrganizationId'),
		},
		{
			displayName: 'To Organization ID',
			name: 'updateRoomOrganizationId_toOrganizationId',
			type: 'string',
			default: '',
			required: true,
			...showOp('updateRoomOrganizationId'),
		},
	);

	// setPresence
	props.push(
		{
			displayName: 'User ID',
			name: 'setPresence_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('setPresence'),
		},
		{
			displayName: 'Presence Data',
			name: 'setPresence_data',
			type: 'json',
			default: '{}',
			required: true,
			description: 'Arbitrary JSON presence payload',
			...showOp('setPresence'),
		},
		{
			displayName: 'User Info',
			name: 'setPresence_userInfo',
			type: 'json',
			default: '{}',
			required: true,
			description: 'Metadata about the user or agent (name, avatar, color, etc.); use {} if none',
			...showOp('setPresence'),
		},
		{
			displayName: 'TTL (seconds)',
			name: 'setPresence_ttl',
			type: 'number',
			default: 0,
			description: '2–3599; omit or 0 to skip',
			typeOptions: { minValue: 0, maxValue: 3599 },
			...showOp('setPresence'),
		},
	);

	// initializeStorage
	props.push(
		{
			displayName: 'Liveblocks Type',
			name: 'initializeStorageDocument_liveblocksType',
			type: 'options',
			options: [{ name: 'LiveObject', value: 'LiveObject' }],
			default: 'LiveObject',
			required: true,
			description: 'Root storage type when initializing',
			...showOp('initializeStorageDocument'),
		},
		{
			displayName: 'Initial Data',
			name: 'initializeStorageDocument_data',
			type: 'json',
			default: '{}',
			required: true,
			description: 'Initial LiveObject data (use {} for empty)',
			...showOp('initializeStorageDocument'),
		},
	);

	// createThread
	props.push(
		{
			displayName: 'Comment User ID',
			name: 'createThread_commentUserId',
			type: 'string',
			default: '',
			required: true,
			...showOp('createThread'),
		},
		{
			displayName: 'Comment Created At',
			name: 'createThread_commentCreatedAt',
			type: 'string',
			default: '',
			description: 'ISO 8601; optional',
			...showOp('createThread'),
		},
		{
			displayName: 'Comment Body',
			name: 'createThread_commentBody',
			type: 'json',
			default: '{}',
			required: true,
			description: 'CommentBody: version + content blocks',
			...showOp('createThread'),
		},
		{
			displayName: 'Comment Metadata',
			name: 'createThread_commentMetadata',
			type: 'json',
			default: '{}',
			...showOp('createThread'),
		},
		{
			displayName: 'Comment Attachment IDs',
			name: 'createThread_commentAttachmentIds',
			type: 'string',
			default: '',
			description: 'JSON array of attachment IDs or comma-separated list',
			...showOp('createThread'),
		},
		{
			displayName: 'Thread Metadata',
			name: 'createThread_threadMetadata',
			type: 'json',
			default: '{}',
			...showOp('createThread'),
		},
	);

	// editThreadMetadata
	props.push(
		{
			displayName: 'User ID',
			name: 'editThreadMetadata_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('editThreadMetadata'),
		},
		{
			displayName: 'Metadata',
			name: 'editThreadMetadata_metadata',
			type: 'json',
			default: '{}',
			required: true,
			...showOp('editThreadMetadata'),
		},
		{
			displayName: 'Updated At',
			name: 'editThreadMetadata_updatedAt',
			type: 'string',
			default: '',
			...showOp('editThreadMetadata'),
		},
	);

	for (const op of ['markThreadAsResolved', 'markThreadAsUnresolved'] as const) {
		props.push({
			displayName: 'User ID',
			name: `${op}_userId`,
			type: 'string',
			default: '',
			required: true,
			...showOp(op),
		});
	}

	props.push(
		{
			displayName: 'User ID',
			name: 'subscribeToThread_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('subscribeToThread'),
		},
		{
			displayName: 'User ID',
			name: 'unsubscribeFromThread_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('unsubscribeFromThread'),
		},
	);

	// comments
	props.push(
		{
			displayName: 'User ID',
			name: 'createComment_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('createComment'),
		},
		{
			displayName: 'Created At',
			name: 'createComment_createdAt',
			type: 'string',
			default: '',
			...showOp('createComment'),
		},
		{
			displayName: 'Body',
			name: 'createComment_body',
			type: 'json',
			default: '{}',
			required: true,
			...showOp('createComment'),
		},
		{
			displayName: 'Metadata',
			name: 'createComment_metadata',
			type: 'json',
			default: '{}',
			...showOp('createComment'),
		},
		{
			displayName: 'Attachment IDs',
			name: 'createComment_attachmentIds',
			type: 'string',
			default: '',
			description: 'JSON array of IDs or comma-separated list',
			...showOp('createComment'),
		},
		{
			displayName: 'Body',
			name: 'editComment_body',
			type: 'json',
			default: '{}',
			...showOp('editComment'),
		},
		{
			displayName: 'Metadata',
			name: 'editComment_metadata',
			type: 'json',
			default: '{}',
			...showOp('editComment'),
		},
		{
			displayName: 'Edited At',
			name: 'editComment_editedAt',
			type: 'string',
			default: '',
			...showOp('editComment'),
		},
		{
			displayName: 'Attachment IDs',
			name: 'editComment_attachmentIds',
			type: 'string',
			default: '',
			description: 'JSON array or comma-separated',
			...showOp('editComment'),
		},
		{
			displayName: 'User ID',
			name: 'addCommentReaction_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('addCommentReaction'),
		},
		{
			displayName: 'Emoji',
			name: 'addCommentReaction_emoji',
			type: 'string',
			default: '',
			required: true,
			...showOp('addCommentReaction'),
		},
		{
			displayName: 'Created At',
			name: 'addCommentReaction_createdAt',
			type: 'string',
			default: '',
			...showOp('addCommentReaction'),
		},
		{
			displayName: 'User ID',
			name: 'removeCommentReaction_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('removeCommentReaction'),
		},
		{
			displayName: 'Emoji',
			name: 'removeCommentReaction_emoji',
			type: 'string',
			default: '',
			required: true,
			...showOp('removeCommentReaction'),
		},
		{
			displayName: 'Removed At',
			name: 'removeCommentReaction_removedAt',
			type: 'string',
			default: '',
			...showOp('removeCommentReaction'),
		},
		{
			displayName: 'User ID',
			name: 'editCommentMetadata_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('editCommentMetadata'),
		},
		{
			displayName: 'Metadata',
			name: 'editCommentMetadata_metadata',
			type: 'json',
			default: '{}',
			required: true,
			...showOp('editCommentMetadata'),
		},
		{
			displayName: 'Updated At',
			name: 'editCommentMetadata_updatedAt',
			type: 'string',
			default: '',
			...showOp('editCommentMetadata'),
		},
	);

	// auth
	props.push(
		{
			displayName: 'User ID',
			name: 'authorizeUser_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('authorizeUser'),
		},
		{
			displayName: 'Permissions',
			name: 'authorizeUser_permissions',
			type: 'json',
			default: '{}',
			required: true,
			description: 'Map of resource name to permission strings',
			...showOp('authorizeUser'),
		},
		{
			displayName: 'Organization ID',
			name: 'authorizeUser_organizationId',
			type: 'string',
			default: '',
			...showOp('authorizeUser'),
		},
		{
			displayName: 'User Info',
			name: 'authorizeUser_userInfo',
			type: 'json',
			default: '{}',
			...showOp('authorizeUser'),
		},
		{
			displayName: 'Merge (advanced JSON)',
			name: 'authorizeUser_extra',
			type: 'json',
			default: '{}',
			description: 'Merged onto the body for uncommon fields',
			...showOp('authorizeUser'),
		},
		{
			displayName: 'User ID',
			name: 'identifyUser_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('identifyUser'),
		},
		{
			displayName: 'Organization ID',
			name: 'identifyUser_organizationId',
			type: 'string',
			default: '',
			...showOp('identifyUser'),
		},
		{
			displayName: 'Group IDs',
			name: 'identifyUser_groupIds',
			type: 'string',
			default: '',
			description: 'JSON array or comma-separated',
			...showOp('identifyUser'),
		},
		{
			displayName: 'User Info',
			name: 'identifyUser_userInfo',
			type: 'json',
			default: '{}',
			...showOp('identifyUser'),
		},
	);

	const tri = [
		{ name: '— (Omit)', value: '' },
		{ name: 'On', value: 'true' },
		{ name: 'Off', value: 'false' },
	];
	const channelFields = (op: string, prefix: string) => {
		for (const ch of ['email', 'slack', 'teams', 'webPush'] as const) {
			props.push(
				{
					displayName: `${ch} — Thread`,
					name: `${prefix}_${ch}_thread`,
					type: 'options',
					options: tri,
					default: '',
					...showOp(op),
				},
				{
					displayName: `${ch} — Text Mention`,
					name: `${prefix}_${ch}_textMention`,
					type: 'options',
					options: tri,
					default: '',
					...showOp(op),
				},
			);
		}
	};
	channelFields('updateNotificationSettings', 'updateNotificationSettings');

	props.push(
		{
			displayName: 'Threads',
			name: 'updateRoomSubscriptionSettings_threads',
			type: 'options',
			options: [
				{ name: 'All', value: 'all' },
				{ name: 'Replies and Mentions', value: 'replies_and_mentions' },
				{ name: 'None', value: 'none' },
			],
			default: 'all',
			...showOp('updateRoomSubscriptionSettings'),
		},
		{
			displayName: 'Text Mentions',
			name: 'updateRoomSubscriptionSettings_textMentions',
			type: 'options',
			options: [
				{ name: 'Mine', value: 'mine' },
				{ name: 'None', value: 'none' },
			],
			default: 'mine',
			...showOp('updateRoomSubscriptionSettings'),
		},
	);

	props.push(
		{
			displayName: 'User ID',
			name: 'triggerInboxNotification_userId',
			type: 'string',
			default: '',
			required: true,
			...showOp('triggerInboxNotification'),
		},
		{
			displayName: 'Kind',
			name: 'triggerInboxNotification_kind',
			type: 'string',
			default: '',
			required: true,
			description:
				'Notification kind. Custom kinds must start with $ and contain only letters and underscores (max 128 characters).',
			...showOp('triggerInboxNotification'),
		},
		{
			displayName: 'Subject ID',
			name: 'triggerInboxNotification_subjectId',
			type: 'string',
			default: '',
			required: true,
			...showOp('triggerInboxNotification'),
		},
		{
			displayName: 'Room ID',
			name: 'triggerInboxNotification_roomId',
			type: 'string',
			default: '',
			...showOp('triggerInboxNotification'),
		},
		{
			displayName: 'Activity Data',
			name: 'triggerInboxNotification_activityData',
			type: 'json',
			default: '{}',
			required: true,
			...showOp('triggerInboxNotification'),
		},
		{
			displayName: 'Organization ID',
			name: 'triggerInboxNotification_organizationId',
			type: 'string',
			default: '',
			...showOp('triggerInboxNotification'),
		},
	);

	props.push(
		{
			displayName: 'Group ID',
			name: 'createGroup_id',
			type: 'string',
			default: '',
			required: true,
			description: 'Unique group identifier',
			...showOp('createGroup'),
		},
		{
			displayName: 'Member IDs',
			name: 'createGroup_memberIds',
			type: 'string',
			default: '',
			description: 'JSON array or comma-separated user IDs',
			...showOp('createGroup'),
		},
		{
			displayName: 'Organization ID',
			name: 'createGroup_organizationId',
			type: 'string',
			default: '',
			...showOp('createGroup'),
		},
		{
			displayName: 'Scope: Mention',
			name: 'createGroup_scopeMention',
			type: 'boolean',
			default: false,
			description: 'Whether to set scopes.mention to true',
			...showOp('createGroup'),
		},
		{
			displayName: 'Member IDs',
			name: 'addGroupMembers_memberIds',
			type: 'string',
			default: '',
			required: true,
			description: 'JSON array or comma-separated',
			...showOp('addGroupMembers'),
		},
		{
			displayName: 'Member IDs',
			name: 'removeGroupMembers_memberIds',
			type: 'string',
			default: '',
			required: true,
			description: 'JSON array or comma-separated',
			...showOp('removeGroupMembers'),
		},
	);

	props.push(
		{
			displayName: 'Provider',
			name: 'createAiCopilot_provider',
			type: 'options',
			options: [
				{ name: 'OpenAI', value: 'openai' },
				{ name: 'Anthropic', value: 'anthropic' },
				{ name: 'Google', value: 'google' },
				{ name: 'OpenAI Compatible', value: 'openai-compatible' },
			],
			default: 'openai',
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Name',
			name: 'createAiCopilot_name',
			type: 'string',
			default: '',
			required: true,
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Description',
			name: 'createAiCopilot_description',
			type: 'string',
			default: '',
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'System Prompt',
			name: 'createAiCopilot_systemPrompt',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			required: true,
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Knowledge Prompt',
			name: 'createAiCopilot_knowledgePrompt',
			type: 'string',
			typeOptions: { rows: 3 },
			default: '',
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Always Use Knowledge',
			name: 'createAiCopilot_alwaysUseKnowledge',
			type: 'boolean',
			default: false,
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Provider API Key',
			name: 'createAiCopilot_providerApiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Provider Settings',
			name: 'createAiCopilot_settings',
			type: 'json',
			default: '{}',
			description: 'MaxTokens, temperature, etc',
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Provider Model',
			name: 'createAiCopilot_providerModel',
			type: 'string',
			default: '',
			description: 'Model ID (e.g. gpt-4o, claude-sonnet-4-5-20250929, gemini-2.5-flash). Required for all providers.',
			...showOp('createAiCopilot'),
		},
		{
			displayName: 'Compatible Provider Name',
			name: 'createAiCopilot_compatibleProviderName',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					operation: ['createAiCopilot'],
					createAiCopilot_provider: ['openai-compatible'],
				},
			},
		},
		{
			displayName: 'Provider Base URL',
			name: 'createAiCopilot_providerBaseUrl',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					operation: ['createAiCopilot'],
					createAiCopilot_provider: ['openai-compatible'],
				},
			},
		},
		{
			displayName: 'Provider Options (JSON)',
			name: 'createAiCopilot_providerOptions',
			type: 'json',
			default: '{}',
			description: 'Provider-specific options (OpenAI / Anthropic / Google)',
			...showOp('createAiCopilot'),
		},
	);

	props.push(
		{
			displayName: 'Name',
			name: 'updateAiCopilot_name',
			type: 'string',
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Description',
			name: 'updateAiCopilot_description',
			type: 'string',
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'System Prompt',
			name: 'updateAiCopilot_systemPrompt',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Knowledge Prompt',
			name: 'updateAiCopilot_knowledgePrompt',
			type: 'string',
			typeOptions: { rows: 3 },
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Always Use Knowledge',
			name: 'updateAiCopilot_alwaysUseKnowledge',
			type: 'boolean',
			default: false,
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Provider API Key',
			name: 'updateAiCopilot_providerApiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Provider',
			name: 'updateAiCopilot_provider',
			type: 'options',
			options: [
				{ name: 'OpenAI', value: 'openai' },
				{ name: 'Anthropic', value: 'anthropic' },
				{ name: 'Google', value: 'google' },
				{ name: 'OpenAI Compatible', value: 'openai-compatible' },
			],
			default: 'openai',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Provider Model',
			name: 'updateAiCopilot_providerModel',
			type: 'string',
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Compatible Provider Name',
			name: 'updateAiCopilot_compatibleProviderName',
			type: 'string',
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Provider Base URL',
			name: 'updateAiCopilot_providerBaseUrl',
			type: 'string',
			default: '',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Provider Settings',
			name: 'updateAiCopilot_settings',
			type: 'json',
			default: '{}',
			...showOp('updateAiCopilot'),
		},
		{
			displayName: 'Provider Options',
			name: 'updateAiCopilot_providerOptions',
			type: 'json',
			default: '{}',
			...showOp('updateAiCopilot'),
		},
	);

	props.push(
		{
			displayName: 'URL',
			name: 'createWebKnowledgeSource_url',
			type: 'string',
			default: '',
			required: true,
			...showOp('createWebKnowledgeSource'),
		},
		{
			displayName: 'Crawl Type',
			name: 'createWebKnowledgeSource_type',
			type: 'options',
			options: [
				{ name: 'Individual Link', value: 'individual_link' },
				{ name: 'Crawl', value: 'crawl' },
				{ name: 'Sitemap', value: 'sitemap' },
			],
			default: 'individual_link',
			required: true,
			...showOp('createWebKnowledgeSource'),
		},
	);

	return props;
}
