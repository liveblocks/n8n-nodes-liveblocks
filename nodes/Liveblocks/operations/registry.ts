import { LIVEBLOCKS_OPERATIONS } from './definitions';
import type { LiveblocksResource, OperationDefinition, PathParamKey } from './types';

export const OPERATION_MAP: Map<string, OperationDefinition> = new Map(
	LIVEBLOCKS_OPERATIONS.map((d) => [d.operation, d]),
);

/** Matches alphabetical order of RESOURCE_MENU in properties.ts */
const resourceOrder: LiveblocksResource[] = [
	'aiCopilot',
	'aiKnowledge',
	'attachment',
	'comment',
	'feed',
	'group',
	'inbox',
	'room',
	'storage',
	'thread',
	'user',
	'yjs',
];

export const LIVEBLOCKS_RESOURCES: LiveblocksResource[] = resourceOrder.filter((r) =>
	LIVEBLOCKS_OPERATIONS.some((o) => o.resource === r),
);

export function getDefinitionsForResource(resource: LiveblocksResource): OperationDefinition[] {
	return LIVEBLOCKS_OPERATIONS.filter((d) => d.resource === resource);
}

export function operationsUsingPathKey(key: PathParamKey): string[] {
	return LIVEBLOCKS_OPERATIONS.filter((d) => d.pathParams.includes(key)).map((d) => d.operation);
}

export function operationsWithBinaryUpload(): string[] {
	return LIVEBLOCKS_OPERATIONS.filter((d) => d.bodyMode === 'binaryUpload').map((d) => d.operation);
}

export function operationsWithBinaryDownload(): string[] {
	return LIVEBLOCKS_OPERATIONS.filter((d) => d.responseMode === 'binaryDownload').map(
		(d) => d.operation,
	);
}

export function operationsWithSplit(): string[] {
	return LIVEBLOCKS_OPERATIONS.filter((d) => Boolean(d.splitArrayPath)).map((d) => d.operation);
}
