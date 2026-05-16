<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import ChatMessages from '$lib/components/ChatMessages.svelte';
	import AgentsSheet from '$lib/components/AgentsSheet.svelte';
	import SelectModelsDialog from '$lib/components/SelectModelsDialog.svelte';
	import {
		activeChat,
		workspace,
		bumpTitleFromTopic,
		patchActiveChat,
		setChatEntries,
		switchMode,
		addAgent,
		removeAgent,
		updateAgent,
		resetAgentsToDefaults
	} from '$lib/chat/workspace.svelte';
	import { MODE_META, type Agent, type DiscussionMode } from '$lib/chat/types';
	import { loadOpenRouterModels, type ModelOption } from '$lib/chat/modelsCatalog';
	import { runSession } from '$lib/chat/runSession';
	import { NO_KEY_SENTINEL } from '$lib/apiErrors';
	import { auth } from '$lib/auth/auth.svelte';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { toast } from 'svelte-sonner';
	import {
		AlertCircleIcon,
		ChevronsUpDownIcon,
		SquareIcon,
		SendHorizontalIcon,
		Loader2Icon,
		CheckIcon,
		SparklesIcon,
		SlidersHorizontalIcon
	} from '@lucide/svelte';
	import { getComposerMode, setComposerMode, planAuto } from '$lib/chat/composerMode.svelte';
	import { providerColor } from '$lib/chat/modelMeta';

	let catalog = $state<ModelOption[]>([]);
	let isRunning = $state(false);
	let runController: AbortController | null = $state(null);
	let currentStatus = $state('');
	/** Secondary line for errors only, never raw exception text. */
	let statusSubtitle = $state('');
	let agentsOpen = $state(false);
	let modeOpen = $state(false);
	let modelsOpen = $state(false);

	const chat = $derived(activeChat());
	const meta = $derived(chat ? MODE_META[chat.mode] : null);
	const composer = $derived(chat ? getComposerMode(chat.id) : 'manual');
	const uniqueProviderColors = $derived.by(() => {
		if (!chat) return [] as string[];
		const seen = new Set<string>();
		const out: string[] = [];
		for (const a of chat.agents) {
			const c = providerColor(a.model);
			if (seen.has(c)) continue;
			seen.add(c);
			out.push(c);
			if (out.length >= 4) break;
		}
		return out;
	});

	function isDiscussionMode(x: string | null): x is DiscussionMode {
		return x !== null && Object.prototype.hasOwnProperty.call(MODE_META, x);
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const m = params.get('mode');
		if (isDiscussionMode(m)) {
			switchMode(m);
		}
		if (params.toString()) {
			history.replaceState(history.state, '', '/workspace');
		}

		let alive = true;
		loadOpenRouterModels().then((rows) => {
			if (alive) catalog = rows;
		});
		return () => {
			alive = false;
		};
	});

	const LENGTH_OPTIONS = [
		{ id: 'short', label: 'Short', budget: 6, hint: 'A quick exchange.' },
		{ id: 'standard', label: 'Standard', budget: 12, hint: 'A full discussion.' },
		{ id: 'deep', label: 'Deep', budget: 20, hint: 'Long-form, multiple passes.' }
	] as const;

	type LengthId = (typeof LENGTH_OPTIONS)[number]['id'];

	function clampBudget(n: number): number {
		const x = Number.isFinite(n) ? Math.floor(n) : 12;
		return Math.min(24, Math.max(2, x));
	}

	function lengthFromBudget(n: number): LengthId {
		if (n <= 8) return 'short';
		if (n <= 14) return 'standard';
		return 'deep';
	}

	function setLength(id: LengthId): void {
		const c = activeChat();
		if (!c || isRunning) return;
		const next = LENGTH_OPTIONS.find((o) => o.id === id);
		if (!next || c.generations === next.budget) return;
		void patchActiveChat({ generations: next.budget });
	}

	function pickMode(next: DiscussionMode): void {
		modeOpen = false;
		const cur = activeChat();
		if (!cur || cur.mode === next) return;
		switchMode(next);
	}

	const isErrorStatus = $derived(
		!!statusSubtitle || currentStatus.includes('Error') || currentStatus.includes('❌')
	);

	function showNoKeyToast(): void {
		toast.error('Add your OpenRouter key in Account settings to run discussions.', {
			action: {
				label: 'Go to settings',
				onClick: () => goto('/account')
			}
		});
	}

	function applyPanel(next: { mode: DiscussionMode; agents: Agent[]; generations: number }): void {
		void patchActiveChat({
			mode: next.mode,
			agents: next.agents,
			generations: clampBudget(next.generations)
		});
	}

	async function onRun(): Promise<void> {
		const c = activeChat();
		if (!c || !c.draftTopic.trim() || isRunning) return;

		if (auth.user?.openrouter_key_set === false) {
			showNoKeyToast();
			return;
		}

		let runMode: DiscussionMode = c.mode;
		let runAgents: Agent[] = c.agents;
		let runGenerations: number = c.generations;
		if (getComposerMode(c.id) === 'auto') {
			const plan = planAuto(c.draftTopic, catalog);
			runMode = plan.mode;
			runAgents = plan.agents;
			runGenerations = clampBudget(plan.budget);
			await patchActiveChat({ mode: runMode, agents: runAgents, generations: runGenerations });
		}

		const runChatId = c.id;
		const controller = new AbortController();
		runController = controller;
		isRunning = true;
		statusSubtitle = '';
		currentStatus = 'Starting.';
		setChatEntries(runChatId, []);
		bumpTitleFromTopic(runChatId, c.draftTopic);

		try {
			await runSession({
				mode: runMode,
				topic: c.draftTopic.trim(),
				generations: clampBudget(runGenerations),
				agents: runAgents,
				signal: controller.signal,
				onStatus: (s) => {
					currentStatus = s;
				},
				onEntries: (entries) => {
					if (workspace.activeChatId === runChatId) {
						setChatEntries(runChatId, entries);
						// Detect a no-key error surfaced in the transcript.
						const last = entries[entries.length - 1];
						if (last?.response?.includes(NO_KEY_SENTINEL)) {
							showNoKeyToast();
						}
					}
				}
			});
		} catch {
			currentStatus = 'Something went wrong';
			statusSubtitle =
				'We could not finish this session. Please try again in a moment.';
		} finally {
			isRunning = false;
			runController = null;
		}
	}

	function onStop(): void {
		runController?.abort();
		currentStatus = 'Stopping.';
	}

	function onTopicKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void onRun();
		}
	}

	function applySuggestion(topic: string): void {
		patchActiveChat({ draftTopic: topic });
	}
