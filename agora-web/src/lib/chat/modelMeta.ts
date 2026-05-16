/**
 * Provider-family color tokens. Calibrated against the cream paper background
 * so the discs read as distinct without flaring. Stay clear of the oxblood
 * primary hue (~25) so model dots don't fight the run action.
 */
const PROVIDER_HUE_OKLCH: Record<string, string> = {
	openai: 'oklch(0.55 0.10 165)',
	anthropic: 'oklch(0.60 0.13 60)',
	google: 'oklch(0.55 0.12 245)',
	deepseek: 'oklch(0.50 0.12 285)',
	'meta-llama': 'oklch(0.58 0.12 340)',
	meta: 'oklch(0.58 0.12 340)',
	mistralai: 'oklch(0.60 0.12 50)',
	mistral: 'oklch(0.60 0.12 50)',
	'x-ai': 'oklch(0.50 0.10 305)',
	xai: 'oklch(0.50 0.10 305)',
	cohere: 'oklch(0.58 0.11 200)',
	perplexity: 'oklch(0.55 0.11 220)'
};

const DEFAULT_PROVIDER_COLOR = 'oklch(0.55 0.04 65)';

export function providerOf(modelId: string): string {
	const slash = modelId.indexOf('/');
	if (slash <= 0) return modelId.toLowerCase();
	return modelId.slice(0, slash).toLowerCase();
}

export function providerColor(modelId: string): string {
	return PROVIDER_HUE_OKLCH[providerOf(modelId)] ?? DEFAULT_PROVIDER_COLOR;
}

const PROVIDER_LABEL: Record<string, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	google: 'Google',
	deepseek: 'DeepSeek',
	'meta-llama': 'Meta',
	meta: 'Meta',
	mistralai: 'Mistral',
	mistral: 'Mistral',
	'x-ai': 'xAI',
	xai: 'xAI',
	cohere: 'Cohere',
	perplexity: 'Perplexity'
};

/**
 * Friendly short label for a model id, used when the catalog has not loaded
 * yet. Strips the provider prefix and tidies common suffixes.
 */
export function shortModelLabel(modelId: string): string {
	const slash = modelId.indexOf('/');
	if (slash < 0) return modelId;
	const provider = providerOf(modelId);
	const name = modelId.slice(slash + 1);
	const pretty = name
		.replace(/-instruct$/, '')
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
	const providerLabel = PROVIDER_LABEL[provider] ?? provider;
	return `${providerLabel} ${pretty}`;
}
