<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		workspace,
		deleteChat,
		hydrateWorkspace,
		newChat,
		selectChat
	} from '$lib/chat/workspace.svelte';
	import { auth, logout } from '$lib/auth/auth.svelte';
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
		SunIcon,
		MoonIcon,
		LogOutIcon,
		UserIcon,
		SettingsIcon
	} from '@lucide/svelte';
	import { mode, toggleMode } from 'mode-watcher';

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

	async function handleLogout(): Promise<void> {
		await logout();
		goto('/login');
	}
</script>

<div class="bg-app flex h-screen w-full overflow-hidden">
	<aside
		class="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-72 shrink-0 flex-col gap-3 border-r p-4"
	>
		<a
			href={resolve('/')}
			class="hover:bg-sidebar-accent/60 -mx-1 flex items-baseline gap-2 rounded-md px-2 py-1 transition-colors"
		>
			<span class="text-brand text-[22px] leading-none">Agora</span>
			<span class="text-muted-foreground/80 font-display text-[11px] italic leading-none">
				a forum
			</span>
		</a>

		<Button
			class="h-9 w-full justify-center rounded-md font-semibold"
			onclick={() => newChat()}
		>
			<PlusIcon data-icon="inline-start" />
			New chat
		</Button>

		<div class="relative">
			<SearchIcon
				class="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
			/>
			<Input
				type="search"
				placeholder="Search chats"
				bind:value={query}
				class="bg-background h-9 rounded-md pl-8"
			/>
		</div>

		<div class="text-muted-foreground/80 px-1 pt-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
			Chats
		</div>

		<ScrollArea class="-mx-1 min-h-0 flex-1 px-1">
			<div class="flex flex-col gap-0.5 pb-2">
				{#each filtered as chat (chat.id)}
					{@const meta = MODE_META[chat.mode]}
					{@const active = chat.id === workspace.activeChatId}
					<div class="group relative">
						<button
							type="button"
							class={cn(
								'flex w-full flex-col items-stretch gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors',
								active
									? 'bg-sidebar-accent text-sidebar-accent-foreground'
									: 'hover:bg-sidebar-accent/55 text-sidebar-foreground/90'
							)}
							onclick={() => selectChat(chat.id)}
						>
							<span class="flex items-baseline gap-2 pr-7">
								<span
									class={cn(
										'mt-[7px] size-[6px] shrink-0 rounded-full',
										meta.gradientClass
									)}
									aria-hidden="true"
									title={meta.label}
								></span>
								<span class="line-clamp-2 text-[13.5px] leading-snug font-medium">
									{chat.title}
								</span>
							</span>
							<span class="text-muted-foreground/85 flex items-baseline gap-1.5 pl-4 text-[11px]">
								<span>{meta.label}</span>
								<span aria-hidden="true">·</span>
								<span>{chat.agents.length} {chat.agents.length === 1 ? 'agent' : 'agents'}</span>
							</span>
						</button>

						<div
							class="absolute top-1.5 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
						>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											size="icon-xs"
											variant="ghost"
											class="size-7"
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
					<div class="text-muted-foreground/85 px-2 py-6 text-center text-xs">
						{query.trim() ? 'No chats match.' : 'No chats yet.'}
					</div>
				{/if}
			</div>
		</ScrollArea>

		<div class="border-sidebar-border/70 mt-auto flex items-center justify-between gap-2 border-t pt-3">
			<a
				href={resolve('/')}
				class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
			>
				<HomeIcon class="size-3.5" />
				Home
			</a>
			<div class="flex items-center gap-2.5">
				<span class="text-muted-foreground/70 text-[10px]">via OpenRouter</span>

				{#if auth.status === 'authed' && auth.user}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 relative grid size-7 place-items-center rounded-md transition-colors"
									aria-label="Account"
									title={auth.user?.email ?? 'Account'}
								>
									<UserIcon class="size-3.5" />
									{#if auth.user?.openrouter_key_set === false}
										<span
											class="bg-amber-400 absolute top-0.5 right-0.5 size-1.5 rounded-full"
											aria-label="API key not set"
										></span>
									{/if}
								</button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-52">
							<DropdownMenu.Group>
								<div class="px-2 py-1.5">
									<p class="text-foreground truncate text-[12px] font-medium">{auth.user.email}</p>
									{#if auth.user?.openrouter_key_set === false}
										<p class="text-amber-500 text-[11px]">No API key set</p>
									{/if}
								</div>
							</DropdownMenu.Group>
							<DropdownMenu.Separator />
							<DropdownMenu.Group>
								<DropdownMenu.Item onSelect={() => goto('/account')}>
									<SettingsIcon data-icon="inline-start" />
									Account settings
								</DropdownMenu.Item>
								<DropdownMenu.Item onclick={handleLogout}>
									<LogOutIcon data-icon="inline-start" />
									Sign out
								</DropdownMenu.Item>
							</DropdownMenu.Group>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}

				<button
					type="button"
					onclick={toggleMode}
					aria-label={mode.current === 'dark' ? 'Switch to daylit theme' : 'Switch to midnight theme'}
					title={mode.current === 'dark' ? 'Daylit' : 'Midnight'}
					class="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 grid size-7 place-items-center rounded-md transition-colors"
				>
					{#if mode.current === 'dark'}
						<SunIcon class="size-3.5" />
					{:else}
						<MoonIcon class="size-3.5" />
					{/if}
				</button>
			</div>
		</div>
	</aside>

	<section class="flex min-h-0 min-w-0 flex-1 flex-col">
		<div class="mx-auto flex min-h-0 w-full max-w-[680px] flex-1 flex-col px-6 sm:px-8">
			{@render children()}
		</div>
	</section>
</div>
