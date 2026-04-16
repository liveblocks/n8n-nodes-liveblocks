export type LiveblocksResource =
	| 'room'
	| 'storage'
	| 'yjs'
	| 'thread'
	| 'comment'
	| 'feed'
	| 'attachment'
	| 'user'
	| 'inbox'
	| 'group'
	| 'aiCopilot'
	| 'aiKnowledge';

/** Path keys sent to the generated SDK (`name` is sent as `name` in the URL). */
export type PathParamKey =
	| 'roomId'
	| 'threadId'
	| 'commentId'
	| 'feedId'
	| 'userId'
	| 'groupId'
	| 'copilotId'
	| 'knowledgeSourceId'
	| 'versionId'
	| 'attachmentId'
	| 'inboxNotificationId'
	| 'messageId'
	| 'name';

export type BodyMode = 'none' | 'json' | 'optionalJson' | 'binaryUpload';

export type ResponseMode = 'json' | 'binaryDownload' | 'empty';

export interface OperationDefinition {
	resource: LiveblocksResource;
	/** Must match `operation` parameter value in the node (unique across all ops). */
	operation: string;
	name: string;
	description: string;
	action: string;
	pathParams: readonly PathParamKey[];
	/** When true, show optional Query JSON field for this operation. */
	supportsQuery: boolean;
	bodyMode: BodyMode;
	responseMode: ResponseMode;
	/** When set and the decoded JSON response has an array at this key, items can be split. */
	splitArrayPath?: string;
	run: (options: Record<string, unknown>) => Promise<unknown>;
}
