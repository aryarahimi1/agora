import { streamAI, type DiscussionEntry, type Message } from '$lib/api';
import { abortableSleep } from '$lib/util';
import { chooseNextSpeaker } from '$lib/chat/moderator';
import { AGENT_AVATAR_HUES, type Agent, type DiscussionMode } from '$lib/chat/types';

export interface RunSessionParams {
	mode: DiscussionMode;
	topic: string;
	/** Total agent-turn budget. Moderator may end the run sooner. */
	generations: number;
	agents: Agent[];
	signal: AbortSignal;
	onStatus: (s: string) => void;
	onEntries: (entries: DiscussionEntry[]) => void;
}

const MIN_BUDGET = 2;
const MAX_BUDGET = 24;
/** The moderator can't end the discussion before at least this many agent turns. */
const MIN_TURNS_BEFORE_DONE = 2;
const MODERATOR_HUE = 60;

function hueFor(idx: number): number {
	return AGENT_AVATAR_HUES[idx % AGENT_AVATAR_HUES.length];
}

function agentIndex(agents: Agent[], id: string): number {
	const i = agents.findIndex((a) => a.id === id);
	return i < 0 ? 0 : i;
}

function moderatorEntry(text: string): DiscussionEntry {
	return {
		kind: 'moderator',
		participant: 'Moderator',
		emoji: '◌',
		avatarHue: MODERATOR_HUE,
		model: 'moderator',
		response: text,
		moderatorInstruction: text
	};
}

function agentPlaceholder(agent: Agent, idx: number): DiscussionEntry {
	return {
		kind: 'agent',
		participant: `${agent.emoji} ${agent.name}`,
		emoji: agent.emoji,
		avatarHue: hueFor(idx),
		model: agent.model,
		response: '',
		streaming: true
	};
}

function buildAgentContext(args: {
	topic: string;
	agent: Agent;
	entries: DiscussionEntry[];
	instruction: string;
	mode: DiscussionMode;
}): Message[] {
	const transcript = args.entries
		.filter((e) => e.kind !== 'moderator')
		.map((e) => `${e.participant}: ${e.response}`)
		.join('\n\n');

	const sections: string[] = [
		`You are ${args.agent.persona}.`,
		`Discussion topic: ${args.topic}`,
		`Mode: ${args.mode}.`
	];

	if (transcript) {
		sections.push(`Conversation so far:\n${transcript}`);
	} else {
		sections.push('You are speaking first. Open the discussion in character.');
	}

	if (args.instruction) {
		sections.push(`Moderator's directive for you this turn: ${args.instruction}`);
	}

	sections.push(
		'Respond now in your own voice. Be substantive, not performative. Do not restate the moderator directive.'
	);

	return [{ role: 'user', content: sections.join('\n\n') }];
}

async function streamInto(
	entries: DiscussionEntry[],
	p: RunSessionParams,
	model: string,
	persona: string,
	context: Message[]
): Promise<string> {
	const placeholder = entries[entries.length - 1];
	const response = await streamAI(model, persona, context, {
		signal: p.signal,
		onChunk: (delta) => {
			placeholder.response += delta;
			p.onEntries([...entries]);
		}
	});
	placeholder.streaming = false;
	p.onEntries([...entries]);
	return response;
}

/**
 * Run an agent discussion using a moderator-routed loop. The moderator (a
 * small, cheap model) picks who speaks next after every turn and decides
 * when the discussion has nothing useful left to add. The mode parameter
 * informs the moderator's routing bias but no longer controls turn order.
 */
export async function runSession(p: RunSessionParams): Promise<void> {
	const budget = Math.min(MAX_BUDGET, Math.max(MIN_BUDGET, Math.floor(p.generations)));
	const entries: DiscussionEntry[] = [];
	let turnsTaken = 0;

	while (turnsTaken < budget) {
		if (p.signal.aborted) break;

		p.onStatus(`◌ Moderator is choosing the next speaker…`);

		const choice = await chooseNextSpeaker({
			topic: p.topic,
			mode: p.mode,
			agents: p.agents,
			entries,
			budgetTotal: budget,
			turnsTaken
		});

		if (p.signal.aborted) break;

		const allowDone = turnsTaken >= MIN_TURNS_BEFORE_DONE;
		if (choice.done && allowDone) {
			entries.push(
				moderatorEntry(choice.reason ? `Discussion complete — ${choice.reason}.` : 'Discussion complete.')
			);
			p.onEntries([...entries]);
			break;
		}

		const speaker =
			(choice.speakerId && p.agents.find((a) => a.id === choice.speakerId)) ?? p.agents[0];
		if (!speaker) break;

		const instruction =
			choice.instruction ||
			(turnsTaken === 0 ? 'Open the discussion.' : 'Add something new.');

		entries.push(moderatorEntry(`→ ${speaker.name}: ${instruction}`));
		p.onEntries([...entries]);

		await abortableSleep(120, p.signal);
		if (p.signal.aborted) break;

		const idx = agentIndex(p.agents, speaker.id);
		p.onStatus(`${speaker.emoji} ${speaker.name} is speaking…`);

		entries.push(agentPlaceholder(speaker, idx));
		p.onEntries([...entries]);

		const context = buildAgentContext({
			topic: p.topic,
			agent: speaker,
			entries: entries.slice(0, -1),
			instruction,
			mode: p.mode
		});

		await streamInto(entries, p, speaker.model, speaker.persona, context);
		turnsTaken += 1;

		await abortableSleep(150, p.signal);
	}

	if (p.signal.aborted) {
		p.onStatus('🛑 Stopped');
		return;
	}

	if (turnsTaken >= budget) {
		entries.push(moderatorEntry('Budget reached — wrapping up.'));
		p.onEntries([...entries]);
	}

	p.onStatus('✓ Discussion complete');
}
