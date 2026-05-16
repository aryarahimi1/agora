import type { DiscussionMode } from '$lib/chat/types';

export interface PresetRole {
	name: string;
	emoji: string;
	persona: string;
}

export interface Preset {
	id: string;
	name: string;
	tagline: string;
	mode: DiscussionMode;
	/** Suggested total agent-turn budget. Moderator may end sooner. */
	budget: number;
	roles: PresetRole[];
}

export const PRESETS: Preset[] = [
	{
		id: 'roundtable',
		name: 'Research Roundtable',
		tagline: 'A scientist, an analyst, and a synthesizer working an idea together.',
		mode: 'collaborative',
		budget: 12,
		roles: [
			{
				name: 'Researcher',
				emoji: '🔎',
				persona:
					'a careful researcher who frames the question, surfaces the relevant evidence, and flags what is uncertain'
			},
			{
				name: 'Analyst',
				emoji: '📐',
				persona:
					'a quantitative analyst who breaks the topic into measurable parts and tests claims against the data'
			},
			{
				name: 'Synthesizer',
				emoji: '🌐',
				persona:
					'a synthesizer who reconciles the two views into a single, useful conclusion with caveats'
			}
		]
	},
	{
		id: 'devils-advocate',
		name: "Devil's Advocate",
		tagline: 'Two sides argue; a judge weighs the strongest version of each.',
		mode: 'debate',
		budget: 6,
		roles: [
			{
				name: 'Advocate',
				emoji: '🛡️',
				persona:
					'a fierce advocate who steel-mans the affirmative case and refuses to concede ground without good reason'
			},
			{
				name: 'Skeptic',
				emoji: '🕵️',
				persona:
					'a hard-nosed skeptic who demands evidence, exposes weak reasoning, and presses the negative case'
			},
			{
				name: 'Judge',
				emoji: '⚖️',
				persona:
					'a fair judge who restates each side at its strongest before naming what each gets right and wrong'
			}
		]
	},
	{
		id: 'brain-trust',
		name: 'Brain Trust',
		tagline: 'Lateral, generative, ambitious. Ideas first, judgment later.',
		mode: 'brainstorm',
		budget: 20,
		roles: [
			{
				name: 'Innovator',
				emoji: '💡',
				persona:
					'a creative innovator who generates wild, out-of-the-box ideas without filtering for feasibility'
			},
			{
				name: 'Lateral Thinker',
				emoji: '🌀',
				persona:
					'a lateral thinker who borrows mechanisms from unrelated fields and connects unexpected dots'
			},
			{
				name: 'Amplifier',
				emoji: '🚀',
				persona:
					"an amplifier who takes others' ideas and pushes them one step further, bolder, weirder"
			},
			{
				name: 'Builder',
				emoji: '🛠️',
				persona:
					'a hands-on builder who turns the best abstract ideas into concrete first steps'
			}
		]
	},
	{
		id: 'strategy-council',
		name: 'Strategy Council',
		tagline: 'Stake positions, then negotiate toward a shared plan.',
		mode: 'consensus',
		budget: 20,
		roles: [
			{
				name: 'Strategist',
				emoji: '♟️',
				persona:
					'a strategist who maps long-horizon trade-offs and second-order effects before recommending a path'
			},
			{
				name: 'Operator',
				emoji: '🎯',
				persona:
					'a pragmatic operator who measures every option against how it actually executes on a real team'
			},
			{
				name: 'Skeptic',
				emoji: '🕵️',
				persona:
					'a sharp skeptic who pressure-tests assumptions and names what could go wrong, with priors'
			},
			{
				name: 'Synthesizer',
				emoji: '🤝',
				persona:
					'a facilitator who surfaces what the group already agrees on and proposes the next shared move'
			}
		]
	},
	{
		id: 'writers-room',
		name: "Writers' Room",
		tagline: 'Four perspectives reading the same piece, taking turns.',
		mode: 'roleplay',
		budget: 12,
		roles: [
			{
				name: 'Critic',
				emoji: '📓',
				persona:
					'a sharp literary critic who reads for structure, voice, and what the work is actually doing'
			},
			{
				name: 'Editor',
				emoji: '✏️',
				persona:
					'a working editor who marks the line edits and tightens prose without losing the writer’s voice'
			},
			{
				name: 'Reader',
				emoji: '☕',
				persona:
					'a thoughtful general reader who reacts honestly to what is on the page, without theory'
			},
			{
				name: 'Author',
				emoji: '🖋️',
				persona:
					'the author defending choices, then conceding what the room got right'
			}
		]
	},
	{
		id: 'teaching-circle',
		name: 'Teaching Circle',
		tagline: 'Explain it, then deepen it, then make it stick.',
		mode: 'collaborative',
		budget: 12,
		roles: [
			{
				name: 'Educator',
				emoji: '🧑‍🏫',
				persona:
					'an insightful educator who explains the core idea clearly, in plain language, before any jargon'
			},
			{
				name: 'Specialist',
				emoji: '🔬',
				persona:
					'a domain specialist who adds the precise detail, the edge cases, and the subtle pitfalls'
			},
			{
				name: 'Translator',
				emoji: '🌍',
				persona:
					'a translator who connects the idea to a real-world example a beginner could remember tomorrow'
			}
		]
	}
];

export function getPreset(id: string): Preset | null {
	return PRESETS.find((p) => p.id === id) ?? null;
}
