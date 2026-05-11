import { streamAI, type DiscussionEntry, type Message } from '$lib/api';
import { abortableSleep } from '$lib/util';
import {
	AGENT_AVATAR_HUES,
	COLLABORATIVE_PHASES,
	DEBATE_POSITIONS,
	type Agent,
	type DiscussionMode
} from '$lib/chat/types';

export interface RunSessionParams {
	mode: DiscussionMode;
	topic: string;
	generations: number;
	agents: Agent[];
	signal: AbortSignal;
	onStatus: (s: string) => void;
	onEntries: (entries: DiscussionEntry[]) => void;
}

function hueFor(idx: number): number {
	return AGENT_AVATAR_HUES[idx % AGENT_AVATAR_HUES.length];
}

function entryFromAgent(
	agent: Agent,
	idx: number,
	response: string,
	extras?: { phase?: string; round?: number; position?: string }
): DiscussionEntry {
	return {
		participant: `${agent.emoji} ${agent.name}`,
		emoji: agent.emoji,
		avatarHue: hueFor(idx),
		model: agent.model,
		response,
		...extras
	};
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

export async function runSession(p: RunSessionParams): Promise<void> {
	const gens = Math.min(24, Math.max(1, Math.floor(p.generations)));
	switch (p.mode) {
		case 'roleplay':
			await runRoleplay(p, gens);
			return;
		case 'consensus':
			await runConsensus(p, gens);
			return;
		case 'brainstorm':
			await runBrainstorm(p, gens);
			return;
		case 'debate':
			await runDebate(p, gens);
			return;
		case 'collaborative':
			await runCollaborative(p);
			return;
	}
}

async function runRoleplay(p: RunSessionParams, rounds: number): Promise<void> {
	const entries: DiscussionEntry[] = [];

	for (let round = 1; round <= rounds; round++) {
		if (p.signal.aborted) break;

		for (let idx = 0; idx < p.agents.length; idx++) {
			if (p.signal.aborted) break;
			const agent = p.agents[idx];

			p.onStatus(`🎭 Round ${round} — ${agent.emoji} ${agent.name} is speaking…`);

			const previousDiscussion = entries
				.map((h) => `${h.participant}: ${h.response}`)
				.join('\n\n');

			const isFirst = round === 1 && idx === 0;
			const instruction = isFirst
				? `You are ${agent.persona}. We're discussing: ${p.topic}. Please start the roleplay discussion by sharing your perspective in character. Be engaging and true to your role.`
				: `You are ${agent.persona}. We're discussing: ${p.topic}. Here's what has been said so far:\n\n${previousDiscussion}\n\nPlease respond in character, building on the conversation while staying true to your role.`;

			const context: Message[] = [{ role: 'user', content: instruction }];

			entries.push(entryFromAgent(agent, idx, '', { round }));
			entries[entries.length - 1].streaming = true;
			p.onEntries([...entries]);

			await streamInto(entries, p, agent.model, agent.persona, context);

			await abortableSleep(150, p.signal);
		}
	}

	p.onStatus(p.signal.aborted ? '🛑 Generation stopped by user' : '🎭 Roleplay complete!');
}

async function runConsensus(p: RunSessionParams, facilitatorPasses: number): Promise<void> {
	const entries: DiscussionEntry[] = [];
	const passes = Math.min(8, Math.max(1, facilitatorPasses));
	const positions: string[] = [];

	p.onStatus('📍 Round 1: initial positions');

	for (let idx = 0; idx < p.agents.length; idx++) {
		if (p.signal.aborted) break;
		const agent = p.agents[idx];
		p.onStatus(`🤝 ${agent.emoji} ${agent.name} is presenting…`);

		const instruction = `You are ${agent.persona}. Present your initial viewpoint on: ${p.topic}. Be open to finding common ground with others.`;
		const context: Message[] = [{ role: 'user', content: instruction }];

		entries.push(entryFromAgent(agent, idx, '', { phase: 'Initial position' }));
		entries[entries.length - 1].streaming = true;
		p.onEntries([...entries]);

		const response = await streamInto(entries, p, agent.model, agent.persona, context);
		if (response) positions.push(`${agent.emoji} ${agent.name}: ${response}`);

		await abortableSleep(150, p.signal);
	}

	if (p.signal.aborted || positions.length === 0) {
		p.onStatus(p.signal.aborted ? '🛑 Generation stopped by user' : '⚠️ Incomplete consensus run.');
		return;
	}

	const facilitator = p.agents[0];
	let workingConsensus = '';

	for (let pass = 1; pass <= passes; pass++) {
		if (p.signal.aborted) break;
		p.onStatus(`🔍 Facilitator pass ${pass}/${passes}`);

		const instruction =
			pass === 1
				? `You are ${facilitator.persona}. Here are the initial positions on ${p.topic}:\n\n${positions.join('\n\n')}\n\nIdentify the common ground and propose a consensus that everyone can agree on.`
				: `You are ${facilitator.persona}. Topic: ${p.topic}.\n\nPrevious consensus draft:\n${workingConsensus}\n\nRefine and improve the consensus. Keep it practical and inclusive.`;

		const context: Message[] = [{ role: 'user', content: instruction }];

		entries.push({
			participant: '🕊️ Consensus',
			emoji: '🕊️',
			avatarHue: 200,
			model: facilitator.model,
			response: '',
			phase: passes > 1 ? `Consensus (pass ${pass})` : 'Final consensus',
			streaming: true
		});
		p.onEntries([...entries]);

		const consensus = await streamInto(
			entries,
			p,
			facilitator.model,
			facilitator.persona,
			context
		);
		if (consensus) workingConsensus = consensus;

		await abortableSleep(150, p.signal);
	}

	p.onStatus(p.signal.aborted ? '🛑 Generation stopped by user' : '🤝 Consensus complete!');
}

async function runBrainstorm(p: RunSessionParams, steps: number): Promise<void> {
	const entries: DiscussionEntry[] = [];
	const previousIdeas: string[] = [];

	for (let i = 0; i < steps; i++) {
		if (p.signal.aborted) break;
		const idx = i % p.agents.length;
		const agent = p.agents[idx];
		p.onStatus(`💡 Step ${i + 1}/${steps} — ${agent.emoji} ${agent.name} is brainstorming…`);

		const instruction =
			i === 0
				? `You are ${agent.persona}. Generate 3-5 creative, innovative ideas about: ${p.topic}. Think outside the box!`
				: `You are ${agent.persona}. Here are ideas generated so far:\n${previousIdeas.join('\n')}\n\nBuild on these ideas and generate 3-5 new creative concepts about: ${p.topic}. Be even more innovative!`;

		const context: Message[] = [{ role: 'user', content: instruction }];

		entries.push(entryFromAgent(agent, idx, ''));
		entries[entries.length - 1].streaming = true;
		p.onEntries([...entries]);

		const response = await streamInto(entries, p, agent.model, agent.persona, context);
		if (response) previousIdeas.push(`${agent.emoji} ${agent.name}: ${response}`);

		await abortableSleep(150, p.signal);
	}

	p.onStatus(p.signal.aborted ? '🛑 Generation stopped by user' : '💡 Brainstorm complete!');
}

async function runDebate(p: RunSessionParams, rounds: number): Promise<void> {
	const entries: DiscussionEntry[] = [];

	for (let roundNum = 0; roundNum < rounds; roundNum++) {
		if (p.signal.aborted) break;
		p.onStatus(`🔄 Debate round ${roundNum + 1}/${rounds}`);

		for (let idx = 0; idx < p.agents.length; idx++) {
			if (p.signal.aborted) break;
			const agent = p.agents[idx];
			const position = DEBATE_POSITIONS[idx % DEBATE_POSITIONS.length];

			p.onStatus(`⚔️ ${agent.emoji} ${agent.name} (${position}) is arguing…`);

			let instruction: string;
			if (roundNum === 0) {
				instruction = `You are ${agent.persona}. You ${position} ${p.topic}. Present your strongest arguments. Be persuasive and forceful!`;
			} else {
				const prevArgs = entries
					.filter((e) => e.participant !== `${agent.emoji} ${agent.name}`)
					.slice(-Math.max(2, p.agents.length - 1))
					.map((e) => e.response)
					.join('\n\n');
				instruction = `You are ${agent.persona}. You ${position} ${p.topic}. Counter these opposing arguments:\n\n${prevArgs}\n\nStrike back with devastating rebuttals!`;
			}

			const context: Message[] = [{ role: 'user', content: instruction }];

			entries.push(
				entryFromAgent(agent, idx, '', {
					round: roundNum + 1,
					position
				})
			);
			entries[entries.length - 1].streaming = true;
			p.onEntries([...entries]);

			await streamInto(entries, p, agent.model, agent.persona, context);

			await abortableSleep(150, p.signal);
		}
	}

	p.onStatus(p.signal.aborted ? '🛑 Generation stopped by user' : '⚔️ Debate complete!');
}

async function runCollaborative(p: RunSessionParams): Promise<void> {
	const entries: DiscussionEntry[] = [];
	const responses: string[] = [];
	const phases = COLLABORATIVE_PHASES;
	const agents = p.agents.slice(0, 3);

	for (let i = 0; i < phases.length; i++) {
		if (p.signal.aborted) break;
		const agent = agents[i] ?? agents[agents.length - 1];
		const phase = phases[i];
		p.onStatus(`🧠 ${phase}…`);

		let instruction: string;
		if (i === 0) {
			instruction = `You are ${agent.persona}. Please provide a clear, comprehensive explanation of: ${p.topic}. Be educational and thorough.`;
		} else if (i === 1) {
			instruction = `You are ${agent.persona}. The Educator just explained: '${responses[0]}'. Please build on their explanation, add important details they might have missed, and provide additional insights about ${p.topic}. Be collaborative and educational.`;
		} else {
			const fullDiscussion = `Educator explained: ${responses[0]}\n\nAnalyst added: ${responses[1]}`;
			instruction = `You are ${agent.persona}. Here's what has been discussed so far about ${p.topic}:\n\n${fullDiscussion}\n\nPlease synthesize these perspectives, add any practical examples or real-world applications, and provide a concluding insight that ties everything together.`;
		}

		const context: Message[] = [{ role: 'user', content: instruction }];

		entries.push(entryFromAgent(agent, i, '', { phase }));
		entries[entries.length - 1].streaming = true;
		p.onEntries([...entries]);

		const response = await streamInto(entries, p, agent.model, agent.persona, context);
		if (response) responses.push(response);

		await abortableSleep(150, p.signal);
	}

	p.onStatus(
		p.signal.aborted ? '🛑 Generation stopped by user' : '🧠 Collaborative discussion complete!'
	);
}
