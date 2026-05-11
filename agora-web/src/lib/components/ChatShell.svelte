<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		workspace,
		deleteChat,
		hydrateWorkspace,
		newChat,
		selectChat
	} from '$lib/chat/workspace.svelte';
	import { MODE_META } from '$lib/chat/types';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import {
		PlusIcon,
		HomeIcon,
		MoreHorizontalIcon,
		SearchIcon,
		Trash2Icon,
		MessageSquareIcon
	} from '@lucide/svelte';

	let { children } = $props();

	let query = $state('');

	onMount(() => {
		hydrateWorkspace();
	});

	const filtered = $derived(
		query.trim()
			? workspace.sessions.filter((s) =>
					s.title.toLowerCase().includes(query.trim().toLowerCase())
				)
			: workspace.sessions
	);
</script>

<div class="bg-app flex h-screen w-full overflow-hidden">
	<aside
		class="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-72 shrink-0 flex-col gap-3 border-r p-3"
	>
		<a
			href={resolve('/')}
			class="hover:bg-sidebar-accent flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors"
		>
			<span
				class="from-primary grid size-8 place-items-center rounded-lg bg-gradient-to-br via-fuchsia-500 to-amber-400 text-base shadow-sm"
				>◇</span
			>
			<span class="text-brand text-base font-bold tracking-tight">Agora</span>
		</a>

		<Button class="w-full justify-center font-semibold" onclick={() => newChat()}>
			<PlusIcon data-icon="inline-start" />
			New chat
		</Button>

		<div class="relative">
			<SearchIcon
				class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
			/>
			<Input
				type="search"
				placeholder="Search chats…"
				bind:value={query}
				class="bg-sidebar-accent/40 h-9 pl-8"
			/>
		</div>

		<div class="text-muted-foreground px-2 pt-1 text-[10px] font-semibold tracking-wider uppercase">
			Chats
		</div>

		<ScrollArea class="-mx-1 min-h-0 flex-1 px-1">
			<div class="flex flex-col gap-1 pb-2">
				{#each filtered as chat (chat.id)}
					{@const meta = MODE_META[chat.mode]}
					{@const active = chat.id === workspace.activeChatId}
					<div class="group relative">
						<button
							type="button"
							class={cn(
								'flex w-full flex-col items-stretch gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors',
								active
									? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border/60'
									: 'hover:bg-sidebar-accent/60 text-sidebar-foreground/90'
							)}
							onclick={() => selectChat(chat.id)}
						>
							<span class="flex items-start gap-2 pr-7">
								<span
									class={cn(
										'mode-dot mt-1 size-2 shrink-0 rounded-full shadow-sm',
										meta.gradientClass
									)}
									aria-hidden="true"
									title={meta.label}
								></span>
								<span class="line-clamp-2 text-[13.5px] leading-snug font-medium">
									{chat.title}
								</span>
							</span>
							<span class="text-muted-foreground/85 flex items-center gap-1.5 pl-4 text-[11px] tracking-tight">
								<span>{meta.label}</span>
								<span class="opacity-50">·</span>
								<span>{chat.agents.length} agents</span>
							</span>
						</button>

						<div
							class="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
						>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											size="icon-xs"
											variant="ghost"
											class="size-8"
											aria-label="Chat options"
										>
											<MoreHorizontalIcon />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="w-40">
									<DropdownMenu.Group>
										<DropdownMenu.Item
											variant="destructive"
											onclick={() => deleteChat(chat.id)}
										>
											<Trash2Icon data-icon="inline-start" />
											Delete chat
										</DropdownMenu.Item>
									</DropdownMenu.Group>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					</div>
				{/each}

				{#if filtered.length === 0}
					<div class="text-muted-foreground px-3 py-6 text-center text-xs">
						{query.trim() ? 'No chats match.' : 'No chats yet.'}
					</div>
				{/if}
			</div>
		</ScrollArea>

		<div class="border-sidebar-border/60 mt-auto flex items-center justify-between border-t pt-3">
			<a
				href={resolve('/')}
				class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
			>
				<HomeIcon class="size-3.5" />
				Home
			</a>
			<span class="text-muted-foreground text-[10px]">Powered by OpenRouter</span>
		</div>
	</aside>

	<section class="flex min-h-0 min-w-0 flex-1 flex-col">
		<div class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
			{@render children()}
		</div>
	</section>
</div>

<style>
	.mode-dot {
		box-shadow:
			0 0 0 2px oklch(0 0 0 / 0.15),
			inset 0 1px 0 oklch(1 0 0 / 0.2);
	}
</style>
