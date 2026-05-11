import { browser } from '$app/environment';
import { apiFetch, setAccessToken, setUnauthorizedHandler } from './apiClient';

// `??` keeps an explicit empty-string build arg empty so calls go same-origin.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface AuthUser {
	id: string;
	email: string;
	name: string | null;
	created_at: string;
	email_verified_at: string | null;
	openrouter_key_set: boolean;
}

type AuthStatus = 'loading' | 'authed' | 'guest';

export const auth = $state<{
	user: AuthUser | null;
	accessToken: string | null;
	status: AuthStatus;
}>({
	user: null,
	accessToken: null,
	status: 'loading'
});

setUnauthorizedHandler(() => {
	auth.user = null;
	auth.accessToken = null;
	auth.status = 'guest';
	setAccessToken(null);
});

// Non-httponly hint cookie set alongside the refresh cookie at /auth/{login,signup,refresh}.
// Lets us avoid a cold-load /auth/refresh roundtrip — and the rate-limit hit it would incur —
// for users who don't have a session.
function hasSessionHint(): boolean {
	if (typeof document === 'undefined') return false;
	return document.cookie.split(';').some((c) => c.trim().startsWith('has_session='));
}

export async function bootstrap(): Promise<void> {
	if (!browser) return;

	if (!hasSessionHint()) {
		auth.status = 'guest';
		return;
	}

	try {
		const data = await fetch(`${API_BASE}/auth/refresh`, {
			method: 'POST',
			credentials: 'include'
		});

		if (!data.ok) {
			auth.status = 'guest';
			return;
		}

		const json = (await data.json()) as { access_token?: string };
		if (!json.access_token) {
			auth.status = 'guest';
			return;
		}
		setAccessToken(json.access_token);
		auth.accessToken = json.access_token;

		const user = await apiFetch<AuthUser>('/auth/me');
		auth.user = user;
		auth.status = 'authed';
	} catch {
		auth.status = 'guest';
	}
}

export async function login(credentials: { email: string; password: string }): Promise<void> {
	const data = await apiFetch<{ user: AuthUser; access_token: string; token_type: string }>(
		'/auth/login',
		{
			method: 'POST',
			body: JSON.stringify(credentials),
			skipRetry: true
		} as RequestInit & { skipRetry?: boolean }
	);

	setAccessToken(data.access_token);
	auth.accessToken = data.access_token;
	auth.user = data.user;
	auth.status = 'authed';
}

export async function signup(credentials: {
	email: string;
	password: string;
	name?: string;
}): Promise<void> {
	const data = await apiFetch<{ user: AuthUser; access_token: string; token_type: string }>(
		'/auth/signup',
		{
			method: 'POST',
			body: JSON.stringify(credentials),
			skipRetry: true
		} as RequestInit & { skipRetry?: boolean }
	);

	setAccessToken(data.access_token);
	auth.accessToken = data.access_token;
	auth.user = data.user;
	auth.status = 'authed';
}

export async function logout(): Promise<void> {
	try {
		await apiFetch('/auth/logout', { method: 'POST' });
	} catch {
		/* best-effort */
	}
	setAccessToken(null);
	auth.user = null;
	auth.accessToken = null;
	auth.status = 'guest';
}

export function setOpenrouterKeySet(v: boolean): void {
	if (auth.user) auth.user.openrouter_key_set = v;
}

export async function refreshAccount(): Promise<void> {
	try {
		const user = await apiFetch<AuthUser>('/auth/me');
		auth.user = user;
	} catch {
		/* best-effort — stale state is acceptable */
	}
}
