import { formatTurnError, NETWORK_ERROR_MESSAGE, safeHttpErrorMessage } from '$lib/apiErrors';
import { sleep } from '$lib/util';
import { apiFetch, ApiError, getAccessToken } from '$lib/auth/apiClient';

/** Backend API base. Set `VITE_API_URL` at build time if needed. */
// `??` (not `||`) so an explicit empty string at build time stays empty —
// the docker build bakes VITE_API_URL="" to make calls same-origin via Caddy.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Thrown for HTTP errors after mapping to a safe message (never includes response body). */
export class ChatApiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ChatApiError';
	}
}

export const models = {
	AI_1: 'openai/gpt-4o-mini',
	AI_2: 'google/gemini-2.5-pro',
	AI_3: 'deepseek/deepseek-chat-v3.1'
} as const;

export type ParticipantId = keyof typeof models;

export const roleplay_roles = {
	AI_1: 'a brilliant scientist who explains concepts with precision and curiosity',
	AI_2: 'an innovative entrepreneur who sees practical applications and market potential',
	AI_3: 'a thoughtful philosopher who explores deeper meanings and ethical implications'
};

export const consensus_roles = {
	AI_1: 'a diplomatic facilitator who seeks common ground and builds bridges between ideas',
	AI_2: 'a practical negotiator who focuses on feasible solutions and compromises',
	AI_3: 'a synthesis expert who combines different viewpoints into unified conclusions'
};

export const brainstorm_roles = {
	AI_1: 'a creative innovator who generates wild, out-of-the-box ideas without limits',
	AI_2: 'a lateral thinker who connects unexpected dots and finds novel approaches',
	AI_3: 'an idea amplifier who builds on others\' concepts and makes them even better'
};

export const debate_roles = {
	AI_1: 'a fierce advocate who passionately defends their position with strong arguments',
	AI_2: 'a critical challenger who aggressively questions and pokes holes in ideas',
	AI_3: 'a strategic debater who uses logic and evidence to demolish opposing viewpoints'
};

export const collaborative_roles = {
	AI_1: 'an insightful educator who explains concepts clearly and sees the big picture',
	AI_2: 'a detail-oriented analyst who adds depth and catches important nuances',
	AI_3: 'a practical synthesizer who connects theory to real-world applications and examples'
};

export interface Message {
	role: string;
	content: string;
	name?: string;
}

export interface DiscussionEntry {
	participant: string;
	model: string;
	response: string;
	phase?: string;
	round?: number;
	position?: string;
	emoji?: string;
	avatarHue?: number;
	streaming?: boolean;
	/**
	 * Entry kind. Absent on legacy rows — treat as 'agent'. The 'moderator'
	 * kind marks routing decisions emitted by the orchestrator agent and is
	 * rendered as a compact line, not a full message bubble.
	 */
	kind?: 'agent' | 'moderator';
	/** When kind='moderator', a short directive to the next speaker. */
	moderatorInstruction?: string;
}

export async function callAI(
	model: string,
	role: string,
	context: Message[],
	stopSignal?: boolean
): Promise<string> {
	if (stopSignal) {
		return 'Generation stopped by user.';
	}

	try {
		const data = await apiFetch<{ content: string }>('/api/chat', {
			method: 'POST',
			body: JSON.stringify({ model, role, context })
		});
		return data.content;
	} catch (error) {
		if (error instanceof ApiError) {
			if (import.meta.env.DEV) {
				console.error('callAI rejected:', error.message);
			}
			return formatTurnError(safeHttpErrorMessage(error.status, error.detail));
		}
		if (import.meta.env.DEV) {
			console.error('Error calling AI:', error);
		}
		return formatTurnError(NETWORK_ERROR_MESSAGE);
	}
}

function isAbortError(e: unknown): boolean {
	return e instanceof DOMException && e.name === 'AbortError';
}

export async function streamAI(
	model: string,
	role: string,
	context: Message[],
	opts: {
		signal: AbortSignal;
		onChunk: (delta: string) => void;
	}
): Promise<string> {
	let full = '';

	if (opts.signal.aborted) return full;

	try {
		const token = getAccessToken();

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream'
		};
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		const response = await fetch(`${API_BASE}/api/chat`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ model, role, context, stream: true }),
			signal: opts.signal,
			credentials: 'include'
		});

		if (response.status === 401 && !opts.signal.aborted) {
			const data = await apiFetch<{ content: string }>('/api/chat', {
				method: 'POST',
				body: JSON.stringify({ model, role, context })
			});
			const text = data.content ?? '';
			const chunks = text.split(/(\s+)/);
			for (const chunk of chunks) {
				if (opts.signal.aborted) break;
				if (!chunk) continue;
				full += chunk;
				opts.onChunk(chunk);
				await sleep(18);
			}
			return full;
		}

		if (!response.ok) {
			let detail: string | undefined;
			try {
				const body = (await response.json()) as { detail?: string };
				detail = body.detail;
			} catch {
				/* drain body */
			}
			throw new ChatApiError(safeHttpErrorMessage(response.status, detail));
		}

		const contentType = response.headers.get('content-type') ?? '';

		if (contentType.includes('text/event-stream') && response.body) {
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let done = false;

			const onAbort = () => {
				reader.cancel().catch(() => {});
			};
			opts.signal.addEventListener('abort', onAbort, { once: true });

			try {
				while (!done) {
					const { value, done: readerDone } = await reader.read();
					done = readerDone;
					if (value) buffer += decoder.decode(value, { stream: !done });

					let boundary = buffer.indexOf('\n\n');
					while (boundary !== -1) {
						const rawEvent = buffer.slice(0, boundary);
						buffer = buffer.slice(boundary + 2);
						boundary = buffer.indexOf('\n\n');

						const lines = rawEvent.split('\n');
						for (const line of lines) {
							if (!line.startsWith('data:')) continue;
							const payload = line.slice(5).trim();
							if (!payload) continue;
							if (payload === '[DONE]') {
								done = true;
								break;
							}
							let delta = '';
							try {
								const parsed = JSON.parse(payload);
								if (typeof parsed === 'string') {
									delta = parsed;
								} else if (parsed && typeof parsed.delta === 'string') {
									delta = parsed.delta;
								} else if (parsed && typeof parsed.content === 'string') {
									delta = parsed.content;
								}
							} catch {
								delta = payload;
							}
							if (delta) {
								full += delta;
								opts.onChunk(delta);
							}
						}
					}

					if (opts.signal.aborted) break;
				}
			} finally {
				opts.signal.removeEventListener('abort', onAbort);
			}
		} else {
			const data = await response.json();
			const text = (data.content ?? '') as string;
			const chunks = text.split(/(\s+)/);
			for (const chunk of chunks) {
				if (opts.signal.aborted) break;
				if (!chunk) continue;
				full += chunk;
				opts.onChunk(chunk);
				await sleep(18);
			}
		}

		return full;
	} catch (error) {
		if (isAbortError(error) || opts.signal.aborted) {
			return full;
		}
		let message: string;
		if (error instanceof ChatApiError) {
			if (import.meta.env.DEV) {
				console.error('streamAI rejected:', error.message);
			}
			message = formatTurnError(error.message);
		} else {
			if (import.meta.env.DEV) {
				console.error('Error streaming AI:', error);
			}
			message = formatTurnError(NETWORK_ERROR_MESSAGE);
		}
		opts.onChunk(message);
		return full + message;
	}
}
