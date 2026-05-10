<script lang="ts">
	import { onMount } from 'svelte';
	import ChatMessages from '$lib/components/ChatMessages.svelte';
	import AgentsSheet from '$lib/components/AgentsSheet.svelte';
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
	import { MODE_META, type DiscussionMode } from '$lib/chat/types';
	import { loadOpenRouterModels, type ModelOption } from '$lib/chat/modelsCatalog';
	import { runSession } from '$lib/chat/runSession';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import {
		AlertCircleIcon,
		ChevronsUpDownIcon,
		UsersIcon,
		MinusIcon,
		PlusIcon,
		SquareIcon,
		SendHorizontalIcon,
		Loader2Icon,
		SparklesIcon,
		CheckIcon
	} from '@lucide/svelte';

	let catalog = $state<ModelOption[]>([]);
	let isRunning = $state(false);
	let runController: AbortController | null = $state(null);
	let currentStatus = $state('');
	/** Secondary line for errors only — never raw exception text. */
	let statusSubtitle = $state('');
	let agentsOpen = $state(false);
	let modeOpen = $state(false);

	const chat = $derived(activeChat());
	const meta = $derived(chat ? MODE_META[chat.mode] : null);

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

	function maxGenForMode(mode: DiscussionMode): number {
		return mode === 'collaborative' ? 3 : 24;
	}

	function clampGen(mode: DiscussionMode, n: number): number {
		const x = Number.isFinite(n) ? Math.floor(n) : 3;
		return Math.min(maxGenForMode(mode), Math.max(1, x));
	}

	function bumpGen(delta: number): void {
		const c = activeChat();
		if (!c || isRunning) return;
		patchActiveChat({ generations: clampGen(c.mode, c.generations + delta) });
	}

	function pickMode(next: DiscussionMode): void {
		modeOpen = false;
		const cur = activeChat();
		if (!cur || cur.mode === next) return;
		switchMode(next);
		patchActiveChat({
			generations: clampGen(next, cur.generations)
		});
	}

	const isErrorStatus = $derived(
		!!statusSubtitle || currentStatus.includes('Error') || currentStatus.includes('❌')
	);

	async function onRun(): Promise<void> {
		const c = activeChat();
		if (!c || !c.draftTopic.trim() || isRunning) return;

		const runChatId = c.id;
		const controller = new AbortController();
		runController = controller;
		isRunning = true;
		statusSubtitle = '';
		currentStatus = 'Starting…';
		setChatEntries(runChatId, []);
		bumpTitleFromTopic(runChatId, c.draftTopic);

		try {
			await runSession({
				mode: c.mode,
				topic: c.draftTopic.trim(),
				generations: clampGen(c.mode, c.generations),
				agents: c.agents,
				signal: controller.signal,
				onStatus: (s) => {
					currentStatus = s;
				},
				onEntries: (entries) => {
					if (workspace.activeChatId === runChatId) {
						setChatEntries(runChatId, entries);
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
		currentStatus = '🛑 Stopping…';
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
		<header class="shrink-0 pt-5 pb-3">
			<div class="flex items-center gap-3">
				<span
					class={cn(
						'mode-chip grid size-7 shrink-0 place-items-center rounded-lg text-sm shadow-sm',
						meta.gradientClass
					)}
					aria-hidden="true"
				>
					{meta.emoji}
				</span>
				<h1 class="text-foreground text-[15px] font-semibold tracking-tight">
					{meta.label}
				</h1>
				<span class="text-muted-foreground/80 text-[13px] leading-snug truncate hidden sm:inline">
					{meta.hint}
				</span>
				<span class="text-muted-foreground/80 ml-auto shrink-0 text-[11px] tabular-nums">
					{chat.agents.length} agents · {chat.generations}/{maxGenForMode(chat.mode)} gen
				</span>
			</div>
		</header>

		{#if currentStatus}
			<div
				class={cn(
					'status-row flex shrink-0 items-start gap-2 rounded-lg px-3 py-2 text-[13px]',
					isErrorStatus
						? 'bg-destructive/10 text-destructive-foreground/95'
						: 'text-muted-foreground/95 bg-muted/40'
				)}
				role="status"
				aria-live="polite"
			>
				{#if isRunning}
					<Loader2Icon class="mt-[3px] size-3.5 shrink-0 animate-spin opacity-80" />
				{:else if isErrorStatus}
					<AlertCircleIcon class="mt-[3px] size-3.5 shrink-0" />
				{:else}
					<SparklesIcon class="mt-[3px] size-3.5 shrink-0 opacity-80" />
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
				<div class="flex flex-1 flex-col items-center justify-center gap-7 py-10">
					<div
						class={cn(
							'mode-chip grid size-14 place-items-center rounded-2xl text-[28px] shadow-lg',
							meta.gradientClass
						)}
						aria-hidden="true"
					>
						{meta.emoji}
					</div>
					<div class="max-w-md text-center">
						<p class="text-foreground text-[17px] font-semibold tracking-tight">
							What should they discuss?
						</p>
						<p class="text-muted-foreground mt-1.5 text-[13.5px] leading-relaxed">
							Drop a topic below. {meta.label.toLowerCase()} agents will stream their responses here as they think.
						</p>
					</div>
					<div class="flex flex-wrap justify-center gap-1.5">
						{#each ['Pros and cons of remote work', 'Pitch a climate startup in 3 sentences', 'Explain quantum computing to a teenager'] as suggestion (suggestion)}
							<button
								type="button"
								class="suggestion text-foreground/85 hover:text-foreground border-border/70 hover:border-border bg-muted/30 hover:bg-muted/55 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors"
								onclick={() => applySuggestion(suggestion)}
							>
								{suggestion}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<div data-chat-scroll class="min-h-0 flex-1 overflow-y-auto scroll-smooth">
					<ChatMessages entries={chat.entries} />
				</div>
			{/if}
		</div>

		<!-- Composer -->
		<div class="from-background via-background pointer-events-none shrink-0 bg-gradient-to-t to-transparent pt-5 pb-5 [&>*]:pointer-events-auto">
			<div class="composer focus-within:ring-ring/35 rounded-2xl p-2.5 focus-within:ring-2">
				<label class="sr-only" for="workspace-topic">Topic</label>
				<Textarea
					id="workspace-topic"
					rows={3}
					disabled={isRunning}
					value={chat.draftTopic}
					oninput={(e) => patchActiveChat({ draftTopic: e.currentTarget.value })}
					onkeydown={onTopicKeydown}
					placeholder="What should the agents discuss?"
					class="placeholder:text-muted-foreground/65 border-0 bg-transparent px-1.5 py-1.5 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
				/>

				<div class="flex flex-wrap items-center gap-1.5 pt-1.5">
					<!-- Mode -->
					<Popover.Root bind:open={modeOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									disabled={isRunning}
									class="mode-pill text-foreground/95 hover:bg-muted/55 inline-flex h-8 items-center gap-1.5 rounded-full pr-2.5 pl-1 text-[12.5px] font-medium transition-colors disabled:opacity-60"
									aria-label="Discussion mode"
								>
									<span
										class={cn(
											'mode-chip grid size-6 place-items-center rounded-full text-[12px] shadow-sm',
											meta.gradientClass
										)}
										aria-hidden="true"
									>
										{meta.emoji}
									</span>
									{meta.label}
									<ChevronsUpDownIcon class="text-muted-foreground/80 size-3.5" />
								</button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-80 p-0" align="start">
							<Command.Root>
								<Command.Input placeholder="Search modes…" />
								<Command.List>
									<Command.Empty>No mode found.</Command.Empty>
									<Command.Group heading="Modes">
										{#each Object.entries(MODE_META) as [id, m] (id)}
											<Command.Item value={`${m.label} ${id}`} onSelect={() => pickMode(id as DiscussionMode)}>
												<CheckIcon
													class={cn(
														'size-4',
														id === chat.mode ? 'opacity-100' : 'opacity-0'
													)}
													data-icon="inline-start"
												/>
												<div class="flex flex-col gap-0.5">
													<span class="text-sm font-medium">{m.emoji} {m.label}</span>
													<span class="text-muted-foreground text-xs leading-snug">{m.hint}</span>
												</div>
											</Command.Item>
										{/each}
									</Command.Group>
								</Command.List>
							</Command.Root>
						</Popover.Content>
					</Popover.Root>

					<!-- Agents -->
					<button
						type="button"
						disabled={isRunning}
						onclick={() => (agentsOpen = true)}
						class="text-foreground/85 hover:bg-muted/55 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors disabled:opacity-60"
					>
						<UsersIcon class="size-3.5 opacity-80" />
						{chat.agents.length}
					</button>

					<!-- Generations stepper -->
					<div class="text-foreground/85 inline-flex h-8 items-center rounded-full">
						<button
							type="button"
							disabled={isRunning || chat.generations <= 1}
							onclick={() => bumpGen(-1)}
							class="hover:bg-muted/55 grid size-7 place-items-center rounded-full transition-colors disabled:opacity-40"
							aria-label="Decrease generations"
						>
							<MinusIcon class="size-3.5" />
						</button>
						<span class="px-1 text-[12.5px] font-semibold tabular-nums">
							{chat.generations}
						</span>
						<button
							type="button"
							disabled={isRunning || chat.generations >= maxGenForMode(chat.mode)}
							onclick={() => bumpGen(1)}
							class="hover:bg-muted/55 grid size-7 place-items-center rounded-full transition-colors disabled:opacity-40"
							aria-label="Increase generations"
						>
							<PlusIcon class="size-3.5" />
						</button>
					</div>

					<span class="flex-1"></span>

					{#if isRunning}
						<button
							type="button"
							onclick={onStop}
							class="bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/30 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors"
						>
							<SquareIcon class="size-3" />
							Stop
						</button>
					{/if}

					<button
						type="button"
						disabled={isRunning || !chat.draftTopic.trim()}
						onclick={() => void onRun()}
						class="run-btn inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isRunning}
							<Loader2Icon class="size-3.5 animate-spin" />
							Running
						{:else}
							<SendHorizontalIcon class="size-3.5" />
							Run
						{/if}
					</button>
				</div>
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
{/if}

<style>
	.composer {
		background: color-mix(in oklab, var(--card) 88%, transparent);
		border: 1px solid oklch(1 0 0 / 0.07);
		box-shadow:
			0 1px 0 oklch(1 0 0 / 0.04) inset,
			0 12px 28px -16px oklch(0 0 0 / 0.6);
		backdrop-filter: blur(14px) saturate(140%);
		-webkit-backdrop-filter: blur(14px) saturate(140%);
		transition: border-color 160ms ease;
	}
	.composer:focus-within {
		border-color: oklch(0.66 0.2 285 / 0.45);
	}

	.mode-chip {
		box-shadow:
			inset 0 1px 0 oklch(1 0 0 / 0.2),
			0 1px 2px oklch(0 0 0 / 0.35);
	}

	.mode-pill {
		padding-block: 0;
	}

	.suggestion {
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
	}

	.run-btn {
		background: linear-gradient(
			135deg,
			oklch(0.7 0.2 285),
			oklch(0.62 0.18 305)
		);
		color: oklch(0.99 0.005 265);
		box-shadow:
			inset 0 1px 0 oklch(1 0 0 / 0.18),
			0 1px 2px oklch(0 0 0 / 0.4),
			0 8px 22px -10px oklch(0.66 0.2 285 / 0.55);
	}
	.run-btn:not(:disabled):hover {
		filter: brightness(1.06);
	}
	.run-btn:not(:disabled):active {
		filter: brightness(0.96);
	}
</style>
