import { browser } from '$app/environment';
import { models as DEFAULT_MODELS_MAP, type DiscussionEntry } from '$lib/api';
import { apiFetch } from '$lib/auth/apiClient';
import { auth } from '$lib/auth/auth.svelte';
import {
	MODE_DEFAULT_AGENTS,
	MODE_META,
	type Agent,
	type ChatSession,
	type DiscussionMode
} from '$lib/chat/types';

const STORAGE_KEY = 'agora-workspace-v1';

const FALLBACK_MODEL_ROTATION: string[] = [
	DEFAULT_MODELS_MAP.AI_1,
	DEFAULT_MODELS_MAP.AI_2,
	DEFAULT_MODELS_MAP.AI_3,
	'anthropic/claude-3.5-sonnet',
	'meta-llama/llama-3.3-70b-instruct',
	'openai/gpt-4o'
];

// Snake-case shapes from the server

interface AgentRemote {
	id: string;
	name: string;
	emoji: string;
	persona: string;
	model: string;
}

interface ChatRemote {
	id: string;
	title: string;
	mode: string;
	generations: number;
	draft_topic: string;
	agents?: AgentRemote[];
	entries?: DiscussionEntry[];
	created_at: string;
	updated_at: string;
}

interface ChatListItem {
	id: string;
	title: string;
	mode: string;
	generations: number;
	draft_topic: string;
	created_at: string;
	updated_at: string;
}

function remoteToSession(r: ChatRemote): ChatSession {
	const mode: DiscussionMode = isMode(r.mode) ? r.mode : 'roleplay';
	const rawAgents = Array.isArray(r.agents) && r.agents.length > 0
		? r.agents.map(normalizeAgent)
		: defaultAgentsForMode(mode, 3);
	return {
		id: r.id,
		title: r.title ?? 'New chat',
		mode,
		generations: clampGenerations(r.generations),
		agents: clampAgentsToMode(rawAgents, mode),
		draftTopic: typeof r.draft_topic === 'string' ? r.draft_topic : '',
		entries: Array.isArray(r.entries) ? r.entries : [],
		createdAt: new Date(r.created_at).getTime(),
		updatedAt: new Date(r.updated_at).getTime()
	};
}

function listItemToSession(r: ChatListItem): ChatSession {
	const mode: DiscussionMode = isMode(r.mode) ? r.mode : 'roleplay';
	return {
		id: r.id,
		title: r.title ?? 'New chat',
		mode,
		generations: clampGenerations(r.generations),
		agents: defaultAgentsForMode(mode, 3),
		draftTopic: typeof r.draft_topic === 'string' ? r.draft_topic : '',
		entries: [],
		createdAt: new Date(r.created_at).getTime(),
		updatedAt: new Date(r.updated_at).getTime()
	};
}

function sessionToRemote(s: ChatSession): Record<string, unknown> {
	return {
		title: s.title,
		mode: s.mode,
		generations: s.generations,
		draft_topic: s.draftTopic,
		agents: s.agents,
		entries: s.entries
	};
}

function newId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function defaultAgentsForMode(mode: DiscussionMode, count = 3): Agent[] {
	const meta = MODE_META[mode];
	const n = Math.max(meta.minAgents, Math.min(meta.maxAgents, count));
	const tpls = MODE_DEFAULT_AGENTS[mode];
	const out: Agent[] = [];
	for (let i = 0; i < n; i++) {
		const tpl = tpls[i] ?? tpls[i % tpls.length];
		out.push({
			id: newId(),
			name: tpl.name,
			emoji: tpl.emoji,
			persona: tpl.persona,
			model: FALLBACK_MODEL_ROTATION[i % FALLBACK_MODEL_ROTATION.length]
		});
	}
	return out;
}

function makeSession(partial?: Partial<Pick<ChatSession, 'mode' | 'generations' | 'draftTopic'>>): ChatSession {
	const mode = partial?.mode ?? 'roleplay';
	return {
		id: newId(),
		title: 'New chat',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		mode,
		generations: partial?.generations ?? 3,
		agents: defaultAgentsForMode(mode, 3),
		draftTopic: partial?.draftTopic ?? '',
		entries: []
	};
}

export const workspace = $state({
	sessions: [] as ChatSession[],
	activeChatId: null as string | null,
	hydrated: false
});

// Debounce map for setChatEntries — one timer per chatId
const _entriesDebounce = new Map<string, ReturnType<typeof setTimeout>>();

// Chats whose full detail (agents + entries) is already in memory.
// List endpoint returns stubs; we fetch full detail lazily on first select.
const _loadedChats = new Set<string>();

