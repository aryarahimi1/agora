<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { cn } from '$lib/utils';
	import {
		PlusIcon,
		Trash2Icon,
		RotateCcwIcon,
		CheckIcon,
		ChevronsUpDownIcon
	} from '@lucide/svelte';
	import {
		AGENT_AVATAR_HUES,
		MODE_META,
		type Agent,
		type DiscussionMode
	} from '$lib/chat/types';
	import type { ModelOption } from '$lib/chat/modelsCatalog';

	let {
		open = $bindable(false),
		agents,
		mode,
		catalog,
		disabled = false,
		onAdd,
		onRemove,
		onUpdate,
		onReset
	}: {
		open?: boolean;
		agents: Agent[];
		mode: DiscussionMode;
		catalog: ModelOption[];
		disabled?: boolean;
		onAdd: () => void;
		onRemove: (id: string) => void;
		onUpdate: (id: string, patch: Partial<Omit<Agent, 'id'>>) => void;
		onReset: () => void;
	} = $props();

	const meta = $derived(MODE_META[mode]);
	const canAdd = $derived(meta.flexibleAgents && agents.length < meta.maxAgents);
	const canRemove = $derived(meta.flexibleAgents && agents.length > meta.minAgents);

	let openModelFor = $state<string | null>(null);
	let modelSearch = $state('');

	function avatarTint(idx: number): string {
		const hue = AGENT_AVATAR_HUES[idx % AGENT_AVATAR_HUES.length];
		return `background: oklch(var(--avatar-bg-l) var(--avatar-bg-c) ${hue}); color: oklch(var(--avatar-fg-l) var(--avatar-fg-c) ${hue});`;
	}

	function monogram(name: string): string {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
		const only = parts[0] ?? '?';
		return only.slice(0, 2).toUpperCase();
	}

	function catalogRows(agent: Agent): ModelOption[] {
		const rows = [...catalog];
		if (agent.model && !rows.some((r) => r.id === agent.model)) {
			rows.unshift({ id: agent.model, name: `${agent.model} (custom)` });
		}
		return rows;
	}

	function findModelLabel(id: string): string {
		return catalog.find((m) => m.id === id)?.name ?? id;
	}

	function pickModel(agentId: string, modelId: string) {
		onUpdate(agentId, { model: modelId });
		openModelFor = null;
		modelSearch = '';
	}

	function filterModels(agent: Agent): ModelOption[] {
		const q = modelSearch.trim().toLowerCase();
		const rows = catalogRows(agent);
		if (!q) return rows;
		return rows.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex h-full max-h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg">
		<Sheet.Header class="border-border shrink-0 border-b px-6 py-4">
			<div class="flex items-center justify-between gap-2">
				<div>
					<Sheet.Title>Agents</Sheet.Title>
					<Sheet.Description>
						Name each voice, tune personas, and assign models from OpenRouter.
					</Sheet.Description>
				</div>
				<div class="text-muted-foreground flex shrink-0 items-baseline gap-1.5 text-[12px]">
					<span class={cn('inline-block size-[7px] translate-y-[-1px] rounded-full', meta.gradientClass)} aria-hidden="true"></span>
					<span class="font-display text-foreground text-[13px] font-medium">{meta.label}</span>
				</div>
			</div>
		</Sheet.Header>

		<ScrollArea class="min-h-0 flex-1">
			<div class="flex flex-col gap-3 p-4">
				{#each agents as agent, idx (agent.id)}
					<div class="bg-card border-border space-y-3 rounded-md border p-3.5">
						<div class="flex items-start gap-3">
							<div
								class="grid size-10 shrink-0 place-items-center rounded-full text-[12px] font-semibold tracking-[0.04em] select-none"
								style={avatarTint(idx)}
								aria-hidden="true"
							>
								{monogram(agent.name)}
							</div>
							<div class="flex flex-1 flex-col gap-1.5">
								<Label for="agent-name-{agent.id}" class="text-xs">Name</Label>
								<Input
									id="agent-name-{agent.id}"
									value={agent.name}
									{disabled}
									oninput={(e) =>
										onUpdate(agent.id, { name: (e.currentTarget as HTMLInputElement).value })}
								/>
							</div>
							{#if canRemove}
								<Button
									size="icon-sm"
									variant="ghost"
									class="text-muted-foreground hover:text-destructive mt-6"
									aria-label="Remove agent"
									{disabled}
									onclick={() => onRemove(agent.id)}
								>
									<Trash2Icon />
								</Button>
							{/if}
						</div>

						<div class="flex flex-col gap-1.5">
							<Label for="agent-persona-{agent.id}" class="text-xs">Persona</Label>
							<Textarea
								id="agent-persona-{agent.id}"
								rows={2}
								value={agent.persona}
								{disabled}
								class="resize-none text-sm"
								oninput={(e) =>
									onUpdate(agent.id, {
										persona: (e.currentTarget as HTMLTextAreaElement).value
									})}
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<Label class="text-xs">Model</Label>
							<Popover.Root
								open={openModelFor === agent.id}
								onOpenChange={(o) => {
									if (o) {
										modelSearch = '';
										openModelFor = agent.id;
									} else if (openModelFor === agent.id) {
										openModelFor = null;
									}
								}}
							>
								<Popover.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="outline"
											{disabled}
											class="h-9 w-full justify-between font-normal"
											aria-label="Select model"
										>
											<span class="truncate">{findModelLabel(agent.model)}</span>
											<ChevronsUpDownIcon class="text-muted-foreground size-4 shrink-0" />
										</Button>
									{/snippet}
								</Popover.Trigger>
								<Popover.Content class="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
									<Command.Root shouldFilter={false}>
										<Command.Input placeholder="Search models…" bind:value={modelSearch} />
										<Command.List class="max-h-72">
											<Command.Empty>No model found.</Command.Empty>
											<Command.Group>
												{#each filterModels(agent) as m (m.id)}
													<Command.Item
														value={`${m.name} ${m.id}`}
														onSelect={() => pickModel(agent.id, m.id)}
													>
														<CheckIcon
															class={cn(
																'size-4 shrink-0',
																m.id === agent.model ? 'opacity-100' : 'opacity-0'
															)}
															data-icon="inline-start"
														/>
														<div class="flex min-w-0 flex-col">
															<span class="truncate text-sm">{m.name}</span>
															<span class="text-muted-foreground truncate text-[11px]">
																{m.id}
															</span>
														</div>
													</Command.Item>
												{/each}
											</Command.Group>
										</Command.List>
									</Command.Root>
								</Popover.Content>
							</Popover.Root>
						</div>
					</div>
				{/each}
			</div>
		</ScrollArea>

		<Sheet.Footer class="border-border flex shrink-0 flex-col gap-2 border-t px-6 py-4">
			<div class="flex w-full items-center justify-between gap-2">
				<Button variant="ghost" size="sm" onclick={onReset} {disabled}>
					<RotateCcwIcon data-icon="inline-start" />
					Reset
				</Button>
				<Button onclick={onAdd} disabled={disabled || !canAdd} size="sm">
					<PlusIcon data-icon="inline-start" />
					Add agent
				</Button>
			</div>
			{#if !meta.flexibleAgents}
				<p class="text-muted-foreground text-center text-[11px]">
					{meta.label} keeps exactly {meta.minAgents} agents for its pipeline.
				</p>
			{/if}
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
