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
	try {
		const res = await fetch('/api/openrouter/models');
		if (!res.ok) return FALLBACK_MODELS;
		const data = (await res.json()) as { models?: ModelOption[]; error?: string };
		if (data.models && data.models.length > 0) return data.models;
	} catch {
		/* ignore */
	}
	return FALLBACK_MODELS;
}
