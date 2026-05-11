import { API_BASE } from '$lib/api';
import { getAccessToken } from '$lib/auth/apiClient';

export interface ModelOption {
	id: string;
	name: string;
}

/** When OpenRouter catalog fails — still usable OpenRouter-style IDs. */
export const FALLBACK_MODELS: ModelOption[] = [
	{ id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o mini' },
	{ id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
	{ id: 'google/gemini-2.5-pro', name: 'Google Gemini 2.5 Pro' },
	{ id: 'deepseek/deepseek-chat-v3.1', name: 'DeepSeek Chat V3.1' },
	{ id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet' },
	{ id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B' }
];

export async function loadOpenRouterModels(): Promise<ModelOption[]> {
	// A 400 here means no key is set. We silently fall back to FALLBACK_MODELS
	// because the workspace already shows a toast when the user tries to run a
	// session without a key — a second toast here would be redundant noise.
	try {
		const token = getAccessToken();
		const headers: Record<string, string> = {};
		if (token) headers['Authorization'] = `Bearer ${token}`;
		const res = await fetch(`${API_BASE}/api/openrouter/models`, { headers, credentials: 'include' });
		if (!res.ok) return FALLBACK_MODELS;
		const data = (await res.json()) as { models?: ModelOption[]; error?: string };
		if (data.models && data.models.length > 0) return data.models;
	} catch {
		/* ignore */
	}
	return FALLBACK_MODELS;
}
