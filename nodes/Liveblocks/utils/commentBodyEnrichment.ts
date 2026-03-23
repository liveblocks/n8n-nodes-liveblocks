/**
 * Parse Liveblocks CommentBody JSON: extract user mentions and stringify body to plain / HTML / Markdown.
 * Shapes follow https://liveblocks.io/docs/api-reference/rest-api-endpoints — OpenAPI types are loose, so we use runtime guards.
 */

// --- Types (REST comment body shape; not fully expressed in generated OpenAPI) ---

export type CommentBodyParagraph = {
	type: 'paragraph';
	children: CommentBodyElement[];
};

export type CommentBodyMention = {
	type: 'mention';
	id: string;
	kind?: string;
};

export type CommentBodyText = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	strikethrough?: boolean;
	code?: boolean;
};

export type CommentBodyLink = {
	type: 'link';
	url: string;
	text?: string;
};

export type CommentBodyElement = CommentBodyMention | CommentBodyLink | CommentBodyText | Record<string, unknown>;

export type CommentBody = {
	version: number;
	content: Array<CommentBodyParagraph | Record<string, unknown>>;
};

// --- Type guards ---

function isCommentBodyParagraph(element: unknown): element is CommentBodyParagraph {
	return (
		typeof element === 'object' &&
		element !== null &&
		'type' in element &&
		(element as { type?: unknown }).type === 'paragraph' &&
		'children' in element &&
		Array.isArray((element as { children?: unknown }).children)
	);
}

function isCommentBodyMention(element: unknown): element is CommentBodyMention {
	return (
		typeof element === 'object' &&
		element !== null &&
		'type' in element &&
		(element as { type?: unknown }).type === 'mention' &&
		'id' in element &&
		typeof (element as { id?: unknown }).id === 'string'
	);
}

function isCommentBodyLink(element: unknown): element is CommentBodyLink {
	return (
		typeof element === 'object' &&
		element !== null &&
		'type' in element &&
		(element as { type?: unknown }).type === 'link' &&
		'url' in element &&
		typeof (element as { url?: unknown }).url === 'string'
	);
}

function isCommentBodyText(element: unknown): element is CommentBodyText {
	return (
		typeof element === 'object' &&
		element !== null &&
		!('type' in element) &&
		'text' in element &&
		typeof (element as { text?: unknown }).text === 'string'
	);
}

function asCommentBody(body: unknown): CommentBody | null {
	if (typeof body !== 'object' || body === null || !('content' in body)) return null;
	const c = (body as { content?: unknown }).content;
	if (!Array.isArray(c)) return null;
	const version = (body as { version?: unknown }).version;
	if (typeof version !== 'number') return null;
	return { version, content: c as CommentBody['content'] };
}

// --- Traverse ---

function traverseCommentBody(
	body: CommentBody,
	elementType: 'mention',
	visitor: (element: CommentBodyMention) => void,
): void {
	if (!body?.content) return;

	for (const block of body.content) {
		if (isCommentBodyParagraph(block)) {
			for (const inline of block.children) {
				if (elementType === 'mention' && isCommentBodyMention(inline)) {
					visitor(inline);
				}
			}
		}
	}
}

function isUserMention(m: CommentBodyMention): boolean {
	return m.kind === undefined || m.kind === 'user';
}

/**
 * All mentions in a CommentBody, optionally filtered. Deduped by id (first occurrence wins order).
 */
export function getMentionsFromCommentBody(
	body: CommentBody,
	predicate?: (mention: CommentBodyMention) => boolean,
): CommentBodyMention[] {
	const mentionIds = new Set<string>();
	const mentions: CommentBodyMention[] = [];

	traverseCommentBody(body, 'mention', (mention) => {
		if (
			!mentionIds.has(mention.id) &&
			(predicate ? predicate(mention) : true)
		) {
			mentionIds.add(mention.id);
			mentions.push(mention);
		}
	});

	return mentions;
}

// --- URL sanitization ---

