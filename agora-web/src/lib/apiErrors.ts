/** User-safe messages — never echo raw API bodies, validation `loc`, or upstream payloads. */

/** Sentinel substring embedded in formatted errors when the server signals no API key. */
export const NO_KEY_SENTINEL = 'Add a key in Account settings';

export function safeHttpErrorMessage(status: number, detail?: string): string {
	// Pass-through the no-key signal so the workspace can detect it.
	if (detail && detail.includes('OpenRouter API key')) {
		return `No OpenRouter API key. ${NO_KEY_SENTINEL}.`;
	}
	if (status === 422 || status === 400) {
		return 'We could not process this request. Check your input and try again.';
	}
	if (status === 401 || status === 403) {
		return 'Access was denied. Check API configuration.';
	}
	if (status === 408 || status === 504) {
		return 'The request took too long. Please try again.';
	}
	if (status >= 500) {
		return 'The AI service is temporarily unavailable. Please try again.';
	}
	return 'Something went wrong. Please try again.';
}

/** Shown when `fetch` throws or response body cannot be parsed — no raw error text. */
export const NETWORK_ERROR_MESSAGE =
	'Could not reach the AI service. Check your connection and try again.';

/** Prefix for inline transcript lines when a turn fails (still user-safe). */
export function formatTurnError(userSafeLine: string): string {
	return `Error: ${userSafeLine}`;
}
