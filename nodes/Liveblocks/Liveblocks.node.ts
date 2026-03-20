import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import {
	ApplicationError,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { OPERATION_MAP } from './operations/registry';
import { buildLiveblocksProperties } from './operations/properties';
import type { OperationDefinition } from './operations/types';
import { configureLiveblocksClient } from './transport/configureClient';

function isEmptyObject(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.keys(value as object).length === 0
	);
}

function unwrapSdkResult(raw: unknown, spec: OperationDefinition): unknown {
	if (spec.responseMode === 'binaryDownload') {
		return raw;
	}
	if (raw && typeof raw === 'object' && 'data' in raw && 'response' in raw) {
		return (raw as { data: unknown }).data;
	}
	return raw;
}

function parseQueryInput(raw: unknown): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw === 'string') {
		const t = raw.trim();
		if (t === '' || t === '{}') return undefined;
		const parsed: unknown = JSON.parse(t);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new ApplicationError('Query must be a JSON object');
		}
		return parsed as Record<string, unknown>;
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		const q = raw as Record<string, unknown>;
		return Object.keys(q).length ? q : undefined;
	}
	throw new ApplicationError('Query must be a JSON object');
}

function parseBodyInput(raw: unknown): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw === 'string') {
		const t = raw.trim();
		if (t === '' || t === '{}') return undefined;
		const parsed: unknown = JSON.parse(t);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new ApplicationError('Body must be a JSON object');
		}
		return parsed as Record<string, unknown>;
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		const b = raw as Record<string, unknown>;
		return Object.keys(b).length ? b : undefined;
	}
	throw new ApplicationError('Body must be a JSON object');
}

