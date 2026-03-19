export type LiveblocksResource =
	| 'room'
	| 'storage'
	| 'yjs'
	| 'thread'
	| 'comment'
	| 'attachment'
	| 'auth'
	| 'user'
	| 'inbox'
	| 'group'
	| 'aiCopilot'
	| 'aiKnowledge'
	| 'managementProject'
	| 'managementWebhook';

/** Path keys sent to the generated SDK (`name` is sent as `name` in the URL). */
export type PathParamKey =
	| 'roomId'
	| 'threadId'
	| 'commentId'
	| 'userId'
	| 'groupId'
	| 'copilotId'
	| 'knowledgeSourceId'
	| 'projectId'
	| 'webhookId'
	| 'versionId'
	| 'attachmentId'
	| 'inboxNotificationId'
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	run: (options: any) => Promise<unknown>;
}
