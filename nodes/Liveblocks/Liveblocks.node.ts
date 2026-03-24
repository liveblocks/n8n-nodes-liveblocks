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
import { createLiveblocksHttpClient } from './transport/configureClient';
import { enrichLiveblocksJson } from './utils/commentBodyEnrichment';

/** Map SDK/HTTP failures to a JsonObject n8n's NodeApiError can display (status + message). */
function liveblocksErrorToNodePayload(error: unknown, response?: Response): JsonObject {
	const httpCode = response?.status !== undefined ? String(response.status) : undefined;

	if (error && typeof error === 'object' && !Array.isArray(error)) {
		const e = error as Record<string, unknown>;
		if (Object.keys(e).length === 0) {
			return {
				message: httpCode ? `HTTP ${httpCode}` : 'Request failed',
				...(httpCode ? { httpCode } : {}),
			};
		}
		const msg =
			typeof e.message === 'string' && e.message.trim()
				? e.message
				: typeof e.error === 'string'
					? e.error
					: httpCode
						? `HTTP ${httpCode}`
						: 'Request failed';
		return { ...e, message: msg, ...(httpCode ? { httpCode } : {}) };
	}

	if (typeof error === 'string') {
		const msg = error.trim() || (httpCode ? `HTTP ${httpCode}` : 'Request failed');
		return { message: msg, ...(httpCode ? { httpCode } : {}) };
	}

	return {
		message: httpCode ? `HTTP ${httpCode}` : 'Request failed',
		...(httpCode ? { httpCode } : {}),
	};
}

/** `instanceof Response` can fail across realms; duck-type for SDK envelopes. */
function isResponseLike(obj: unknown): obj is Response {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		typeof (obj as { status?: unknown }).status === 'number' &&
		typeof (obj as { clone?: unknown }).clone === 'function'
	);
}

function isRequestLike(obj: unknown): obj is Request {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		typeof (obj as { url?: unknown }).url === 'string' &&
		typeof (obj as { method?: unknown }).method === 'string' &&
		typeof (obj as { headers?: unknown }).headers === 'object'
	);
}

function redactHeaders(headers: Headers): Record<string, string> {
	const out: Record<string, string> = {};
	headers.forEach((value, key) => {
		out[key] = key.toLowerCase() === 'authorization' ? '[redacted]' : value;
	});
	return out;
}

function serializeBodyForDebug(body: unknown): string | undefined {
	if (body === undefined) return undefined;
	if (body instanceof Blob) {
		return `[binary blob, ${body.size} bytes]`;
	}
	if (typeof body === 'string') {
		return body.length > 8000 ? `${body.slice(0, 8000)}…` : body;
	}
	try {
		return JSON.stringify(body, null, 2);
	} catch {
		return String(body);
	}
}

function formatPartialCallOptsDebug(opts: Record<string, unknown> | undefined): string | undefined {
	if (!opts) return undefined;
	const lines: string[] = [];
	if (opts.path) lines.push(`path: ${JSON.stringify(opts.path)}`);
	if (opts.query) lines.push(`query: ${JSON.stringify(opts.query)}`);
	const bodyStr = serializeBodyForDebug(opts.body);
	if (bodyStr !== undefined) lines.push(`body: ${bodyStr}`);
	return lines.length ? lines.join('\n') : undefined;
}

async function buildLiveblocksRequestDebug(
	envelope: { request: Request; response: Response },
	callOpts: Record<string, unknown>,
): Promise<string> {
	const parts: string[] = [];
	parts.push(`${envelope.request.method} ${envelope.request.url}`);
	parts.push('Request headers:');
	parts.push(JSON.stringify(redactHeaders(envelope.request.headers), null, 2));
	const bodyStr = serializeBodyForDebug(callOpts.body);
	if (bodyStr !== undefined) {
		parts.push('Request body:');
		parts.push(bodyStr);
	}
	try {
		const text = await envelope.response.clone().text();
		if (text) {
			parts.push('Response body:');
			parts.push(text.length > 8000 ? `${text.slice(0, 8000)}…` : text);
		}
	} catch {
		/* ignore */
	}
	return parts.join('\n');
}

function isSdkFieldsErrorEnvelope(
	raw: unknown,
): raw is { error: unknown; request: Request; response: Response } {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
	const o = raw as Record<string, unknown>;
	return (
		'error' in o &&
		o.error !== undefined &&
		'response' in o &&
		isResponseLike(o.response) &&
		'request' in o &&
		isRequestLike(o.request)
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

		await this.getCredentials('liveblocksApi');
		const liveblocksClient = createLiveblocksHttpClient(this);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			let lastCallOpts: Record<string, unknown> | undefined;
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
							(typeof body === 'object' && !Array.isArray(body) && isEmptyObject(body))
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
					// Binary download uses responseStyle "data"; with throwOnError false the client returns
					// undefined on error instead of { error, response }, so we keep throwing for those ops.
					throwOnError: spec.responseMode === 'binaryDownload',
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

				const includeRequestInError = this.getNodeParameter(
					'includeRequestInError',
					itemIndex,
					false,
				) as boolean;

				callOpts.client = liveblocksClient;
				lastCallOpts = callOpts;

				const rawResult = await spec.run(callOpts);

				if (spec.responseMode !== 'binaryDownload' && isSdkFieldsErrorEnvelope(rawResult)) {
					let errorDescription: string | undefined;
					if (includeRequestInError) {
						errorDescription = await buildLiveblocksRequestDebug(rawResult, callOpts);
					}
					throw new NodeApiError(
						this.getNode(),
						liveblocksErrorToNodePayload(rawResult.error, rawResult.response),
						{
							itemIndex,
							httpCode: String(rawResult.response.status),
							description: errorDescription,
						},
					);
				}

				const unwrapped = unwrapSdkResult(rawResult, spec);
				const jsonPayload = enrichLiveblocksJson(operation, unwrapped);

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
					jsonPayload &&
					typeof jsonPayload === 'object' &&
					!Array.isArray(jsonPayload)
				) {
					const row = jsonPayload as Record<string, unknown>;
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
					jsonPayload !== null && typeof jsonPayload === 'object'
						? (JSON.parse(JSON.stringify(jsonPayload)) as IDataObject)
						: { value: jsonPayload as never };
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
				if (error instanceof NodeOperationError || error instanceof NodeApiError) {
					if (error.context && typeof error.context === 'object') {
						(error.context as Record<string, unknown>).itemIndex = itemIndex;
					}
					throw error;
				}
				const includeRequestInError = this.getNodeParameter(
					'includeRequestInError',
					itemIndex,
					false,
				) as boolean;
				const partialDebug = includeRequestInError
					? formatPartialCallOptsDebug(lastCallOpts)
					: undefined;
				throw new NodeApiError(this.getNode(), liveblocksErrorToNodePayload(error), {
					itemIndex,
					...(partialDebug ? { description: partialDebug } : {}),
				});
			}
		}

		return [returnData];
	}
}
