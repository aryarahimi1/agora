import type { ModelOption } from '$lib/chat/modelsCatalog';
import type { Agent, DiscussionMode } from '$lib/chat/types';
import { MODE_DEFAULT_AGENTS, MODE_META } from '$lib/chat/types';

const BUDGET_SHORT = 6;
const BUDGET_STANDARD = 12;
const BUDGET_DEEP = 20;

export type ComposerMode = 'auto' | 'manual';

const STORAGE_KEY = 'agora-composer-mode-v1';

function loadMap(): Record<string, ComposerMode> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, ComposerMode>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function saveMap(map: Record<string, ComposerMode>): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch {
		/* quota or disabled storage; non-fatal */
	}
}

export const composerModes = $state<{ map: Record<string, ComposerMode> }>({
	map: typeof localStorage === 'undefined' ? {} : loadMap()
});

export function getComposerMode(chatId: string): ComposerMode {
	return composerModes.map[chatId] ?? 'manual';
}

export function setComposerMode(chatId: string, mode: ComposerMode): void {
	composerModes.map = { ...composerModes.map, [chatId]: mode };
	saveMap(composerModes.map);
}

const CHEAP_MODEL_PREFERENCE: string[] = [
	'openai/gpt-4o-mini',
	'google/gemini-2.5-flash',
	'google/gemini-flash-1.5',
	'deepseek/deepseek-chat-v3.1',
	'anthropic/claude-3.5-haiku',
	'meta-llama/llama-3.3-70b-instruct',
	'openai/gpt-4o'
];

function pickCheapModels(catalog: ModelOption[], n: number): string[] {
	const available = new Set(catalog.map((m) => m.id));
	const picked: string[] = [];
	for (const id of CHEAP_MODEL_PREFERENCE) {
		if (picked.length >= n) break;
		if (available.has(id)) picked.push(id);
	}
	if (picked.length < n) {
		for (const m of catalog) {
			if (picked.length >= n) break;
			if (!picked.includes(m.id)) picked.push(m.id);
		}
	}
	if (picked.length === 0) {
		for (let i = 0; i < n; i++) picked.push(CHEAP_MODEL_PREFERENCE[i % CHEAP_MODEL_PREFERENCE.length]);
	}
	return picked.slice(0, Math.max(1, n));
}

function pickModeForTopic(topic: string): DiscussionMode {
	const t = topic.toLowerCase();
	if (/\b(debate|argue|argument|pros and cons|for or against|versus|vs\.?|defend|oppose)\b/.test(t)) return 'debate';
	if (/\b(brainstorm|ideate|ideas?|imagine|invent|wild|creative|novel|what if)\b/.test(t)) return 'brainstorm';
	if (/\b(consensus|agree|common ground|compromise|reconcile|negotiate|align)\b/.test(t)) return 'consensus';
	if (/\b(roleplay|perspective|perspectives|viewpoints?|stakeholders?|from the view of)\b/.test(t)) return 'roleplay';
	return 'collaborative';
}

function pickAgentCount(mode: DiscussionMode, topic: string): number {
	const meta = MODE_META[mode];
	if (!meta.flexibleAgents) return meta.minAgents;
	const len = topic.trim().length;
	if (len < 60) return 3;
	if (len < 200) return 4;
	return Math.min(5, meta.maxAgents);
}

function pickBudget(topic: string): number {
	const t = topic.trim();
	const len = t.length;
	// Heuristic: very short prompts get a quick exchange; long, multi-part
	// prompts (or anything with multiple question marks) earn a deep run.
	const questionMarks = (t.match(/\?/g) ?? []).length;
	if (len < 50 && questionMarks <= 1) return BUDGET_SHORT;
	if (len > 240 || questionMarks >= 3) return BUDGET_DEEP;
	return BUDGET_STANDARD;
}

function newId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface AutoPlan {
	mode: DiscussionMode;
	/** Total agent-turn budget. Moderator may end the run sooner. */
	budget: number;
	agents: Agent[];
}

export function planAuto(topic: string, catalog: ModelOption[]): AutoPlan {
	const mode = pickModeForTopic(topic);
	const count = pickAgentCount(mode, topic);
	const models = pickCheapModels(catalog, count);
	const templates = MODE_DEFAULT_AGENTS[mode];
	const agents: Agent[] = [];
	for (let i = 0; i < count; i++) {
		const tpl = templates[i] ?? templates[i % templates.length];
		agents.push({
			id: newId(),
			name: tpl.name,
			emoji: tpl.emoji,
			persona: tpl.persona,
			model: models[i % models.length]
		});
	}
	return { mode, budget: pickBudget(topic), agents };
}