</script>

{#if !chat || !meta}
	<div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center text-sm">
		<p>No active chat.</p>
		<p class="text-muted-foreground/80">Create one from the sidebar.</p>
	</div>
{:else}
	<div class="flex min-h-0 flex-1 flex-col">
		<header class="border-border/60 shrink-0 border-b pt-7 pb-5">
			<div class="flex items-baseline gap-2.5">
				<span
					class={cn('inline-block size-[7px] translate-y-[-2px] rounded-full', meta.gradientClass)}
					aria-hidden="true"
				></span>
				<h1 class="font-display text-foreground text-[22px] font-semibold leading-none tracking-[-0.012em]">
					{meta.label}
				</h1>
				<span class="text-muted-foreground/85 ml-auto shrink-0 font-mono text-[11px] tabular-nums">
					{chat.agents.length} {chat.agents.length === 1 ? 'agent' : 'agents'} · up to {chat.generations} turns
				</span>
			</div>
			<p class="text-muted-foreground mt-2 text-[13px] leading-relaxed">
				{meta.hint}
			</p>
		</header>

		{#if currentStatus}
			<div
				class={cn(
					'mt-3 flex shrink-0 items-baseline gap-2 rounded-md px-3 py-2 text-[12.5px]',
					isErrorStatus
						? 'bg-destructive/8 text-destructive border-destructive/25 border'
						: 'text-muted-foreground bg-muted/55'
				)}
				role="status"
				aria-live="polite"
			>
				{#if isRunning}
					<Loader2Icon class="translate-y-[2px] size-3.5 shrink-0 animate-spin opacity-70" />
				{:else if isErrorStatus}
					<AlertCircleIcon class="translate-y-[2px] size-3.5 shrink-0" />
				{/if}
				<div class="flex min-w-0 flex-col leading-snug">
					<span class="truncate">{currentStatus}</span>
					{#if statusSubtitle}
						<span class="text-[12px] opacity-80">{statusSubtitle}</span>
					{/if}
				</div>
			</div>
		{/if}

		<div class="flex min-h-0 flex-1 flex-col">
			{#if chat.entries.length === 0}
				<div class="flex flex-1 flex-col items-center justify-center gap-6 py-14 text-center">
					<div class="max-w-[28rem]">
						<p class="font-display text-foreground text-[24px] leading-tight tracking-[-0.012em]">
							What should they discuss?
						</p>
						<p class="text-muted-foreground mt-3 text-[14px] leading-relaxed">
							A topic, a question, a provocation. The {meta.label.toLowerCase()} will read it together, then take turns.
						</p>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<span class="text-muted-foreground/75 text-[10px] font-semibold tracking-[0.16em] uppercase">
							Try
						</span>
						<div class="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
							{#each ['Pros and cons of remote work', 'Pitch a climate startup in three sentences', 'Explain quantum computing to a teenager'] as suggestion (suggestion)}
								<button
									type="button"
									class="font-display text-foreground/85 hover:text-primary text-[14px] italic underline decoration-border decoration-[0.5px] underline-offset-[5px] transition-colors hover:decoration-primary/60"
									onclick={() => applySuggestion(suggestion)}
								>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{:else}
				<div data-chat-scroll class="min-h-0 flex-1 overflow-y-auto">
					<ChatMessages entries={chat.entries} />
				</div>
			{/if}
		</div>

		<!-- Composer -->
		<div class="shrink-0 pt-4 pb-5">
			<div class="composer focus-within:border-primary/40 focus-within:ring-primary/15 rounded-lg border focus-within:ring-2">
				<label class="sr-only" for="workspace-topic">Topic</label>
				<Textarea
					id="workspace-topic"
					rows={3}
					disabled={isRunning}
					value={chat.draftTopic}
					oninput={(e) => patchActiveChat({ draftTopic: e.currentTarget.value })}
					onkeydown={onTopicKeydown}
					placeholder="What should the agents discuss?"
					class="placeholder:text-muted-foreground/70 font-display resize-none border-0 bg-transparent px-3.5 py-3 text-[15.5px] leading-relaxed shadow-none focus-visible:ring-0"
				/>

				<div class="border-border/60 flex flex-wrap items-center gap-x-1 gap-y-1.5 border-t px-2 py-2">
					<!-- Auto / Manual segmented toggle -->
					<div class="bg-muted/55 ring-border/55 inline-flex h-8 items-center rounded-md p-0.5 ring-1 ring-inset">
						<button
							type="button"
							disabled={isRunning}
							onclick={() => setComposerMode(chat.id, 'auto')}
							class={cn(
								'inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] font-medium transition-colors disabled:opacity-60',
								composer === 'auto'
									? 'bg-popover text-foreground shadow-[0_1px_0_oklch(0.84_0.012_70_/_0.6)]'
									: 'text-muted-foreground hover:text-foreground'
							)}
							aria-pressed={composer === 'auto'}
						>
							<SparklesIcon class="size-3.5" />
							Auto
						</button>
						<button
							type="button"
							disabled={isRunning}
							onclick={() => setComposerMode(chat.id, 'manual')}
							class={cn(
								'inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] font-medium transition-colors disabled:opacity-60',
								composer === 'manual'
									? 'bg-popover text-foreground shadow-[0_1px_0_oklch(0.84_0.012_70_/_0.6)]'
									: 'text-muted-foreground hover:text-foreground'
							)}
							aria-pressed={composer === 'manual'}
						>
							<SlidersHorizontalIcon class="size-3.5" />
							Manual
						</button>
					</div>

					{#if composer === 'auto'}
						<span class="text-muted-foreground/85 ml-1 inline-flex items-center gap-1.5 text-[12px] leading-none">
							<span class="font-display italic">
								Agora picks the mode, models, and panel.
							</span>
						</span>
					{:else}
						<!-- Mode -->
						<Popover.Root bind:open={modeOpen}>
							<Popover.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										type="button"
										disabled={isRunning}
										class="text-foreground/90 hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium transition-colors disabled:opacity-60"
										aria-label="Discussion mode"
									>
										<span
											class={cn('size-[6px] rounded-full', meta.gradientClass)}
											aria-hidden="true"
										></span>
										{meta.label}
										<ChevronsUpDownIcon class="text-muted-foreground/70 size-3" />
									</button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content class="w-80 p-0" align="start">
								<Command.Root>
									<Command.Input placeholder="Search modes" />
									<Command.List>
										<Command.Empty>No mode found.</Command.Empty>
										<Command.Group heading="Modes">
											{#each Object.entries(MODE_META) as [id, m] (id)}
												<Command.Item
													value={`${m.label} ${id}`}
													onSelect={() => pickMode(id as DiscussionMode)}
												>
													<CheckIcon
														class={cn(
															'size-4',
															id === chat.mode ? 'opacity-100' : 'opacity-0'
														)}
														data-icon="inline-start"
													/>
													<div class="flex flex-col gap-0.5">
														<span class="font-display text-[14px] font-medium">{m.label}</span>
														<span class="text-muted-foreground text-[12px] leading-snug">{m.hint}</span>
													</div>
												</Command.Item>
											{/each}
										</Command.Group>
									</Command.List>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>

						<!-- Models pill -->
						<button
							type="button"
							disabled={isRunning}
							onclick={() => (modelsOpen = true)}
							class="text-foreground/90 hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium transition-colors disabled:opacity-60"
							aria-label="Choose models and panel"
						>
							Models
							<span class="flex items-center -space-x-1" aria-hidden="true">
								{#each uniqueProviderColors as c, i (i)}
									<span
										class="ring-popover inline-block size-[10px] rounded-full ring-2"
										style={`background:${c}`}
									></span>
								{/each}
							</span>
							<span class="text-muted-foreground/85 font-mono tabular-nums text-[11px]">
								{chat.agents.length}
							</span>
						</button>

						<!-- Length budget pill -->
						{@const activeLength = lengthFromBudget(chat.generations)}
						<div
							class="bg-muted/55 ring-border/55 inline-flex h-8 items-center rounded-md p-0.5 ring-1 ring-inset"
							role="group"
							aria-label="Discussion length"
						>
							{#each LENGTH_OPTIONS as opt (opt.id)}
								<button
									type="button"
									disabled={isRunning}
									onclick={() => setLength(opt.id)}
									title={`${opt.hint} Up to ${opt.budget} turns.`}
									class={cn(
										'inline-flex h-7 items-center rounded-[5px] px-2.5 text-[12px] font-medium transition-colors disabled:opacity-60',
										activeLength === opt.id
											? 'bg-popover text-foreground shadow-[0_1px_0_oklch(0.84_0.012_70_/_0.6)]'
											: 'text-muted-foreground hover:text-foreground'
									)}
									aria-pressed={activeLength === opt.id}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					{/if}

					<span class="flex-1"></span>

					{#if isRunning}
						<button
							type="button"
							onclick={onStop}
							class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors"
						>
							<SquareIcon class="size-3" />
							Stop
						</button>
					{/if}

					<button
						type="button"
						disabled={isRunning || !chat.draftTopic.trim()}
						onclick={() => void onRun()}
						class="bg-primary text-primary-foreground hover:bg-primary/92 inline-flex h-9 items-center gap-2 rounded-md px-5 text-[13px] font-semibold tracking-[0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
					>
						{#if isRunning}
							<Loader2Icon class="size-3.5 animate-spin" />
							Running
						{:else}
							Send
							<SendHorizontalIcon class="size-3.5" />
						{/if}
					</button>
				</div>
			</div>
			<div class="mt-2 flex items-center gap-3 pl-1">
				<p class="text-muted-foreground/70 text-[11px]">
					Press <kbd class="font-mono text-[10.5px]">Enter</kbd> to send, <kbd class="font-mono text-[10.5px]">Shift+Enter</kbd> for a new line.
				</p>
				{#if composer === 'manual'}
					<button
						type="button"
						disabled={isRunning}
						onclick={() => (agentsOpen = true)}
						class="text-muted-foreground/70 hover:text-foreground/85 ml-auto text-[11px] underline decoration-border decoration-[0.5px] underline-offset-[4px] transition-colors disabled:opacity-60"
					>
						Edit personas
					</button>
				{/if}
			</div>
		</div>
	</div>

	<AgentsSheet
		bind:open={agentsOpen}
		agents={chat.agents}
		mode={chat.mode}
		{catalog}
		disabled={isRunning}
		onAdd={addAgent}
		onRemove={removeAgent}
		onUpdate={updateAgent}
		onReset={resetAgentsToDefaults}
	/>

	<SelectModelsDialog
		open={modelsOpen}
		mode={chat.mode}
		agents={chat.agents}
		generations={chat.generations}
		{catalog}
		onApply={applyPanel}
		onOpenChange={(v) => (modelsOpen = v)}
	/>
{/if}

<style>
	.composer {
		background: var(--card);
		border-color: var(--border);
		transition: border-color 160ms ease, box-shadow 160ms ease;
	}
</style>
