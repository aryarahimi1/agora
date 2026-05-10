import { formatTurnError, NETWORK_ERROR_MESSAGE, safeHttpErrorMessage } from '$lib/apiErrors';
import { sleep } from '$lib/util';

/** Backend API base. Set `VITE_API_URL` at build time if needed. */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
		const response = await fetch(`${API_BASE}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, role, context })
		});

		if (!response.ok) {
			try {
				await response.text();
			} catch {
				/* drain body */
			}
			throw new ChatApiError(safeHttpErrorMessage(response.status));
		}

		const data = await response.json();
		return data.content as string;
	} catch (error) {
		if (error instanceof ChatApiError) {
			if (import.meta.env.DEV) {
				console.error('callAI rejected:', error.message);
			}
			return formatTurnError(error.message);
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
		const response = await fetch(`${API_BASE}/api/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'text/event-stream'
			},
			body: JSON.stringify({ model, role, context, stream: true }),
			signal: opts.signal
		});

		if (!response.ok) {
			try {
				await response.text();
			} catch {
				/* drain body */
			}
			throw new ChatApiError(safeHttpErrorMessage(response.status));
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
