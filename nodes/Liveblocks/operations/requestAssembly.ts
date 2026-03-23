/**
 * Builds `query` and `body` objects for the Liveblocks SDK from n8n node parameters.
 * Shapes follow `nodes/Liveblocks/client/types.gen.ts`.
 */

import type { BodyMode } from './types';

export const RAW_BODY_OPERATIONS = new Set<string>(['broadcastEvent', 'patchStorageDocument']);

/** Operations that use the shared `body` JSON parameter (JSON Patch / unknown payload). */
export function operationUsesRawBodyParameter(operation: string): boolean {
	return RAW_BODY_OPERATIONS.has(operation);
}

export function parseJsonObject(
	raw: unknown,
	allowEmptyAsUndefined: boolean,
): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw === 'string') {
		const t = raw.trim();
		if (t === '' || t === '{}') return allowEmptyAsUndefined ? undefined : {};
		const parsed: unknown = JSON.parse(t);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Expected a JSON object');
		}
		return parsed as Record<string, unknown>;
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		const o = raw as Record<string, unknown>;
		return Object.keys(o).length === 0 && allowEmptyAsUndefined ? undefined : o;
	}
	throw new Error('Expected a JSON object');
}

export function parseJsonValue(raw: unknown): unknown {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw === 'string') {
		const t = raw.trim();
		if (t === '') return undefined;
		return JSON.parse(t);
	}
	return raw;
}

export function isEmptyObject(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.keys(value as object).length === 0
	);
}

export const ROOM_PERMISSION_OPTIONS = [
	{ name: 'room:write', value: 'room:write' },
	{ name: 'room:read', value: 'room:read' },
	{ name: 'room:presence:write', value: 'room:presence:write' },
	{ name: 'comments:write', value: 'comments:write' },
];

type GetParam = (name: string, defaultValue?: unknown) => unknown;

function str(p: GetParam, key: string): string | undefined {
	const v = p(key, '');
	if (v === undefined || v === null) return undefined;
	const s = String(v).trim();
	return s === '' ? undefined : s;
}

function num(p: GetParam, key: string): number | undefined {
	const v = p(key);
	if (v === undefined || v === null || v === '') return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

function bool(p: GetParam, key: string): boolean | undefined {
	const v = p(key);
	if (v === undefined || v === null) return undefined;
	if (typeof v === 'boolean') return v;
	return Boolean(v);
}

function triBool(p: GetParam, key: string): boolean | undefined {
	const s = str(p, key);
	if (s === undefined || s === '') return undefined;
	if (s === 'true') return true;
	if (s === 'false') return false;
	return undefined;
}

/** Rows from fixedCollection: users / groups access (grant or clear one subject). */
function accessRowsToUpdateMap(
	p: GetParam,
	key: string,
): Record<string, Array<(typeof ROOM_PERMISSION_OPTIONS)[number]['value']> | null> | undefined {
	const raw = p(key, {});
	const entries = extractFixedCollectionEntries(raw);
	if (!entries.length) return undefined;
	const out: Record<string, Array<(typeof ROOM_PERMISSION_OPTIONS)[number]['value']> | null> = {};
	for (const row of entries) {
		const subjectId = String(row.subjectId ?? '').trim();
		if (!subjectId) continue;
		const clear = Boolean(row.clearAccess);
		if (clear) {
			out[subjectId] = null;
			continue;
		}
		const perms = row.permissions;
		const list = Array.isArray(perms) ? perms.map(String) : [];
		if (list.length) {
			out[subjectId] = list as Array<(typeof ROOM_PERMISSION_OPTIONS)[number]['value']>;
		}
	}
	return Object.keys(out).length ? out : undefined;
}

/** CreateRoom / Upsert create branch: no null values in map */
function accessRowsToCreateMap(
	p: GetParam,
	key: string,
): Record<string, Array<(typeof ROOM_PERMISSION_OPTIONS)[number]['value']>> | undefined {
	const raw = p(key, {});
	const entries = extractFixedCollectionEntries(raw);
	if (!entries.length) return undefined;
	const out: Record<string, Array<(typeof ROOM_PERMISSION_OPTIONS)[number]['value']>> = {};
	for (const row of entries) {
		const subjectId = String(row.subjectId ?? '').trim();
		if (!subjectId) continue;
		const perms = row.permissions;
		const list = Array.isArray(perms) ? perms.map(String) : [];
		if (list.length) {
			out[subjectId] = list as Array<(typeof ROOM_PERMISSION_OPTIONS)[number]['value']>;
		}
	}
	return Object.keys(out).length ? out : undefined;
}

function extractFixedCollectionEntries(raw: unknown): Array<Record<string, unknown>> {
	if (!raw || typeof raw !== 'object') return [];
	const o = raw as Record<string, unknown>;
	// n8n fixedCollection: { entries: [...] } or { entries: { "0": {...} } }
	const entries = o.entries ?? o.values;
	if (Array.isArray(entries)) {
		return entries.filter((e) => e && typeof e === 'object') as Array<Record<string, unknown>>;
	}
	if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
		return Object.values(entries).filter((e) => e && typeof e === 'object') as Array<
			Record<string, unknown>
		>;
	}
	return [];
}