export class Liveblocks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Liveblocks',
		name: 'liveblocks',
		icon: 'file:liveblocks-icon-black.svg',
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Call the Liveblocks REST API (rooms, comments, Yjs, AI, management, and more)',
		defaults: {
			name: 'Liveblocks',
		},
		credentials: [
			{
				name: 'liveblocksApi',
				required: true,
			},
		],
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: buildLiveblocksProperties(),
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('liveblocksApi');
		const secretKey = credentials.secretKey as string;
		if (!secretKey) {
			throw new NodeOperationError(this.getNode(), 'Liveblocks secret key is required');
		}
		configureLiveblocksClient(secretKey);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const spec = OPERATION_MAP.get(operation);
				if (!spec) {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}
				if (spec.resource !== resource) {
					throw new NodeOperationError(
						this.getNode(),
						`Operation ${operation} does not belong to resource ${resource}`,
					);
				}

				const path: Record<string, string> = {};
				for (const key of spec.pathParams) {
					const v = this.getNodeParameter(key, itemIndex, '') as string;
					if (!v || String(v).trim() === '') {
						throw new NodeOperationError(
							this.getNode(),
							`Required path parameter missing: ${key}`,
							{ itemIndex },
						);
					}
					path[key] = String(v).trim();
				}

				const queryRaw = spec.supportsQuery
					? this.getNodeParameter('query', itemIndex, {})
					: undefined;
				let query: Record<string, unknown> | undefined;
				try {
					query = spec.supportsQuery ? parseQueryInput(queryRaw) : undefined;
				} catch (e) {
					throw new NodeOperationError(
						this.getNode(),
						e instanceof Error ? e.message : 'Invalid Query JSON',
						{ itemIndex },
					);
				}

				const bodyRaw =
					spec.bodyMode === 'json' || spec.bodyMode === 'optionalJson'
						? this.getNodeParameter('body', itemIndex, {})
						: undefined;
				let body: unknown;
				try {
					const parsed = parseBodyInput(bodyRaw);
					if (spec.bodyMode === 'json') {
						if (parsed === undefined || isEmptyObject(parsed)) {
							throw new NodeOperationError(
								this.getNode(),
								'Body is required for this operation — provide a JSON object',
								{ itemIndex },
							);
						}
						body = parsed;
					} else if (spec.bodyMode === 'optionalJson') {
						body = parsed === undefined || isEmptyObject(parsed) ? undefined : parsed;
					}
				} catch (e) {
					throw new NodeOperationError(
						this.getNode(),
						e instanceof Error ? e.message : 'Invalid Body JSON',
						{ itemIndex },
					);
				}

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const callOpts: any = {
					throwOnError: true,
				};
				if (Object.keys(path).length > 0) {
					callOpts.path = path;
				}
				if (query !== undefined) {
					callOpts.query = query;
				}
				if (spec.bodyMode === 'binaryUpload') {
					const binField = this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
					const buf = await this.helpers.getBinaryDataBuffer(itemIndex, binField);
					callOpts.body = new Blob([new Uint8Array(buf)]);
				} else if (body !== undefined) {
					callOpts.body = body;
				}

				if (spec.responseMode === 'binaryDownload') {
					callOpts.parseAs = 'arrayBuffer';
					callOpts.responseStyle = 'data';
				}

				const rawResult = await spec.run(callOpts);
				const unwrapped = unwrapSdkResult(rawResult, spec);

				if (spec.responseMode === 'binaryDownload') {
					const ab = unwrapped as ArrayBuffer;
					if (!(ab instanceof ArrayBuffer)) {
						throw new NodeOperationError(this.getNode(), 'Expected binary response body', {
							itemIndex,
						});
					}
					const buffer = Buffer.from(ab);
					const prop = this.getNodeParameter('binaryOutputProperty', itemIndex, 'data') as string;
					const fileName = this.getNodeParameter(
						'binaryOutputFileName',
						itemIndex,
						'liveblocks.bin',
					) as string;
					const mime = this.getNodeParameter(
						'binaryMimeType',
						itemIndex,
						'application/octet-stream',
					) as string;
					const binary = await this.helpers.prepareBinaryData(buffer, mime, fileName);
					returnData.push({
						json: { fileName, mimeType: mime, fileSize: buffer.length },
						binary: { [prop]: binary },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				if (spec.responseMode === 'empty') {
					const emptyJson: IDataObject =
						unwrapped !== undefined && unwrapped !== null && typeof unwrapped === 'object'
							? (JSON.parse(JSON.stringify(unwrapped)) as IDataObject)
							: {};
					returnData.push({
						json: emptyJson,
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const splitIntoItems = spec.splitArrayPath
					? (this.getNodeParameter('splitIntoItems', itemIndex, true) as boolean)
					: false;

				const splitKey = spec.splitArrayPath;
				if (
					splitIntoItems &&
					splitKey &&
					unwrapped &&
					typeof unwrapped === 'object' &&
					!Array.isArray(unwrapped)
				) {
					const row = unwrapped as Record<string, unknown>;
					const arr = row[splitKey];
					const nextCursor = row.nextCursor;
					if (Array.isArray(arr)) {
						if (arr.length === 0) {
							returnData.push({
								json: { data: [], nextCursor: nextCursor ?? null },
								pairedItem: { item: itemIndex },
							});
							continue;
						}
						for (const el of arr) {
							const json: IDataObject =
								el !== null && typeof el === 'object' && !Array.isArray(el)
									? ({
											...(JSON.parse(JSON.stringify(el)) as IDataObject),
											nextCursor: nextCursor ?? null,
										} as IDataObject)
									: { value: el as never, nextCursor: nextCursor ?? null };
							returnData.push({
								json,
								pairedItem: { item: itemIndex },
							});
						}
						continue;
					}
				}

				const outJson: IDataObject =
					unwrapped !== null && typeof unwrapped === 'object'
						? (JSON.parse(JSON.stringify(unwrapped)) as IDataObject)
						: { value: unwrapped as never };
				returnData.push({
					json: outJson,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : String(error) },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof NodeOperationError) {
					if (error.context && typeof error.context === 'object') {
						(error.context as Record<string, unknown>).itemIndex = itemIndex;
					}
					throw error;
				}
				throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
