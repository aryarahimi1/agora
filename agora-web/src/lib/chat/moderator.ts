import { callAI, type DiscussionEntry, type Message } from '$lib/api';
import type { Agent, DiscussionMode } from '$lib/chat/types';

/**
 * The orchestrator that replaces fixed per-round rotation. A cheap model is
 * asked, after each agent turn, who should speak next (and whether the
 * discussion has anything useful left to add). It does NOT generate the
 * agent's reply itself.
 */
export interface ModeratorChoice {
	done: boolean;
	speakerId: string | null;
	instruction: string;
	reason: string;
}

const MODERATOR_MODEL = 'openai/gpt-4o-mini';

/** How far back the moderator can see. Bigger context burns tokens with
 *  diminishing returns — most routing decisions depend on the last few
 *  exchanges. */
const TRANSCRIPT_WINDOW = 8;

const MODE_STYLE: Record<DiscussionMode, string> = {
	collaborative:
		'Cooperative inquiry. Each speaker should build on the prior turn, fill gaps, or apply the idea. Avoid contradicting unless a claim is wrong.',
	debate:
		'Adversarial. Alternate sides aggressively. Favor the speaker whose position has been weakest in recent turns so the strongest case for each side surfaces.',
	brainstorm:
		'Generative. Reward lateral leaps and unexpected combinations. Suppress critics until the back third of the budget.',
	consensus:
		'Surface positions early, converge late. In the back half, favor synthesizers and mediators over advocates.',
	roleplay:
		'Distinct voices in character. Rotate so each role gets airtime; avoid back-to-back same-character turns unless one is directly answering a critique.'
};

function summarizeAgent(a: Agent): string {
	return `- id=${a.id} name="${a.name}" — ${a.persona}`;
}

function summarizeEntry(e: DiscussionEntry): string {
	const role = e.kind === 'moderator' ? 'moderator' : e.participant;
	const body = (e.response ?? '').replace(/\s+/g, ' ').trim();
	const trimmed = body.length > 360 ? `${body.slice(0, 360)}…` : body;
	return `[${role}] ${trimmed}`;
}

function recentTranscript(entries: DiscussionEntry[]): string {
	const agentTurns = entries.filter((e) => e.kind !== 'moderator');
	const window = agentTurns.slice(-TRANSCRIPT_WINDOW);
	if (window.length === 0) return '(no turns yet)';
	return window.map(summarizeEntry).join('\n');
}

function buildSystemPrompt(): string {
	return [
		'You are a discussion moderator routing a multi-agent panel.',
		'Your job: pick the next speaker, give them a one-line directive, and decide when the discussion has nothing useful left to add.',
		'',
		'Output ONLY a single JSON object wrapped in <choice></choice> tags. No prose outside the tags.',
		'Schema: {"done": boolean, "speakerId": string|null, "instruction": string, "reason": string}',
		'  - done: true ONLY when the discussion has reached a natural close (positions are clear, key tensions surfaced, no new angle would help). When done=true, speakerId may be null.',
		'  - speakerId: the exact id of the chosen participant from the roster.',
		'  - instruction: a terse directive aimed at the chosen speaker (e.g., "push back on the cost claim", "synthesize the two positions", "share your opening view"). Max ~14 words.',
		'  - reason: 3-8 word internal note (e.g., "skeptic has not yet challenged", "ready to synthesize").',
		'',
		'Rules:',
		'1. Favor the speaker who will add the most NEW signal — fresh challenge, missing evidence, an unspoken angle, or a synthesis when the room is ready.',
		'2. Avoid picking the same speaker twice in a row unless they are answering a direct critique aimed at them.',
		'3. Respect the mode style guide.',
		'4. If two or fewer turns of budget remain and no synthesis has happened, prefer a synthesizing voice.',
		'5. Never invent a speaker id. Pick only from the roster.'
	].join('\n');
}

