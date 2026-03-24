import type { IExecuteFunctions, IN8nHttpFullResponse, IHttpRequestMethods } from 'n8n-workflow';

import { createClient, createConfig } from '../client/client';
import type { Client } from '../client/client';

const DEFAULT_BASE_URL = 'https://api.liveblocks.io/v2';

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return value !== null && typeof value === 'object' && Symbol.asyncIterator in value;
}

/** Build header map; omit Content-Length so n8n recomputes it for the proxied body. */
function headersToObject(headers: Headers): Record<string, string> {
	const out: Record<string, string> = {};
	headers.forEach((value, key) => {
		if (key.toLowerCase() === 'content-length') return;
		out[key] = value;
	});
	return out;
}

async function normalizedResponseBody(
	body: IN8nHttpFullResponse['body'],
): Promise<BodyInit> {
	if (body === undefined || body === null) {
		return '';
	}
	if (Buffer.isBuffer(body)) {
		return new Uint8Array(body) as BodyInit;
	}
	if (typeof body === 'string') {
		return body;
	}
	if (body instanceof ArrayBuffer) {
		return new Uint8Array(body) as BodyInit;
	}
	if (ArrayBuffer.isView(body)) {
		return new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as BodyInit;
	}
	if (typeof body === 'object') {
		if (isAsyncIterable(body)) {
			const chunks: Buffer[] = [];
			for await (const chunk of body) {
				let buf: Buffer;
				if (Buffer.isBuffer(chunk)) {
					buf = chunk;
				} else if (typeof chunk === 'string') {
					buf = Buffer.from(chunk);
				} else if (chunk instanceof ArrayBuffer) {
					buf = Buffer.from(chunk);
				} else if (ArrayBuffer.isView(chunk)) {
					buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
				} else {
					buf = Buffer.from(String(chunk));
				}
				chunks.push(buf);
			}
			return new Uint8Array(Buffer.concat(chunks)) as BodyInit;
		}
		if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
			return body;
		}
		if (Array.isArray(body)) {
			return JSON.stringify(body);
		}
		return JSON.stringify(body);
	}
	return String(body);
}

async function n8nFullResponseToWebResponse(full: IN8nHttpFullResponse): Promise<Response> {
	const status = full.statusCode;
	const headersInit = new Headers();
	for (const [k, v] of Object.entries(full.headers ?? {})) {
		if (typeof v === 'string') {
			headersInit.set(k, v);
		} else if (Array.isArray(v)) {
			headersInit.set(k, v.join(', '));
		} else if (v !== undefined && v !== null) {
			headersInit.set(k, String(v));
		}
	}
	const body = await normalizedResponseBody(full.body);
	return new Response(body, { status, headers: headersInit });
}

/**
 * Per-execution OpenAPI client: all HTTP goes through n8n's stack (proxy, TLS, timeouts)
 * and `liveblocksApi` credentials via `httpRequestWithAuthentication`.
 */
export function createLiveblocksHttpClient(executeFunctions: IExecuteFunctions): Client {
	const n8nFetch: typeof fetch = async (input, init) => {
		const request = input instanceof Request ? input : new Request(input, init);
		const method = (request.method || 'GET').toUpperCase() as IHttpRequestMethods;

		let body: Buffer | undefined;
		if (method !== 'GET' && method !== 'HEAD') {
			const ab = await request.arrayBuffer();
			if (ab.byteLength > 0) {
				body = Buffer.from(ab);
			}
		}

		const full = (await executeFunctions.helpers.httpRequestWithAuthentication.call(
			executeFunctions,
			'liveblocksApi',
			{
				url: request.url,
				method,
				headers: headersToObject(request.headers),
				...(body !== undefined ? { body } : {}),
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			},
		)) as IN8nHttpFullResponse;

		return n8nFullResponseToWebResponse(full);
	};

	return createClient(
		createConfig({
			baseUrl: DEFAULT_BASE_URL,
			fetch: n8nFetch,
		}),
	);
}