const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/;
const TRAILING_SLASH_URL_REGEX = /\/(?:(?:\?|#).*)?$/;
const PLACEHOLDER_BASE_URL = 'https://localhost:9999';

function sanitizeUrl(url: string): string | null {
	let u = url;
	if (u.startsWith('www.')) {
		u = 'https://' + u;
	}
	if (u === '#') {
		return u;
	}

	try {
		const isAbsolute = ABSOLUTE_URL_REGEX.test(u);
		const urlObject = new URL(u, isAbsolute ? undefined : PLACEHOLDER_BASE_URL);

		if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
			return null;
		}

		const hasTrailingSlash = TRAILING_SLASH_URL_REGEX.test(u);

		const sanitizedUrl =
			(isAbsolute ? urlObject.origin : '') +
			(urlObject.pathname === '/'
				? hasTrailingSlash
					? '/'
					: ''
				: hasTrailingSlash && !urlObject.pathname.endsWith('/')
					? urlObject.pathname + '/'
					: urlObject.pathname) +
			urlObject.search +
			urlObject.hash;

		return sanitizedUrl !== '' ? sanitizedUrl : null;
	} catch {
		return null;
	}
}

// --- HTML escaping ---

const htmlEscapables: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

const htmlEscapablesRegex = new RegExp(
	Object.keys(htmlEscapables)
		.map((entity) => `\\${entity}`)
		.join('|'),
	'g',
);

function escapeHtml(value: string): string {
	return String(value).replace(
		htmlEscapablesRegex,
		(character) => htmlEscapables[character as keyof typeof htmlEscapables],
	);
}

// --- Markdown escaping ---

const markdownEscapables: Record<string, string> = {
	_: '\\_',
	'*': '\\*',
	'#': '\\#',
	'`': '\\`',
	'~': '\\~',
	'!': '\\!',
	'|': '\\|',
	'(': '\\(',
	')': '\\)',
	'{': '\\{',
	'}': '\\}',
	'[': '\\[',
	']': '\\]',
};

const markdownEscapablesRegex = new RegExp(
	Object.keys(markdownEscapables)
		.map((entity) => `\\${entity}`)
		.join('|'),
	'g',
);

function escapeMarkdown(value: string): string {
	return String(value).replace(
		markdownEscapablesRegex,
		(character) => markdownEscapables[character as keyof typeof markdownEscapables],
	);
}

// --- Stringify ---

type StringifyFormat = 'plain' | 'html' | 'markdown';

function stringifyTextElement(element: CommentBodyText, format: StringifyFormat): string {
	let text = element.text;

	if (!text) {
		return '';
	}

	if (format === 'html') {
		text = escapeHtml(text);

		if (element.code) {
			text = `<code>${text}</code>`;
		}
		if (element.strikethrough) {
			text = `<s>${text}</s>`;
		}
		if (element.italic) {
			text = `<em>${text}</em>`;
		}
		if (element.bold) {
			text = `<strong>${text}</strong>`;
		}
	} else if (format === 'markdown') {
		text = escapeMarkdown(text);

		if (element.code) {
			text = `\`${text}\``;
		}
		if (element.strikethrough) {
			text = `~~${text}~~`;
		}
		if (element.italic) {
			text = `_${text}_`;
		}
		if (element.bold) {
			text = `**${text}**`;
		}
	}

	return text;
}

function stringifyLinkElement(element: CommentBodyLink, format: StringifyFormat): string {
	const href = sanitizeUrl(element.url);

	if (href === null) {
		return element.text ?? element.url;
	}

	if (format === 'html') {
		const linkText = element.text ? escapeHtml(element.text) : element.url;
		return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
	} else if (format === 'markdown') {
		const linkText = element.text ? escapeMarkdown(element.text) : element.url;
		return `[${linkText}](${escapeMarkdown(href)})`;
	}

	return element.text ?? element.url;
}

function stringifyMentionElement(element: CommentBodyMention, format: StringifyFormat): string {
	const mentionId = element.id;

	if (format === 'html') {
		return `<span data-mention>@${escapeHtml(mentionId)}</span>`;
	} else if (format === 'markdown') {
		return `@${escapeMarkdown(mentionId)}`;
	}

	return `@${mentionId}`;
}

/**
 * Convert a CommentBody into a plain string, HTML, or Markdown.
 */
export function stringifyCommentBody(body: CommentBody, format: StringifyFormat = 'plain'): string {
	if (!body?.content || !Array.isArray(body.content)) {
		return '';
	}

	const separator = format === 'markdown' ? '\n\n' : '\n';

	const blocks = body.content.map((block) => {
		if (isCommentBodyParagraph(block)) {
			const para = block;
			const children = Array.isArray(para.children) ? para.children : [];
			const inlines = children
				.map((inline) => {
					if (isCommentBodyMention(inline)) {
						return inline.id ? stringifyMentionElement(inline, format) : '';
					}

					if (isCommentBodyLink(inline)) {
						return stringifyLinkElement(inline, format);
					}

					if (isCommentBodyText(inline)) {
						return stringifyTextElement(inline, format);
					}

					return '';
				})
				.join('');

			if (format === 'html' && inlines) {
				return `<p>${inlines}</p>`;
			}

			return inlines;
		}

		return '';
	});

	return blocks.join(separator);
}

// --- Enrichment for n8n JSON output ---

export function enrichCommentRecord(comment: Record<string, unknown>): void {
	const bodyRaw = comment.body;
	const parsed = asCommentBody(bodyRaw);

	if (!parsed) {
		comment.mentionedUserIds = [];
		comment.bodyPlain = '';
		comment.bodyHtml = '';
		comment.bodyMarkdown = '';
		return;
	}

	const userMentions = getMentionsFromCommentBody(parsed, isUserMention);
	comment.mentionedUserIds = userMentions.map((m) => m.id);
	comment.bodyPlain = stringifyCommentBody(parsed, 'plain');
	comment.bodyHtml = stringifyCommentBody(parsed, 'html');
	comment.bodyMarkdown = stringifyCommentBody(parsed, 'markdown');
}

export function enrichThreadRecord(thread: Record<string, unknown>): void {
	const comments = thread.comments;
	if (!Array.isArray(comments)) return;
	for (const c of comments) {
		if (c !== null && typeof c === 'object' && !Array.isArray(c)) {
			enrichCommentRecord(c as Record<string, unknown>);
		}
	}
}

const ENRICH_OPERATIONS = new Set(['getComment', 'getThread', 'getThreads']);

/**
 * After SDK unwrap: add mentionedUserIds, bodyPlain, bodyHtml, bodyMarkdown on each comment for thread/comment reads.
 */
export function enrichLiveblocksJson(operation: string, unwrapped: unknown): unknown {
	if (!ENRICH_OPERATIONS.has(operation) || unwrapped === null || unwrapped === undefined) {
		return unwrapped;
	}

	if (operation === 'getComment') {
		if (typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
			const o = unwrapped as Record<string, unknown>;
			if (o.type === 'comment' || o.body !== undefined) {
				enrichCommentRecord(o);
			}
		}
		return unwrapped;
	}

	if (operation === 'getThread') {
		if (typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
			enrichThreadRecord(unwrapped as Record<string, unknown>);
		}
		return unwrapped;
	}

	if (operation === 'getThreads') {
		if (typeof unwrapped === 'object' && unwrapped !== null && !Array.isArray(unwrapped)) {
			const row = unwrapped as Record<string, unknown>;
			const data = row.data;
			if (Array.isArray(data)) {
				for (const thread of data) {
					if (thread !== null && typeof thread === 'object' && !Array.isArray(thread)) {
						enrichThreadRecord(thread as Record<string, unknown>);
					}
				}
			}
		}
		return unwrapped;
	}

	return unwrapped;
}
