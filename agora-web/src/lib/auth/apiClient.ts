// `??` keeps an explicit empty-string build arg empty so calls go same-origin.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
	readonly status: number;
	readonly detail: string;

	constructor(status: number, detail: string) {
		super(detail);
		this.name = 'ApiError';
		this.status = status;
		this.detail = detail;
	}
}

// in-memory token; refresh cookie is httpOnly
let _accessToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
	_accessToken = token;
}

export function getAccessToken(): string | null {
	return _accessToken;
}

export function setUnauthorizedHandler(fn: () => void): void {
	_onUnauthorized = fn;
}

async function attemptRefresh(): Promise<string | null> {
	try {
		const res = await fetch(`${API_BASE}/auth/refresh`, {
			method: 'POST',
			credentials: 'include'
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { access_token: string };
		setAccessToken(data.access_token);
		return data.access_token;
	} catch {
		return null;
	}
}

function refreshOnce(): Promise<string | null> {
	if (!_refreshPromise) {
		_refreshPromise = attemptRefresh().finally(() => {
			_refreshPromise = null;
		});
	}
	return _refreshPromise;
}

export async function apiFetch<T = unknown>(
	path: string,
	init: RequestInit & { skipRetry?: boolean } = {}
): Promise<T> {
	const { skipRetry, ...fetchInit } = init;

	const headers = new Headers(fetchInit.headers);

	if (_accessToken) {
		headers.set('Authorization', `Bearer ${_accessToken}`);
	}

	if (fetchInit.body && typeof fetchInit.body === 'string' && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	const response = await fetch(`${API_BASE}${path}`, {
		...fetchInit,
		headers,
		credentials: 'include'
	});

	if (response.status === 401 && !skipRetry) {
		const newToken = await refreshOnce();
		if (newToken) {
			return apiFetch<T>(path, { ...init, skipRetry: true });
		}
		_onUnauthorized?.();
		const body = await response.json().catch(() => ({ detail: 'Unauthorized' }));
		throw new ApiError(401, (body as { detail?: string }).detail ?? 'Unauthorized');
	}

	if (!response.ok) {
		const body = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
		throw new ApiError(response.status, (body as { detail?: string }).detail ?? `HTTP ${response.status}`);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}