async function ensureChatLoaded(id: string): Promise<void> {
	if (_loadedChats.has(id)) return;
	if (auth.status !== 'authed') return;
	try {
		const remote = await apiFetch<ChatRemote>(`/api/chats/${id}`);
		const idx = workspace.sessions.findIndex((s) => s.id === id);
		if (idx >= 0) {
			workspace.sessions[idx] = remoteToSession(remote);
		}
		_loadedChats.add(id);
	} catch {
		/* leave the stub in place */
	}
}

function normalizeSession(s: ChatSession): ChatSession {
	const mode: DiscussionMode = isMode(s.mode) ? s.mode : 'roleplay';
	const agents = Array.isArray(s.agents) && s.agents.length > 0 ? s.agents.map(normalizeAgent) : defaultAgentsForMode(mode, 3);
	return {
		...s,
		mode,
		agents: clampAgentsToMode(agents, mode),
		entries: Array.isArray(s.entries) ? s.entries : [],
		generations: clampGenerations(s.generations),
		draftTopic: typeof s.draftTopic === 'string' ? s.draftTopic : ''
	};
}

function normalizeAgent(a: Agent): Agent {
	return {
		id: a.id ?? newId(),
		name: typeof a.name === 'string' && a.name.trim() ? a.name : 'Agent',
		emoji: typeof a.emoji === 'string' && a.emoji ? a.emoji : '✨',
		persona: typeof a.persona === 'string' ? a.persona : 'a thoughtful assistant',
		model: typeof a.model === 'string' && a.model ? a.model : FALLBACK_MODEL_ROTATION[0]
	};
}

function isMode(x: unknown): x is DiscussionMode {
	return typeof x === 'string' && Object.prototype.hasOwnProperty.call(MODE_META, x);
}

function clampAgentsToMode(agents: Agent[], mode: DiscussionMode): Agent[] {
	const meta = MODE_META[mode];
	if (agents.length < meta.minAgents) {
		const fillers = defaultAgentsForMode(mode, meta.minAgents).slice(agents.length);
		return [...agents, ...fillers];
	}
	if (agents.length > meta.maxAgents) {
		return agents.slice(0, meta.maxAgents);
	}
	return agents;
}

function clampGenerations(n: number): number {
	const x = Number.isFinite(n) ? Math.floor(n) : 3;
	return Math.min(24, Math.max(1, x));
}

export function selectChat(id: string): void {
	if (!workspace.sessions.some((s) => s.id === id)) return;
	workspace.activeChatId = id;
	void ensureChatLoaded(id);
}

export async function newChat(mode?: DiscussionMode): Promise<void> {
	const optimistic = makeSession(mode ? { mode } : undefined);
	workspace.sessions.unshift(optimistic);
	workspace.activeChatId = optimistic.id;

	if (auth.status === 'authed') {
		try {
			const remote = await apiFetch<ChatRemote>('/api/chats', {
				method: 'POST',
				body: JSON.stringify(sessionToRemote(optimistic))
			});
			const confirmed = remoteToSession(remote);
			const idx = workspace.sessions.findIndex((s) => s.id === optimistic.id);
			if (idx >= 0) {
				workspace.sessions[idx] = confirmed;
				if (workspace.activeChatId === optimistic.id) {
					workspace.activeChatId = confirmed.id;
				}
			}
			_loadedChats.add(confirmed.id);
		} catch {
			// Roll back the optimistic insert: a local non-UUID id would 422 every
			// subsequent server call against this chat.
			const idx = workspace.sessions.findIndex((s) => s.id === optimistic.id);
			if (idx >= 0) workspace.sessions.splice(idx, 1);
			if (workspace.activeChatId === optimistic.id) {
				workspace.activeChatId = workspace.sessions[0]?.id ?? null;
			}
		}
	} else {
		_loadedChats.add(optimistic.id);
	}
}

export async function deleteChat(id: string): Promise<void> {
	const idx = workspace.sessions.findIndex((s) => s.id === id);
	if (idx < 0) return;

	// Cancel any pending debounced PUT for this chat so we don't write to a row
	// the server is about to (or just did) delete.
	const t = _entriesDebounce.get(id);
	if (t !== undefined) clearTimeout(t);
	_entriesDebounce.delete(id);
	_loadedChats.delete(id);

	workspace.sessions.splice(idx, 1);
	if (workspace.activeChatId === id) {
		workspace.activeChatId = workspace.sessions[0]?.id ?? null;
	}
	if (workspace.sessions.length === 0) {
		void newChat();
		return;
	}

	if (auth.status === 'authed') {
		try {
			await apiFetch(`/api/chats/${id}`, { method: 'DELETE' });
		} catch {
			/* best-effort */
		}
	}
}

