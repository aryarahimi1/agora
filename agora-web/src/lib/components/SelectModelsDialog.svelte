<script lang="ts">
	import { cn } from '$lib/utils';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { Button } from '$lib/components/ui/button';
	import {
		CheckIcon,
		ChevronsUpDownIcon,
		MinusIcon,
		PlusIcon,
		WandSparklesIcon
	} from '@lucide/svelte';
	import { MODE_DEFAULT_AGENTS, MODE_META, type Agent, type DiscussionMode } from '$lib/chat/types';
	import { PRESETS, type Preset } from '$lib/chat/presets';
	import type { ModelOption } from '$lib/chat/modelsCatalog';
	import { providerColor, shortModelLabel } from '$lib/chat/modelMeta';

	interface Props {
		open: boolean;
		mode: DiscussionMode;
		agents: Agent[];
		generations: number;
		catalog: ModelOption[];
		onApply: (next: { mode: DiscussionMode; agents: Agent[]; generations: number }) => void;
		onOpenChange: (v: boolean) => void;
	}

	let { open, mode, agents, generations, catalog, onApply, onOpenChange }: Props = $props();

	let tab = $state<'presets' | 'custom'>('presets');
	let pickedPresetId = $state<string | null>(null);

	let customMode = $state<DiscussionMode>('collaborative');
	let customAgents = $state<Agent[]>([]);

	let modelPopoverFor = $state<string | null>(null);
	let modelSearch = $state('');

	$effect(() => {
		if (open) {
			customMode = mode;
			customAgents = agents.map((a) => ({ ...a }));
			pickedPresetId = null;
			tab = 'presets';
		}
	});

	function newId(): string {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
		return Math.random().toString(36).slice(2) + Date.now().toString(36);
	}

	const FALLBACK_MODEL_ROTATION: string[] = [
		'openai/gpt-4o-mini',
		'google/gemini-2.5-pro',
		'deepseek/deepseek-chat-v3.1',
		'anthropic/claude-3.5-sonnet',
		'meta-llama/llama-3.3-70b-instruct',
		'openai/gpt-4o'
	];

	function modelLabel(id: string): string {
		const hit = catalog.find((m) => m.id === id);
		return hit ? hit.name : shortModelLabel(id);
	}

	function setCustomMode(next: DiscussionMode): void {
		if (next === customMode) return;
		const meta = MODE_META[next];
		const tpls = MODE_DEFAULT_AGENTS[next];
		const targetCount = meta.flexibleAgents
			? Math.min(meta.maxAgents, Math.max(meta.minAgents, customAgents.length))
			: meta.minAgents;
		const out: Agent[] = [];
		for (let i = 0; i < targetCount; i++) {
			const tpl = tpls[i] ?? tpls[i % tpls.length];
			const carry = customAgents[i];
			out.push({
				id: carry?.id ?? newId(),
				name: tpl.name,
				emoji: tpl.emoji,
				persona: tpl.persona,
				model: carry?.model ?? FALLBACK_MODEL_ROTATION[i % FALLBACK_MODEL_ROTATION.length]
			});
		}
		customMode = next;
		customAgents = out;
	}

	function addCustomAgent(): void {
		const meta = MODE_META[customMode];
		if (customAgents.length >= meta.maxAgents) return;
		const tpls = MODE_DEFAULT_AGENTS[customMode];
		const tpl = tpls[customAgents.length] ?? tpls[customAgents.length % tpls.length];
		customAgents = [
			...customAgents,
			{
				id: newId(),
				name: tpl.name,
				emoji: tpl.emoji,
				persona: tpl.persona,
				model: FALLBACK_MODEL_ROTATION[customAgents.length % FALLBACK_MODEL_ROTATION.length]
			}
		];
	}

	function removeCustomAgent(id: string): void {
		const meta = MODE_META[customMode];
		if (customAgents.length <= meta.minAgents) return;
		customAgents = customAgents.filter((a) => a.id !== id);
	}

	function setAgentModel(agentId: string, modelId: string): void {
		customAgents = customAgents.map((a) => (a.id === agentId ? { ...a, model: modelId } : a));
		modelPopoverFor = null;
		modelSearch = '';
	}

	function buildFromPreset(preset: Preset): Agent[] {
		const out: Agent[] = [];
		for (let i = 0; i < preset.roles.length; i++) {
			const role = preset.roles[i];
			out.push({
				id: newId(),
				name: role.name,
				emoji: role.emoji,
				persona: role.persona,
				model: FALLBACK_MODEL_ROTATION[i % FALLBACK_MODEL_ROTATION.length]
			});
		}
		return out;
	}

	function pickPreset(p: Preset): void {
		pickedPresetId = p.id;
	}

	function apply(): void {
		if (tab === 'presets' && pickedPresetId) {
			const preset = PRESETS.find((p) => p.id === pickedPresetId);
			if (!preset) return;
			onApply({
				mode: preset.mode,
				agents: buildFromPreset(preset),
				generations: preset.budget
			});
			onOpenChange(false);
			return;
		}
		if (tab === 'custom') {
			onApply({
				mode: customMode,
				agents: customAgents.map((a) => ({ ...a })),
				generations
			});
			onOpenChange(false);
		}
	}

	function filteredModels(agent: Agent): ModelOption[] {
		const q = modelSearch.trim().toLowerCase();
		const base = catalog.length > 0 ? catalog : [];
		if (!q) return base;
		return base.filter(
			(m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
		);
	}

	const customMeta = $derived(MODE_META[customMode]);
	const canApply = $derived(
		(tab === 'presets' && pickedPresetId !== null) ||
			(tab === 'custom' && customAgents.length >= customMeta.minAgents)
	);
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="sm:max-w-[min(720px,calc(100vw-2rem))] gap-0 p-0">
		<div class="px-6 pt-6 pb-4">
			<Dialog.Title class="font-display text-foreground text-[22px] leading-tight tracking-[-0.012em]">
				Choose a panel
			</Dialog.Title>
			<Dialog.Description class="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
				A preset roundtable, or build the lineup yourself. Three to six voices, your pick of model for each.
			</Dialog.Description>
		</div>

		<Tabs.Root value={tab} onValueChange={(v) => (tab = v as 'presets' | 'custom')}>
			<div class="px-6">
				<Tabs.List class="bg-muted/60 inline-flex h-9 w-auto items-center rounded-md p-0.5">
					<Tabs.Trigger value="presets" class="data-active:bg-popover h-8 rounded-[5px] px-4 text-[13px] font-medium">
						Presets
					</Tabs.Trigger>
					<Tabs.Trigger value="custom" class="data-active:bg-popover h-8 rounded-[5px] px-4 text-[13px] font-medium">
						Build custom
					</Tabs.Trigger>
				</Tabs.List>
			</div>

			<Tabs.Content value="presets" class="mt-4">
				<div class="presets-scroll max-h-[58vh] overflow-y-auto px-3 pb-2">
					<ul class="space-y-px">
						{#each PRESETS as preset (preset.id)}
							{@const m = MODE_META[preset.mode]}
							{@const isPicked = pickedPresetId === preset.id}
							<li>
								<button
									type="button"
									onclick={() => pickPreset(preset)}
									class={cn(
										'group relative w-full rounded-md px-3 py-3.5 text-left transition-colors',
										isPicked ? 'bg-accent/70' : 'hover:bg-muted/55'
									)}
									aria-pressed={isPicked}
								>
									<div class="flex items-baseline gap-2.5">
										<span
											class={cn('inline-block size-[7px] translate-y-[-1px] rounded-full', m.gradientClass)}
											aria-hidden="true"
										></span>
										<h3 class="font-display text-foreground text-[15.5px] font-semibold leading-tight tracking-[-0.008em]">
											{preset.name}
										</h3>
										<span class="text-muted-foreground/85 ml-auto shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] tabular-nums">
											{m.label} · {preset.roles.length} voices
										</span>
									</div>
									<p class="text-muted-foreground mt-1.5 pl-[18px] text-[13px] leading-relaxed">
										{preset.tagline}
									</p>
									<div class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-[18px]">
										{#each preset.roles as role (role.name)}
											<span class="text-foreground/85 font-display inline-flex items-center gap-1 rounded-md bg-muted/55 px-1.5 py-0.5 text-[12px] italic">
												<span aria-hidden="true">{role.emoji}</span>
												{role.name}
											</span>
										{/each}
									</div>
									<span
										class={cn(
											'pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset transition-opacity',
											isPicked ? 'ring-foreground/20 opacity-100' : 'opacity-0'
										)}
										aria-hidden="true"
									></span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</Tabs.Content>

			<Tabs.Content value="custom" class="mt-4">
				<div class="px-6">
					<p class="text-muted-foreground/75 text-[10px] font-semibold tracking-[0.16em] uppercase">
						Mode
					</p>
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each Object.entries(MODE_META) as [id, m] (id)}
							{@const active = customMode === (id as DiscussionMode)}
							<button
								type="button"
								onclick={() => setCustomMode(id as DiscussionMode)}
								class={cn(
									'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition-colors',
									active
										? 'bg-accent text-foreground ring-foreground/15 ring-1 ring-inset font-medium'
										: 'text-foreground/80 hover:bg-muted/55'
								)}
							>
								<span class={cn('size-[6px] rounded-full', m.gradientClass)} aria-hidden="true"></span>
								{m.label}
							</button>
						{/each}
					</div>
					<p class="text-muted-foreground mt-2 pl-1 text-[12px] leading-snug">
						{customMeta.hint}
					</p>
				</div>

				<div class="custom-scroll mt-4 max-h-[44vh] overflow-y-auto px-3 pb-2">
					<ul class="space-y-1">
						{#each customAgents as agent, i (agent.id)}
							{@const slotColor = providerColor(agent.model)}
							<li class="rounded-md px-3 py-2.5 hover:bg-muted/40">
								<div class="flex items-center gap-3">
									<div class="flex items-center gap-2 min-w-0">
										<span
											class="grid size-7 shrink-0 place-items-center rounded-full text-[14px]"
											style={`background: color-mix(in oklab, ${slotColor} 16%, var(--card)); color: ${slotColor};`}
											aria-hidden="true"
										>
											{agent.emoji}
										</span>
										<div class="flex min-w-0 flex-col leading-tight">
											<span class="font-display text-foreground text-[14px] font-medium">
												{agent.name}
											</span>
											<span class="text-muted-foreground/80 text-[11px]">
												Slot {i + 1}
											</span>
										</div>
									</div>

									<div class="ml-auto flex items-center gap-1.5">
										<Popover.Root
											open={modelPopoverFor === agent.id}
											onOpenChange={(o) => {
												if (o) {
													modelSearch = '';
													modelPopoverFor = agent.id;
												} else if (modelPopoverFor === agent.id) {
													modelPopoverFor = null;
												}
											}}
										>
											<Popover.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														class="text-foreground/85 hover:bg-muted/60 inline-flex h-8 min-w-[160px] items-center justify-between gap-1.5 rounded-md border border-border/60 bg-popover px-2.5 text-[12.5px] transition-colors"
														aria-label="Select model"
													>
														<span class="flex items-center gap-1.5 min-w-0">
															<span
																class="inline-block size-[8px] shrink-0 rounded-full"
																style={`background:${slotColor}`}
																aria-hidden="true"
															></span>
															<span class="truncate">{modelLabel(agent.model)}</span>
														</span>
														<ChevronsUpDownIcon class="text-muted-foreground/75 size-3 shrink-0" />
													</button>
												{/snippet}
											</Popover.Trigger>
											<Popover.Content class="w-[min(380px,calc(100vw-2rem))] p-0" align="end">
												<Command.Root shouldFilter={false}>
													<Command.Input placeholder="Search models" bind:value={modelSearch} />
													<Command.List class="max-h-64">
														<Command.Empty>No model found.</Command.Empty>
														<Command.Group>
															{#each filteredModels(agent) as m (m.id)}
																<Command.Item
																	value={`${m.name} ${m.id}`}
																	onSelect={() => setAgentModel(agent.id, m.id)}
																>
																	<CheckIcon
																		class={cn('size-4 shrink-0', m.id === agent.model ? 'opacity-100' : 'opacity-0')}
																		data-icon="inline-start"
																	/>
																	<span
																		class="inline-block size-[8px] shrink-0 rounded-full"
																		style={`background:${providerColor(m.id)}`}
																		aria-hidden="true"
																	></span>
																	<div class="flex min-w-0 flex-col">
																		<span class="truncate text-[13px]">{m.name}</span>
																		<span class="text-muted-foreground truncate text-[11px]">{m.id}</span>
																	</div>
																</Command.Item>
															{/each}
														</Command.Group>
													</Command.List>
												</Command.Root>
											</Popover.Content>
										</Popover.Root>

										<button
											type="button"
											onclick={() => removeCustomAgent(agent.id)}
											disabled={customAgents.length <= customMeta.minAgents}
											class="text-muted-foreground hover:bg-muted/60 hover:text-foreground grid size-8 place-items-center rounded-md transition-colors disabled:opacity-30"
											aria-label="Remove agent"
										>
											<MinusIcon class="size-3.5" />
										</button>
									</div>
								</div>
							</li>
						{/each}
					</ul>

					{#if customMeta.flexibleAgents && customAgents.length < customMeta.maxAgents}
						<button
							type="button"
							onclick={addCustomAgent}
							class="text-foreground/75 hover:text-foreground hover:bg-muted/40 mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 text-[12.5px] transition-colors"
						>
							<PlusIcon class="size-3.5" />
							Add another voice
						</button>
					{/if}
				</div>
			</Tabs.Content>
		</Tabs.Root>

		<div class="border-border/60 mt-2 flex items-center gap-3 border-t px-6 py-4">
			<div class="text-muted-foreground/85 hidden text-[11.5px] sm:flex sm:items-center sm:gap-1.5">
				<WandSparklesIcon class="size-3.5" />
				Tip: switch the composer to <span class="text-foreground/85 font-medium">Auto</span> to let Agora pick for you.
			</div>
			<div class="ml-auto flex items-center gap-2">
				<Button variant="ghost" onclick={() => onOpenChange(false)} class="h-9 px-4 text-[13px]">
					Cancel
				</Button>
				<Button
					onclick={apply}
					disabled={!canApply}
					class="bg-primary text-primary-foreground hover:bg-primary/92 h-9 px-5 text-[13px] font-semibold"
				>
					Use this panel
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.presets-scroll,
	.custom-scroll {
		scrollbar-gutter: stable;
	}
</style>
