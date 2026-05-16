import type { DiscussionEntry } from '$lib/api';

export type DiscussionMode =
	| 'roleplay'
	| 'consensus'
	| 'brainstorm'
	| 'debate'
	| 'collaborative';

export interface Agent {
	id: string;
	name: string;
	emoji: string;
	persona: string;
	model: string;
}

export interface ChatSession {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	mode: DiscussionMode;
	/** Total agent-turn budget. Moderator may end sooner. Clamped 2..24. */
	generations: number;
	agents: Agent[];
	/** Topic / prompt draft for the composer (per chat). */
	draftTopic: string;
	entries: DiscussionEntry[];
}

export interface ModeMeta {
	label: string;
	emoji: string;
	hint: string;
	gradientClass: string;
	/** Whether the user can add/remove agents for this mode. */
	flexibleAgents: boolean;
	minAgents: number;
	maxAgents: number;
}

export const MODE_META: Record<DiscussionMode, ModeMeta> = {
	roleplay: {
		label: 'Roleplay',
		emoji: '🎭',
		hint: 'Distinct voices, in character. The moderator rotates so every role gets airtime.',
		gradientClass: 'mode-roleplay',
		flexibleAgents: true,
		minAgents: 3,
		maxAgents: 6
	},
	consensus: {
		label: 'Consensus',
		emoji: '🤝',
		hint: 'Positions stated early, synthesis pulled in late. The moderator nudges toward convergence.',
		gradientClass: 'mode-consensus',
		flexibleAgents: true,
		minAgents: 3,
		maxAgents: 6
	},
	brainstorm: {
		label: 'Brainstorm',
		emoji: '💡',
		hint: 'Generative and lateral. Critics are held back until the back third.',
		gradientClass: 'mode-brainstorm',
		flexibleAgents: true,
		minAgents: 3,
		maxAgents: 6
	},
	debate: {
		label: 'Debate',
		emoji: '⚔️',
		hint: 'Adversarial. The moderator favors whichever side has been weakest.',
		gradientClass: 'mode-debate',
		flexibleAgents: true,
		minAgents: 3,
		maxAgents: 6
	},
	collaborative: {
		label: 'Collaborative',
		emoji: '🧠',
		hint: 'Each voice builds on the prior. The moderator routes for complementary turns.',
		gradientClass: 'mode-collaborative',
		flexibleAgents: true,
		minAgents: 3,
		maxAgents: 6
	}
};

/** Per-mode default persona templates. Index 0..N maps to slot order. */
export const MODE_DEFAULT_AGENTS: Record<
	DiscussionMode,
	Array<{ name: string; emoji: string; persona: string }>
> = {
	roleplay: [
		{
			name: 'Scientist',
			emoji: '🔬',
			persona: 'a brilliant scientist who explains concepts with precision and curiosity'
		},
		{
			name: 'Entrepreneur',
			emoji: '💼',
			persona:
				'an innovative entrepreneur who sees practical applications and market potential'
		},
		{
			name: 'Philosopher',
			emoji: '🤔',
			persona: 'a thoughtful philosopher who explores deeper meanings and ethical implications'
		},
		{
			name: 'Artist',
			emoji: '🎨',
			persona: 'a creative artist who finds aesthetic and emotional dimensions in every idea'
		},
		{
			name: 'Engineer',
			emoji: '⚙️',
			persona: 'a pragmatic engineer who focuses on how things actually work in practice'
		},
		{
			name: 'Historian',
			emoji: '📜',
			persona: 'a wise historian who places ideas in the context of how the past shaped them'
		}
	],
	consensus: [
		{
			name: 'Facilitator',
			emoji: '🕊️',
			persona: 'a diplomatic facilitator who seeks common ground and builds bridges between ideas'
		},
		{
			name: 'Negotiator',
			emoji: '🤝',
			persona: 'a practical negotiator who focuses on feasible solutions and compromises'
		},
		{
			name: 'Synthesizer',
			emoji: '🧩',
			persona: 'a synthesis expert who combines different viewpoints into unified conclusions'
		},
		{
			name: 'Mediator',
			emoji: '⚖️',
			persona: 'a fair mediator who surfaces unspoken concerns and balances competing needs'
		},
		{
			name: 'Pragmatist',
			emoji: '🎯',
			persona: 'a results-focused pragmatist who keeps the group anchored to actionable outcomes'
		},
		{
			name: 'Listener',
			emoji: '👂',
			persona: 'a careful listener who reflects back what others said before adding their view'
		}
	],
	brainstorm: [
		{
			name: 'Innovator',
			emoji: '💡',
			persona: 'a creative innovator who generates wild, out-of-the-box ideas without limits'
		},
		{
			name: 'Lateral Thinker',
			emoji: '🌀',
			persona: 'a lateral thinker who connects unexpected dots and finds novel approaches'
		},
		{
			name: 'Amplifier',
			emoji: '🚀',
			persona: "an idea amplifier who builds on others' concepts and makes them even better"
		},
		{
			name: 'Provocateur',
			emoji: '🔥',
			persona: 'a creative provocateur who reframes problems and challenges every assumption'
		},
		{
			name: 'Pattern Hunter',
			emoji: '🧠',
			persona: 'a pattern hunter who borrows ideas from unrelated domains'
		},
		{
			name: 'Builder',
			emoji: '🛠️',
			persona: 'a hands-on builder who turns abstract ideas into concrete prototypes'
		}
	],
	debate: [
		{
			name: 'Advocate',
			emoji: '🛡️',
			persona: 'a fierce advocate who passionately defends their position with strong arguments'
		},
		{
			name: 'Challenger',
			emoji: '⚔️',
			persona: 'a critical challenger who aggressively questions and pokes holes in ideas'
		},
		{
			name: 'Strategist',
			emoji: '♟️',
			persona: 'a strategic debater who uses logic and evidence to demolish opposing viewpoints'
		},
		{
			name: 'Skeptic',
			emoji: '🕵️',
			persona: 'a hard-nosed skeptic who demands evidence and exposes weak reasoning'
		},
		{
			name: 'Rhetorician',
			emoji: '🎤',
			persona: 'a master rhetorician who reframes arguments to win hearts as well as minds'
		},
		{
			name: 'Devil’s Advocate',
			emoji: '😈',
			persona: 'a devil’s advocate who argues whichever side is currently weakest'
		}
	],
	collaborative: [
		{
			name: 'Educator',
			emoji: '🧑‍🏫',
			persona: 'an insightful educator who explains concepts clearly and sees the big picture'
		},
		{
			name: 'Analyst',
			emoji: '🔎',
			persona: 'a detail-oriented analyst who adds depth and catches important nuances'
		},
		{
			name: 'Synthesizer',
			emoji: '🌐',
			persona:
				'a practical synthesizer who connects theory to real-world applications and examples'
		}
	]
};

export const AGENT_AVATAR_HUES = [285, 320, 200, 145, 40, 0] as const;