export function activeChat(): ChatSession | null {
	return workspace.sessions.find((s) => s.id === workspace.activeChatId) ?? null;
}

export async function patchActiveChat(
	patch: Partial<
		Pick<ChatSession, 'mode' | 'generations' | 'agents' | 'title' | 'entries' | 'draftTopic'>
	>
): Promise<void> {
	const id = workspace.activeChatId;
	if (!id) return;
	const i = workspace.sessions.findIndex((s) => s.id === id);
	if (i < 0) return;

	const cur = workspace.sessions[i];
	const nextG = patch.generations !== undefined ? clampGenerations(patch.generations) : cur.generations;
	const nextMode = patch.mode ?? cur.mode;
	const nextAgents = patch.agents ? clampAgentsToMode(patch.agents, nextMode) : cur.agents;

	workspace.sessions[i] = {
		...cur,
		...patch,
		mode: nextMode,
		generations: nextG,
		agents: nextAgents,
		updatedAt: Date.now()
	};

	// entries-only changes go via setChatEntries path; skip PATCH for those
	const hasNonEntryChange = patch.mode !== undefined
		|| patch.generations !== undefined
		|| patch.agents !== undefined
		|| patch.title !== undefined
		|| patch.draftTopic !== undefined;

	if (auth.status === 'authed' && hasNonEntryChange) {
		const remotePayload: Record<string, unknown> = {};
		if (patch.mode !== undefined) remotePayload.mode = patch.mode;
		if (patch.generations !== undefined) remotePayload.generations = nextG;
		if (patch.agents !== undefined) remotePayload.agents = nextAgents;
		if (patch.title !== undefined) remotePayload.title = patch.title;
		if (patch.draftTopic !== undefined) remotePayload.draft_topic = patch.draftTopic;

		try {
			const remote = await apiFetch<ChatRemote>(`/api/chats/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(remotePayload)
			});
			const idx2 = workspace.sessions.findIndex((s) => s.id === id);
			if (idx2 >= 0) {
				// preserve local entries (remote full shape may not include them on list endpoint)
				workspace.sessions[idx2] = {
					...remoteToSession(remote),
					entries: workspace.sessions[idx2].entries
				};
			}
		} catch {
			/* optimistic stays */
		}
	}
}

export function switchMode(mode: DiscussionMode): void {
	void patchActiveChat({ mode, agents: defaultAgentsForMode(mode, 3) });
}

export function addAgent(): void {
	const c = activeChat();
	if (!c) return;
	const meta = MODE_META[c.mode];
	if (c.agents.length >= meta.maxAgents) return;
	const tpls = MODE_DEFAULT_AGENTS[c.mode];
	const tpl = tpls[c.agents.length] ?? tpls[c.agents.length % tpls.length];
	const next: Agent = {
		id: newId(),
		name: tpl.name,
		emoji: tpl.emoji,
		persona: tpl.persona,
		model: FALLBACK_MODEL_ROTATION[c.agents.length % FALLBACK_MODEL_ROTATION.length]
	};
	void patchActiveChat({ agents: [...c.agents, next] });
}

export function removeAgent(agentId: string): void {
	const c = activeChat();
	if (!c) return;
	const meta = MODE_META[c.mode];
	if (c.agents.length <= meta.minAgents) return;
	void patchActiveChat({ agents: c.agents.filter((a) => a.id !== agentId) });
}

export function updateAgent(agentId: string, patch: Partial<Omit<Agent, 'id'>>): void {
	const c = activeChat();
	if (!c) return;
	void patchActiveChat({
		agents: c.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
	});
}

export function resetAgentsToDefaults(): void {
	const c = activeChat();
	if (!c) return;
	void patchActiveChat({ agents: defaultAgentsForMode(c.mode, c.agents.length) });
}

export function setChatEntries(chatId: string, entries: DiscussionEntry[]): void {
	const i = workspace.sessions.findIndex((s) => s.id === chatId);
	if (i < 0) return;
	workspace.sessions[i] = {
		...workspace.sessions[i],
		entries: [...entries],
		updatedAt: Date.now()
	};

	if (auth.status !== 'authed') return;

	const existing = _entriesDebounce.get(chatId);
	if (existing !== undefined) clearTimeout(existing);

	const timer = setTimeout(() => {
		_entriesDebounce.delete(chatId);
		const cur = workspace.sessions.find((s) => s.id === chatId);
		if (!cur) return;
		apiFetch(`/api/chats/${chatId}/entries`, {
			method: 'PUT',
			body: JSON.stringify({ entries: cur.entries })
		}).catch(() => {
			/* best-effort */
		});
	}, 400);

	_entriesDebounce.set(chatId, timer);
}

export async function bumpTitleFromTopic(chatId: string, topic: string): Promise<void> {
	const t = topic.trim();
	if (!t) return;
	const title = t.length > 56 ? `${t.slice(0, 53)}…` : t;
	const i = workspace.sessions.findIndex((s) => s.id === chatId);
	if (i < 0) return;
	if (workspace.sessions[i].title === 'New chat' || workspace.sessions[i].title.length < 4) {
		workspace.sessions[i] = { ...workspace.sessions[i], title, updatedAt: Date.now() };

		if (auth.status === 'authed') {
			try {
				await apiFetch<ChatRemote>(`/api/chats/${chatId}`, {
					method: 'PATCH',
					body: JSON.stringify({ title })
				});
			} catch {
				/* optimistic stays */
			}
		}
	}
}

export async function renameChat(chatId: string, title: string): Promise<void> {
	const i = workspace.sessions.findIndex((s) => s.id === chatId);
	if (i < 0) return;
	const t = title.trim();
	if (!t) return;
	workspace.sessions[i] = { ...workspace.sessions[i], title: t.slice(0, 80), updatedAt: Date.now() };

	if (auth.status === 'authed') {
		try {
			await apiFetch<ChatRemote>(`/api/chats/${chatId}`, {
				method: 'PATCH',
				body: JSON.stringify({ title: t.slice(0, 80) })
			});
		} catch {
			/* optimistic stays */
		}
	}
}

async function runImport(userId: string): Promise<void> {
	if (!browser) return;
	const importedKey = `agora-imported-${userId}`;
	if (localStorage.getItem(importedKey)) return;

	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return;

	let legacy: { sessions?: ChatSession[] } | null = null;
	try {
		legacy = JSON.parse(raw) as { sessions?: ChatSession[] };
	} catch {
		return;
	}

	const sessions = legacy?.sessions ?? [];
	if (sessions.length === 0) return;

	try {
		await apiFetch('/api/chats/import', {
			method: 'POST',
			body: JSON.stringify({ sessions })
		});
		localStorage.setItem(importedKey, '1');
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* best-effort; don't remove legacy data on failure */
	}
}

export async function hydrateWorkspace(): Promise<void> {
	if (!browser) return;
	// Wait for auth bootstrap to finish before deciding which branch to take;
	// otherwise a page loaded with a valid session can briefly look "guest"
	// and we'd create a phantom local chat that doesn't exist on the server.
	if (auth.status === 'loading') return;
	workspace.hydrated = true;

	if (auth.status === 'authed' && auth.user) {
		// Drop any guest-mode sessions we may have populated earlier in this
		// page lifetime — their ids don't exist on the server and would
		// otherwise leak through as 404-producing PATCH/PUT requests.
		_loadedChats.clear();
		workspace.sessions = [];
		workspace.activeChatId = null;

		// One-shot legacy import before fetching list
		await runImport(auth.user.id);

		try {
			const list = await apiFetch<ChatListItem[]>('/api/chats');
			workspace.sessions = list.map(listItemToSession);
		} catch {
			workspace.sessions = [];
		}

		if (workspace.sessions.length === 0) {
			await newChat();
		} else {
			workspace.activeChatId = workspace.sessions[0]?.id ?? null;
			if (workspace.activeChatId) {
				void ensureChatLoaded(workspace.activeChatId);
			}
		}
	} else {
		// Guest fallback — read localStorage so the page isn't blank.
		// Always wipe in-memory state first so a logout doesn't leak the
		// previous user's chats into guest mode.
		_loadedChats.clear();
		workspace.sessions = [];
		workspace.activeChatId = null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const data = JSON.parse(raw) as {
					sessions?: ChatSession[];
					activeChatId?: string | null;
				};
				for (const s of data.sessions ?? []) {
					workspace.sessions.push(normalizeSession(s));
				}
				workspace.activeChatId = data.activeChatId ?? workspace.sessions[0]?.id ?? null;
			}
		} catch {
			/* ignore */
		}

		if (workspace.sessions.length === 0) {
			const s = makeSession();
			workspace.sessions.push(s);
			workspace.activeChatId = s.id;
		}

		if (!workspace.activeChatId || !workspace.sessions.some((s) => s.id === workspace.activeChatId)) {
			workspace.activeChatId = workspace.sessions[0]?.id ?? null;
		}
	}
}
