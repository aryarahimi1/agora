import { browser } from '$app/environment';
import { models as DEFAULT_MODELS_MAP, type DiscussionEntry } from '$lib/api';
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

/** Single exported reactive blob — Svelte requires this pattern for module state. */
export const workspace = $state({
	sessions: [] as ChatSession[],
	activeChatId: null as string | null,
	hydrated: false
});

function persist(): void {
	if (!browser || !workspace.hydrated) return;
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ sessions: workspace.sessions, activeChatId: workspace.activeChatId })
		);
	} catch {
		/* quota */
	}
}

export function hydrateWorkspace(): void {
	if (!browser || workspace.hydrated) return;
	workspace.hydrated = true;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const data = JSON.parse(raw) as {
				sessions?: ChatSession[];
				activeChatId?: string | null;
			};
			workspace.sessions = [];
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

	persist();
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
	persist();
}

export function newChat(mode?: DiscussionMode): void {
	const s = makeSession(mode ? { mode } : undefined);
	workspace.sessions.unshift(s);
	workspace.activeChatId = s.id;
	persist();
}

export function deleteChat(id: string): void {
	const idx = workspace.sessions.findIndex((s) => s.id === id);
	if (idx < 0) return;
	workspace.sessions.splice(idx, 1);
	if (workspace.activeChatId === id) {
		workspace.activeChatId = workspace.sessions[0]?.id ?? null;
	}
	if (workspace.sessions.length === 0) {
		const s = makeSession();
		workspace.sessions.push(s);
		workspace.activeChatId = s.id;
	}
	persist();
}

export function activeChat(): ChatSession | null {
	return workspace.sessions.find((s) => s.id === workspace.activeChatId) ?? null;
}

export function patchActiveChat(
	patch: Partial<
		Pick<ChatSession, 'mode' | 'generations' | 'agents' | 'title' | 'entries' | 'draftTopic'>
	>
): void {
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
	persist();
}

/** Switch mode and reset agents to that mode's defaults. */
export function switchMode(mode: DiscussionMode): void {
	patchActiveChat({ mode, agents: defaultAgentsForMode(mode, 3) });
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
	patchActiveChat({ agents: [...c.agents, next] });
}

export function removeAgent(agentId: string): void {
	const c = activeChat();
	if (!c) return;
	const meta = MODE_META[c.mode];
	if (c.agents.length <= meta.minAgents) return;
	patchActiveChat({ agents: c.agents.filter((a) => a.id !== agentId) });
}

export function updateAgent(agentId: string, patch: Partial<Omit<Agent, 'id'>>): void {
	const c = activeChat();
	if (!c) return;
	patchActiveChat({
		agents: c.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
	});
}

export function resetAgentsToDefaults(): void {
	const c = activeChat();
	if (!c) return;
	patchActiveChat({ agents: defaultAgentsForMode(c.mode, c.agents.length) });
}

export function setChatEntries(chatId: string, entries: DiscussionEntry[]): void {
	const i = workspace.sessions.findIndex((s) => s.id === chatId);
	if (i < 0) return;
	workspace.sessions[i] = {
		...workspace.sessions[i],
		entries: [...entries],
		updatedAt: Date.now()
	};
	persist();
}

export function bumpTitleFromTopic(chatId: string, topic: string): void {
	const t = topic.trim();
	if (!t) return;
	const title = t.length > 56 ? `${t.slice(0, 53)}…` : t;
	const i = workspace.sessions.findIndex((s) => s.id === chatId);
	if (i < 0) return;
	if (workspace.sessions[i].title === 'New chat' || workspace.sessions[i].title.length < 4) {
		workspace.sessions[i] = { ...workspace.sessions[i], title, updatedAt: Date.now() };
		persist();
	}
}

export function renameChat(chatId: string, title: string): void {
	const i = workspace.sessions.findIndex((s) => s.id === chatId);
	if (i < 0) return;
	const t = title.trim();
	if (!t) return;
	workspace.sessions[i] = { ...workspace.sessions[i], title: t.slice(0, 80), updatedAt: Date.now() };
	persist();
}