function mergeDeep(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	for (const [k, v] of Object.entries(source)) {
		if (
			v &&
			typeof v === 'object' &&
			!Array.isArray(v) &&
			target[k] &&
			typeof target[k] === 'object' &&
			!Array.isArray(target[k])
		) {
			mergeDeep(target[k] as Record<string, unknown>, v as Record<string, unknown>);
		} else {
			target[k] = v;
		}
	}
	return target;
}

export function assembleQuery(operation: string, getParam: GetParam): Record<string, unknown> | undefined {
	switch (operation) {
		case 'getRooms': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getRooms_limit');
			const startingAfter = str(getParam, 'q_getRooms_startingAfter');
			const organizationId = str(getParam, 'q_getRooms_organizationId');
			const query = str(getParam, 'q_getRooms_query');
			const userId = str(getParam, 'q_getRooms_userId');
			const groupIds = str(getParam, 'q_getRooms_groupIds');
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			if (organizationId !== undefined) q.organizationId = organizationId;
			if (query !== undefined) q.query = query;
			if (userId !== undefined) q.userId = userId;
			if (groupIds !== undefined) q.groupIds = groupIds;
			return Object.keys(q).length ? q : undefined;
		}
		case 'createRoom': {
			const idem = bool(getParam, 'q_createRoom_idempotent');
			if (idem === true) return { idempotent: true };
			if (idem === false) return { idempotent: false };
			return undefined;
		}
		case 'getStorageDocument': {
			const format = str(getParam, 'q_getStorageDocument_format') as
				| 'plain-lson'
				| 'json'
				| undefined;
			if (format) return { format };
			return undefined;
		}
		case 'getYjsDocument': {
			const q: Record<string, unknown> = {};
			const formatting = bool(getParam, 'q_getYjsDocument_formatting');
			const key = str(getParam, 'q_getYjsDocument_key');
			const type = str(getParam, 'q_getYjsDocument_type') as
				| 'ymap'
				| 'ytext'
				| 'yxmltext'
				| 'yxmlfragment'
				| 'yarray'
				| undefined;
			if (formatting !== undefined) q.formatting = formatting;
			if (key !== undefined) q.key = key;
			if (type !== undefined) q.type = type;
			return Object.keys(q).length ? q : undefined;
		}
		case 'sendYjsBinaryUpdate': {
			const guid = str(getParam, 'q_sendYjsBinaryUpdate_guid');
			return guid ? { guid } : undefined;
		}
		case 'getYjsDocumentAsBinaryUpdate': {
			const guid = str(getParam, 'q_getYjsDocumentAsBinaryUpdate_guid');
			return guid ? { guid } : undefined;
		}
		case 'getYjsVersions': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getYjsVersions_limit');
			const cursor = str(getParam, 'q_getYjsVersions_cursor');
			if (limit !== undefined) q.limit = limit;
			if (cursor !== undefined) q.cursor = cursor;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getThreads': {
			const query = str(getParam, 'q_getThreads_query');
			return query ? { query } : undefined;
		}
		case 'getInboxNotifications': {
			const q: Record<string, unknown> = {};
			const organizationId = str(getParam, 'q_getInboxNotifications_organizationId');
			const query = str(getParam, 'q_getInboxNotifications_query');
			const limit = num(getParam, 'q_getInboxNotifications_limit');
			const startingAfter = str(getParam, 'q_getInboxNotifications_startingAfter');
			if (organizationId !== undefined) q.organizationId = organizationId;
			if (query !== undefined) q.query = query;
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getUserRoomSubscriptionSettings': {
			const q: Record<string, unknown> = {};
			const startingAfter = str(getParam, 'q_getUserRoomSubscriptionSettings_startingAfter');
			const limit = num(getParam, 'q_getUserRoomSubscriptionSettings_limit');
			const organizationId = str(getParam, 'q_getUserRoomSubscriptionSettings_organizationId');
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			if (limit !== undefined) q.limit = limit;
			if (organizationId !== undefined) q.organizationId = organizationId;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getGroups': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getGroups_limit');
			const startingAfter = str(getParam, 'q_getGroups_startingAfter');
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getUserGroups': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getUserGroups_limit');
			const startingAfter = str(getParam, 'q_getUserGroups_startingAfter');
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getAiCopilots': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getAiCopilots_limit');
			const startingAfter = str(getParam, 'q_getAiCopilots_startingAfter');
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getKnowledgeSources': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getKnowledgeSources_limit');
			const startingAfter = str(getParam, 'q_getKnowledgeSources_startingAfter');
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			return Object.keys(q).length ? q : undefined;
		}
		case 'getWebKnowledgeSourceLinks': {
			const q: Record<string, unknown> = {};
			const limit = num(getParam, 'q_getWebKnowledgeSourceLinks_limit');
			const startingAfter = str(getParam, 'q_getWebKnowledgeSourceLinks_startingAfter');
			if (limit !== undefined) q.limit = limit;
			if (startingAfter !== undefined) q.startingAfter = startingAfter;
			return Object.keys(q).length ? q : undefined;
		}
		default:
			return undefined;
	}
}

