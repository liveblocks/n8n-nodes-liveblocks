import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { OPERATION_MAP } from './operations/registry';
import { buildLiveblocksProperties } from './operations/properties';
import type { OperationDefinition } from './operations/types';
import { assembleBody, assembleQuery, isEmptyObject } from './operations/requestAssembly';
import { configureLiveblocksClient } from './transport/configureClient';

function unwrapSdkResult(raw: unknown, spec: OperationDefinition): unknown {
	if (spec.responseMode === 'binaryDownload') {
		return raw;
	}
	if (raw && typeof raw === 'object' && 'data' in raw && 'response' in raw) {
		return (raw as { data: unknown }).data;
	}
	return raw;
}

export class Liveblocks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Liveblocks',
		name: 'liveblocks',
		icon: {
			light: 'file:liveblocks.svg',
			dark: 'file:liveblocks.dark.svg',
		},
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Call the Liveblocks REST API (rooms, comments, Yjs, AI, and more)',
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

				const getParam = (name: string, defaultValue?: unknown) =>
					this.getNodeParameter(name, itemIndex, defaultValue);

				let query: Record<string, unknown> | undefined;
				try {
					query = spec.supportsQuery ? assembleQuery(operation, getParam) : undefined;
				} catch (e) {
					throw new NodeOperationError(
						this.getNode(),
						e instanceof Error ? e.message : 'Invalid query parameters',
						{ itemIndex },
					);
				}

				let body: unknown;
				if (spec.bodyMode === 'binaryUpload') {
					body = undefined;
				} else if (spec.bodyMode === 'none') {
					body = undefined;
				} else {
					try {
						body = assembleBody(operation, spec.bodyMode, getParam);
					} catch (e) {
						throw new NodeOperationError(
							this.getNode(),
							e instanceof Error ? e.message : 'Invalid request body',
							{ itemIndex },
						);
					}
					if (spec.bodyMode === 'json') {
						if (
							body === undefined ||
							body === null ||
							(typeof body === 'object' &&
								!Array.isArray(body) &&
								isEmptyObject(body))
						) {
							throw new NodeOperationError(this.getNode(), 'Body is required for this operation', {
								itemIndex,
							});
						}
					}
					if (spec.bodyMode === 'optionalJson') {
						if (
							body !== undefined &&
							typeof body === 'object' &&
							!Array.isArray(body) &&
							isEmptyObject(body)
						) {
							body = undefined;
						}
					}
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

				if (operation === 'createWebKnowledgeSource' && callOpts.body && path.copilotId) {
					(callOpts.body as { copilotId: string }).copilotId = path.copilotId;
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