function buildUserPrompt(args: {
	topic: string;
	mode: DiscussionMode;
	agents: Agent[];
	entries: DiscussionEntry[];
	budgetTotal: number;
	turnsTaken: number;
}): string {
	const remaining = Math.max(0, args.budgetTotal - args.turnsTaken);
	return [
		`Topic: ${args.topic}`,
		'',
		`Mode: ${args.mode} — ${MODE_STYLE[args.mode]}`,
		'',
		'Roster:',
		args.agents.map(summarizeAgent).join('\n'),
		'',
		`Budget: ${args.turnsTaken}/${args.budgetTotal} turns used, ${remaining} remaining.`,
		'',
		'Recent transcript (oldest first):',
		recentTranscript(args.entries),
		'',
		'Respond now with <choice>{...}</choice>.'
	].join('\n');
}

function tryParseChoice(raw: string): Partial<ModeratorChoice> | null {
	const match = raw.match(/<choice>([\s\S]*?)<\/choice>/i);
	const payload = match ? match[1] : raw;
	const trimmed = payload.trim();
	const start = trimmed.indexOf('{');
	const end = trimmed.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		const obj = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
		const done = obj.done === true;
		const speakerId = typeof obj.speakerId === 'string' ? obj.speakerId : null;
		const instruction = typeof obj.instruction === 'string' ? obj.instruction : '';
		const reason = typeof obj.reason === 'string' ? obj.reason : '';
		return { done, speakerId, instruction, reason };
	} catch {
		return null;
	}
}

/** Pick the agent who has spoken least recently (and least overall). Used
 *  when the moderator call fails or returns an unknown id. Never returns
 *  done=true so the run still has a way to terminate via budget. */
function fallbackPick(args: {
	agents: Agent[];
	entries: DiscussionEntry[];
	turnsTaken: number;
	budgetTotal: number;
}): ModeratorChoice {
	const counts = new Map<string, number>();
	let lastSpeakerName = '';
	for (const a of args.agents) counts.set(a.id, 0);
	for (const e of args.entries) {
		if (e.kind === 'moderator') continue;
		const owner = args.agents.find((a) => `${a.emoji} ${a.name}` === e.participant);
		if (owner) {
			counts.set(owner.id, (counts.get(owner.id) ?? 0) + 1);
			lastSpeakerName = owner.id;
		}
	}
	const ranked = [...args.agents].sort((a, b) => {
		const ca = counts.get(a.id) ?? 0;
		const cb = counts.get(b.id) ?? 0;
		if (ca !== cb) return ca - cb;
		// Break ties by avoiding the most recent speaker.
		if (a.id === lastSpeakerName) return 1;
		if (b.id === lastSpeakerName) return -1;
		return 0;
	});
	const speaker = ranked[0] ?? args.agents[0];
	return {
		done: false,
		speakerId: speaker.id,
		instruction:
			args.turnsTaken === 0
				? 'Open the discussion with your strongest take.'
				: 'Add something new — challenge, evidence, or a missing angle.',
		reason: 'fallback rotation'
	};
}

export async function chooseNextSpeaker(args: {
	topic: string;
	mode: DiscussionMode;
	agents: Agent[];
	entries: DiscussionEntry[];
	budgetTotal: number;
	turnsTaken: number;
}): Promise<ModeratorChoice> {
	const system = buildSystemPrompt();
	const user = buildUserPrompt(args);
	const context: Message[] = [
		{ role: 'system', content: system },
		{ role: 'user', content: user }
	];

	let raw = '';
	try {
		raw = await callAI(MODERATOR_MODEL, 'discussion moderator', context);
	} catch {
		return fallbackPick(args);
	}

	const parsed = tryParseChoice(raw);
	if (!parsed) return fallbackPick(args);

	if (parsed.done) {
		return {
			done: true,
			speakerId: null,
			instruction: '',
			reason: parsed.reason || 'no further signal'
		};
	}

	const speaker = args.agents.find((a) => a.id === parsed.speakerId);
	if (!speaker) return fallbackPick(args);

	return {
		done: false,
		speakerId: speaker.id,
		instruction: (parsed.instruction || '').slice(0, 240),
		reason: (parsed.reason || '').slice(0, 120)
	};
}