export function assembleBody(operation: string, bodyMode: BodyMode, getParam: GetParam): unknown {
	if (RAW_BODY_OPERATIONS.has(operation)) {
		const raw = getParam('body', {});
		return parseJsonValue(raw);
	}

	switch (operation) {
		case 'createRoom': {
			const id = str(getParam, 'createRoom_id');
			if (!id) throw new Error('Room ID is required');
			const body: Record<string, unknown> = {
				id,
				defaultAccesses: getParam('createRoom_defaultAccesses', []) as string[],
			};
			const organizationId = str(getParam, 'createRoom_organizationId');
			const metadata = parseJsonObject(getParam('createRoom_metadata'), true);
			const usersAccesses = accessRowsToCreateMap(getParam, 'createRoom_usersAccessEntries');
			const groupsAccesses = accessRowsToCreateMap(getParam, 'createRoom_groupsAccessEntries');
			const engineStr = str(getParam, 'createRoom_engine');
			const engine =
				engineStr === '1' ? 1 : engineStr === '2' ? 2 : undefined;
			if (organizationId !== undefined) body.organizationId = organizationId;
			if (metadata !== undefined) body.metadata = metadata;
			if (usersAccesses !== undefined) body.usersAccesses = usersAccesses;
			if (groupsAccesses !== undefined) body.groupsAccesses = groupsAccesses;
			if (engine !== undefined) body.engine = engine;
			return body;
		}
		case 'updateRoom': {
			const body: Record<string, unknown> = {};
			const clearDefault = bool(getParam, 'updateRoom_clearDefaultAccesses');
			const defaultAccesses = getParam('updateRoom_defaultAccesses', []) as string[];
			if (clearDefault) {
				body.defaultAccesses = null;
			} else if (defaultAccesses.length) {
				body.defaultAccesses = defaultAccesses;
			}
			const usersAccesses = accessRowsToUpdateMap(getParam, 'updateRoom_usersAccessEntries');
			const groupsAccesses = accessRowsToUpdateMap(getParam, 'updateRoom_groupsAccessEntries');
			const metadata = parseJsonObject(getParam('updateRoom_metadata'), true);
			if (usersAccesses !== undefined) body.usersAccesses = usersAccesses;
			if (groupsAccesses !== undefined) body.groupsAccesses = groupsAccesses;
			if (metadata !== undefined) body.metadata = metadata;
			if (isEmptyObject(body)) throw new Error('Provide at least one field to update');
			return body;
		}
		case 'upsertRoom': {
			const update: Record<string, unknown> = {};
			const clearDefault = bool(getParam, 'upsertRoom_clearDefaultAccesses');
			const defaultAccesses = getParam('upsertRoom_defaultAccesses', []) as string[];
			if (clearDefault) {
				update.defaultAccesses = null;
			} else if (defaultAccesses.length) {
				update.defaultAccesses = defaultAccesses;
			}
			const usersAccesses = accessRowsToUpdateMap(getParam, 'upsertRoom_usersAccessEntries');
			const groupsAccesses = accessRowsToUpdateMap(getParam, 'upsertRoom_groupsAccessEntries');
			const metadata = parseJsonObject(getParam('upsertRoom_metadata'), true);
			if (usersAccesses !== undefined) update.usersAccesses = usersAccesses;
			if (groupsAccesses !== undefined) update.groupsAccesses = groupsAccesses;
			if (metadata !== undefined) update.metadata = metadata;
			const createJson = parseJsonObject(getParam('upsertRoom_create'), true);
			const out: Record<string, unknown> = { update };
			if (createJson !== undefined) out.create = createJson;
			if (isEmptyObject(update) && createJson === undefined) {
				throw new Error('Provide update fields and/or a create JSON object');
			}
			return out;
		}
		case 'updateRoomId': {
			const newRoomId = str(getParam, 'updateRoomId_newRoomId');
			if (!newRoomId) throw new Error('New Room ID is required');
			return { newRoomId };
		}
		case 'updateRoomOrganizationId': {
			const fromOrganizationId = str(getParam, 'updateRoomOrganizationId_fromOrganizationId');
			const toOrganizationId = str(getParam, 'updateRoomOrganizationId_toOrganizationId');
			if (!fromOrganizationId || !toOrganizationId) {
				throw new Error('fromOrganizationId and toOrganizationId are required');
			}
			return { fromOrganizationId, toOrganizationId };
		}
		case 'setPresence': {
			const userId = str(getParam, 'setPresence_userId');
			if (!userId) throw new Error('userId is required');
			const data = parseJsonObject(getParam('setPresence_data'), false);
			if (!data) throw new Error('Presence data JSON is required');
			const body: Record<string, unknown> = { userId, data };
			const userInfo = parseJsonObject(getParam('setPresence_userInfo'), true);
			const ttl = num(getParam, 'setPresence_ttl');
			if (userInfo !== undefined) body.userInfo = userInfo;
			if (ttl !== undefined && ttl >= 2) body.ttl = ttl;
			return body;
		}
		case 'initializeStorageDocument': {
			const liveblocksTypeRaw = str(getParam, 'initializeStorageDocument_liveblocksType');
			const liveblocksType =
				liveblocksTypeRaw === 'LiveObject' ? ('LiveObject' as const) : undefined;
			const data = parseJsonObject(getParam('initializeStorageDocument_data'), true);
			if (liveblocksType === undefined && data === undefined) return undefined;
			const body: Record<string, unknown> = {};
			if (liveblocksType !== undefined) body.liveblocksType = liveblocksType;
			if (data !== undefined) body.data = data;
			return Object.keys(body).length ? body : undefined;
		}
		case 'createThread': {
			const commentUserId = str(getParam, 'createThread_commentUserId');
			if (!commentUserId) throw new Error('Comment user ID is required');
			const commentBody = parseJsonValue(getParam('createThread_commentBody'));
			if (commentBody === undefined || commentBody === null) {
				throw new Error('Comment body JSON is required');
			}
			const body: Record<string, unknown> = {
				comment: {
					userId: commentUserId,
					body: commentBody,
				},
			};
			const createdAt = str(getParam, 'createThread_commentCreatedAt');
			const commentMetadata = parseJsonObject(getParam('createThread_commentMetadata'), true);
			const threadMetadata = parseJsonObject(getParam('createThread_threadMetadata'), true);
			if (createdAt !== undefined) (body.comment as Record<string, unknown>).createdAt = createdAt;
			if (commentMetadata !== undefined) {
				(body.comment as Record<string, unknown>).metadata = commentMetadata;
			}
			if (threadMetadata !== undefined) body.metadata = threadMetadata;
			return body;
		}
		case 'editThreadMetadata': {
			const userId = str(getParam, 'editThreadMetadata_userId');
			if (!userId) throw new Error('userId is required');
			const metadata = parseJsonObject(getParam('editThreadMetadata_metadata'), false);
			if (!metadata) throw new Error('metadata JSON is required');
			const body: Record<string, unknown> = { userId, metadata };
			const updatedAt = str(getParam, 'editThreadMetadata_updatedAt');
			if (updatedAt !== undefined) body.updatedAt = updatedAt;
			return body;
		}
		case 'markThreadAsResolved': {
			const userId = str(getParam, 'markThreadAsResolved_userId');
			if (!userId) throw new Error('userId is required');
			return { userId };
		}
		case 'markThreadAsUnresolved': {
			const userId = str(getParam, 'markThreadAsUnresolved_userId');
			if (!userId) throw new Error('userId is required');
			return { userId };
		}
		case 'subscribeToThread': {
			const userId = str(getParam, 'subscribeToThread_userId');
			if (!userId) throw new Error('userId is required');
			return { userId };
		}
		case 'unsubscribeFromThread': {
			const userId = str(getParam, 'unsubscribeFromThread_userId');
			if (!userId) throw new Error('userId is required');
			return { userId };
		}
		case 'createComment': {
			const userId = str(getParam, 'createComment_userId');
			if (!userId) throw new Error('userId is required');
			const bodyContent = parseJsonValue(getParam('createComment_body'));
			if (bodyContent === undefined || bodyContent === null) {
				throw new Error('Comment body JSON is required');
			}
			const body: Record<string, unknown> = { userId, body: bodyContent };
			const createdAt = str(getParam, 'createComment_createdAt');
			const metadata = parseJsonObject(getParam('createComment_metadata'), true);
			const attachmentIdsRaw = str(getParam, 'createComment_attachmentIds');
			if (createdAt !== undefined) body.createdAt = createdAt;
			if (metadata !== undefined) body.metadata = metadata;
			if (attachmentIdsRaw !== undefined) {
				try {
					body.attachmentIds = JSON.parse(attachmentIdsRaw) as string[];
				} catch {
					body.attachmentIds = attachmentIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
				}
			}
			return body;
		}
		case 'editComment': {
			const body: Record<string, unknown> = {};
			const commentBody = parseJsonValue(getParam('editComment_body'));
			if (commentBody !== undefined) body.body = commentBody;
			const metadata = parseJsonObject(getParam('editComment_metadata'), true);
			const editedAt = str(getParam, 'editComment_editedAt');
			const attachmentIdsRaw = str(getParam, 'editComment_attachmentIds');
			if (metadata !== undefined) body.metadata = metadata;
			if (editedAt !== undefined) body.editedAt = editedAt;
			if (attachmentIdsRaw !== undefined) {
				try {
					body.attachmentIds = JSON.parse(attachmentIdsRaw) as string[];
				} catch {
					body.attachmentIds = attachmentIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
				}
			}
			if (isEmptyObject(body)) throw new Error('Provide at least one of body, metadata, editedAt, attachmentIds');
			return body;
		}
		case 'addCommentReaction': {
			const userId = str(getParam, 'addCommentReaction_userId');
			const emoji = str(getParam, 'addCommentReaction_emoji');
			if (!userId || !emoji) throw new Error('userId and emoji are required');
			const body: Record<string, unknown> = { userId, emoji };
			const createdAt = str(getParam, 'addCommentReaction_createdAt');
			if (createdAt !== undefined) body.createdAt = createdAt;
			return body;
		}
		case 'removeCommentReaction': {
			const userId = str(getParam, 'removeCommentReaction_userId');
			const emoji = str(getParam, 'removeCommentReaction_emoji');
			if (!userId || !emoji) throw new Error('userId and emoji are required');
			const body: Record<string, unknown> = { userId, emoji };
			const removedAt = str(getParam, 'removeCommentReaction_removedAt');
			if (removedAt !== undefined) body.removedAt = removedAt;
			return body;
		}
		case 'editCommentMetadata': {
			const userId = str(getParam, 'editCommentMetadata_userId');
			if (!userId) throw new Error('userId is required');
			const metadata = parseJsonObject(getParam('editCommentMetadata_metadata'), false);
			if (!metadata) throw new Error('metadata JSON is required');
			const body: Record<string, unknown> = { userId, metadata };
			const updatedAt = str(getParam, 'editCommentMetadata_updatedAt');
			if (updatedAt !== undefined) body.updatedAt = updatedAt;
			return body;
		}
		case 'authorizeUser': {
			const userId = str(getParam, 'authorizeUser_userId');
			if (!userId) throw new Error('userId is required');
			const permissions = parseJsonObject(getParam('authorizeUser_permissions'), false);
			if (!permissions) throw new Error('permissions JSON object is required');
			const body: Record<string, unknown> = { userId, permissions };
			const organizationId = str(getParam, 'authorizeUser_organizationId');
			const userInfo = parseJsonObject(getParam('authorizeUser_userInfo'), true);
			if (organizationId !== undefined) body.organizationId = organizationId;
			if (userInfo !== undefined) body.userInfo = userInfo;
			const extra = parseJsonObject(getParam('authorizeUser_extra'), true);
			if (extra && Object.keys(extra).length) mergeDeep(body, extra);
			return body;
		}
		case 'identifyUser': {
			const userId = str(getParam, 'identifyUser_userId');
			if (!userId) throw new Error('userId is required');
			const body: Record<string, unknown> = { userId };
			const organizationId = str(getParam, 'identifyUser_organizationId');
			const groupIdsRaw = str(getParam, 'identifyUser_groupIds');
			const userInfo = parseJsonObject(getParam('identifyUser_userInfo'), true);
			if (organizationId !== undefined) body.organizationId = organizationId;
			if (groupIdsRaw !== undefined) {
				try {
					body.groupIds = JSON.parse(groupIdsRaw) as string[];
				} catch {
					body.groupIds = groupIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
				}
			}
			if (userInfo !== undefined) body.userInfo = userInfo;
			return body;
		}
		case 'updateNotificationSettings': {
			const body: Record<string, unknown> = {};
			const channels = ['email', 'slack', 'teams', 'webPush'] as const;
			for (const ch of channels) {
				const thread = triBool(getParam, `updateNotificationSettings_${ch}_thread`);
				const textMention = triBool(getParam, `updateNotificationSettings_${ch}_textMention`);
				if (thread !== undefined || textMention !== undefined) {
					const o: Record<string, boolean> = {};
					if (thread !== undefined) o.thread = thread;
					if (textMention !== undefined) o.textMention = textMention;
					body[ch] = o;
				}
			}
			if (isEmptyObject(body)) throw new Error('Provide at least one channel setting');
			return body;
		}
		case 'updateRoomSubscriptionSettings': {
			const body: Record<string, unknown> = {};
			const threads = str(getParam, 'updateRoomSubscriptionSettings_threads') as
				| 'all'
				| 'replies_and_mentions'
				| 'none'
				| undefined;
			const textMentions = str(getParam, 'updateRoomSubscriptionSettings_textMentions') as
				| 'mine'
				| 'none'
				| undefined;
			if (threads !== undefined) body.threads = threads;
			if (textMentions !== undefined) body.textMentions = textMentions;
			if (isEmptyObject(body)) throw new Error('Provide threads and/or textMentions');
			return body;
		}
		case 'triggerInboxNotification': {
			const userId = str(getParam, 'triggerInboxNotification_userId');
			const kind = str(getParam, 'triggerInboxNotification_kind');
			const subjectId = str(getParam, 'triggerInboxNotification_subjectId');
			if (!userId || !kind || !subjectId) {
				if (bodyMode === 'optionalJson') return undefined;
				throw new Error('userId, kind, and subjectId are required when sending a body');
			}
			const activityData = parseJsonObject(getParam('triggerInboxNotification_activityData'), false);
			if (!activityData) throw new Error('activityData JSON is required');
			const body: Record<string, unknown> = { userId, kind, subjectId, activityData };
			const roomId = str(getParam, 'triggerInboxNotification_roomId');
			const organizationId = str(getParam, 'triggerInboxNotification_organizationId');
			if (roomId !== undefined) body.roomId = roomId;
			if (organizationId !== undefined) body.organizationId = organizationId;
			return body;
		}
		case 'createGroup': {
			const id = str(getParam, 'createGroup_id');
			if (!id) {
				if (bodyMode === 'optionalJson') return undefined;
				throw new Error('Group ID is required');
			}
			const body: Record<string, unknown> = { id };
			const memberIdsRaw = str(getParam, 'createGroup_memberIds');
			const organizationId = str(getParam, 'createGroup_organizationId');
			const mentionScope = bool(getParam, 'createGroup_scopeMention');
			if (memberIdsRaw !== undefined) {
				try {
					body.memberIds = JSON.parse(memberIdsRaw) as string[];
				} catch {
					body.memberIds = memberIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
				}
			}
			if (organizationId !== undefined) body.organizationId = organizationId;
			if (mentionScope === true) {
				body.scopes = { mention: true };
			}
			return body;
		}
		case 'addGroupMembers': {
			const raw = str(getParam, 'addGroupMembers_memberIds');
			if (!raw) throw new Error('memberIds is required (JSON array or comma-separated)');
			let memberIds: string[];
			try {
				memberIds = JSON.parse(raw) as string[];
			} catch {
				memberIds = raw.split(',').map((s) => s.trim()).filter(Boolean);
			}
			if (!memberIds.length) throw new Error('At least one member ID is required');
			return { memberIds };
		}
		case 'removeGroupMembers': {
			const raw = str(getParam, 'removeGroupMembers_memberIds');
			if (!raw) throw new Error('memberIds is required (JSON array or comma-separated)');
			let memberIds: string[];
			try {
				memberIds = JSON.parse(raw) as string[];
			} catch {
				memberIds = raw.split(',').map((s) => s.trim()).filter(Boolean);
			}
			if (!memberIds.length) throw new Error('At least one member ID is required');
			return { memberIds };
		}
		case 'createAiCopilot': {
			const provider = str(getParam, 'createAiCopilot_provider') as
				| 'openai'
				| 'anthropic'
				| 'google'
				| 'openai-compatible'
				| undefined;
			if (!provider) throw new Error('provider is required');
			const name = str(getParam, 'createAiCopilot_name');
			const systemPrompt = str(getParam, 'createAiCopilot_systemPrompt');
			const providerApiKey = str(getParam, 'createAiCopilot_providerApiKey');
			if (!name || !systemPrompt || !providerApiKey) {
				throw new Error('name, systemPrompt, and provider API key are required');
			}
			const base: Record<string, unknown> = {
				provider,
				name,
				systemPrompt,
				providerApiKey,
			};
			const description = str(getParam, 'createAiCopilot_description');
			const knowledgePrompt = str(getParam, 'createAiCopilot_knowledgePrompt');
			const alwaysUseKnowledge = bool(getParam, 'createAiCopilot_alwaysUseKnowledge');
			const settings = parseJsonObject(getParam('createAiCopilot_settings'), true);
			if (description !== undefined) base.description = description;
			if (knowledgePrompt !== undefined) base.knowledgePrompt = knowledgePrompt;
			if (alwaysUseKnowledge !== undefined) base.alwaysUseKnowledge = alwaysUseKnowledge;
			if (settings !== undefined) base.settings = settings;

			const providerModel = str(getParam, 'createAiCopilot_providerModel');
			const providerOptions = parseJsonObject(getParam('createAiCopilot_providerOptions'), true);
			if (provider === 'openai') {
				if (!providerModel) throw new Error('providerModel is required for OpenAI');
				return {
					...base,
					provider: 'openai',
					providerModel,
					...(providerOptions ? { providerOptions } : {}),
				};
			}
			if (provider === 'anthropic') {
				if (!providerModel) throw new Error('providerModel is required for Anthropic');
				return {
					...base,
					provider: 'anthropic',
					providerModel,
					...(providerOptions ? { providerOptions } : {}),
				};
			}
			if (provider === 'google') {
				if (!providerModel) throw new Error('providerModel is required for Google');
				return {
					...base,
					provider: 'google',
					providerModel,
					...(providerOptions ? { providerOptions } : {}),
				};
			}
			if (provider === 'openai-compatible') {
				const compatibleProviderName = str(getParam, 'createAiCopilot_compatibleProviderName');
				const providerBaseUrl = str(getParam, 'createAiCopilot_providerBaseUrl');
				if (!providerModel || !compatibleProviderName || !providerBaseUrl) {
					throw new Error('providerModel, compatible provider name, and base URL are required');
				}
				return {
					...base,
					provider: 'openai-compatible',
					providerModel,
					compatibleProviderName,
					providerBaseUrl,
				};
			}
			throw new Error('Unsupported provider');
		}
		case 'updateAiCopilot': {
			const body: Record<string, unknown> = {};
			const name = str(getParam, 'updateAiCopilot_name');
			const description = str(getParam, 'updateAiCopilot_description');
			const systemPrompt = str(getParam, 'updateAiCopilot_systemPrompt');
			const knowledgePrompt = str(getParam, 'updateAiCopilot_knowledgePrompt');
			const alwaysUseKnowledge = bool(getParam, 'updateAiCopilot_alwaysUseKnowledge');
			const providerApiKey = str(getParam, 'updateAiCopilot_providerApiKey');
			const provider = str(getParam, 'updateAiCopilot_provider');
			const providerModel = str(getParam, 'updateAiCopilot_providerModel');
			const compatibleProviderName = str(getParam, 'updateAiCopilot_compatibleProviderName');
			const providerBaseUrl = str(getParam, 'updateAiCopilot_providerBaseUrl');
			const settings = parseJsonObject(getParam('updateAiCopilot_settings'), true);
			const providerOptions = parseJsonObject(getParam('updateAiCopilot_providerOptions'), true);
			if (name !== undefined) body.name = name;
			if (description !== undefined) body.description = description;
			if (systemPrompt !== undefined) body.systemPrompt = systemPrompt;
			if (knowledgePrompt !== undefined) body.knowledgePrompt = knowledgePrompt;
			if (alwaysUseKnowledge !== undefined) body.alwaysUseKnowledge = alwaysUseKnowledge;
			if (providerApiKey !== undefined) body.providerApiKey = providerApiKey;
			if (provider !== undefined) body.provider = provider;
			if (providerModel !== undefined) body.providerModel = providerModel;
			if (compatibleProviderName !== undefined) body.compatibleProviderName = compatibleProviderName;
			if (providerBaseUrl !== undefined) body.providerBaseUrl = providerBaseUrl;
			if (settings !== undefined) body.settings = settings;
			if (providerOptions !== undefined) body.providerOptions = providerOptions;
			if (isEmptyObject(body)) throw new Error('Provide at least one field to update');
			return body;
		}
		case 'createWebKnowledgeSource': {
			const url = str(getParam, 'createWebKnowledgeSource_url');
			const type = str(getParam, 'createWebKnowledgeSource_type') as
				| 'individual_link'
				| 'crawl'
				| 'sitemap'
				| undefined;
			if (!url || !type) throw new Error('url and type are required');
			return {
				copilotId: '', // filled in execute from path
				url,
				type,
			};
		}
		default:
			throw new Error(`No structured body assembler for operation: ${operation}`);
	}
}

