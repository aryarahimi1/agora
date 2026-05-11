<script lang="ts">
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { DiscussionEntry } from '$lib/api';
	import Markdown from '$lib/components/Markdown.svelte';

	let {
		entries
	}: {
		entries: DiscussionEntry[];
	} = $props();

	let rootEl: HTMLDivElement | undefined = $state();
	let scroller: HTMLElement | null = $state(null);
	let pinned = $state(true);

	const tick = $derived(
		entries.reduce((s, e) => s + e.response.length, entries.length)
	);

	function onScrollerScroll(): void {
		if (!scroller) return;
		const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
		pinned = distance < 96;
	}

	$effect(() => {
		if (!rootEl || scroller) return;
		const found = rootEl.closest('[data-chat-scroll]') as HTMLElement | null;
		if (!found) return;
		scroller = found;
		found.addEventListener('scroll', onScrollerScroll, { passive: true });
		return () => found.removeEventListener('scroll', onScrollerScroll);
	});

	$effect(() => {
		void tick;
		if (!scroller || !pinned) return;
		const el = scroller;
		requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight;
		});
	});

	function avatarTint(hue: number | undefined): string {
		const h = typeof hue === 'number' ? hue : 25;
		return `background: oklch(var(--avatar-bg-l) var(--avatar-bg-c) ${h}); color: oklch(var(--avatar-fg-l) var(--avatar-fg-c) ${h});`;
	}

	function monogram(name: string): string {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		const only = parts[0] ?? '?';
		return only.slice(0, 2).toUpperCase();
	}

	function shortModel(id: string): string {
		const slash = id.indexOf('/');
		return slash >= 0 ? id.slice(slash + 1) : id;
	}

	function metaLine(entry: DiscussionEntry): string {
		const parts: string[] = [];
		if (entry.round !== undefined) parts.push(`Round ${entry.round}`);
		if (entry.phase) parts.push(entry.phase);
		if (entry.position) parts.push(entry.position);
		return parts.join(' · ');
	}
</script>

<div bind:this={rootEl} class="flex flex-col gap-10 py-8">
	{#each entries as entry, i (i)}
		{@const meta = metaLine(entry)}
		<article
			class="group flex gap-4"
			class:is-streaming={entry.streaming}
			in:fly={{ y: 6, duration: 280, easing: quintOut }}
		>
			<div
				class="avatar grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold tracking-[0.04em] tabular-nums select-none"
				style={avatarTint(entry.avatarHue)}
				aria-hidden="true"
			>
				{monogram(entry.participant)}
			</div>

			<div class="min-w-0 flex-1">
				<header class="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
					<h3 class="font-display text-foreground text-[17px] font-semibold leading-none tracking-[-0.005em]">
						{entry.participant}
					</h3>
					{#if meta}
						<span class="text-muted-foreground/95 text-[12px] leading-none tracking-tight">
							{meta}
						</span>
					{/if}
					{#if entry.streaming}
						<span class="text-primary/85 font-display text-[12px] leading-none italic">
							speaking
						</span>
					{/if}
					<span class="text-muted-foreground/65 ml-auto font-mono text-[10.5px] leading-none tracking-tight">
						{shortModel(entry.model)}
					</span>
				</header>

				<div class="font-display message-body text-foreground/95 min-w-0 text-[16.5px] leading-[1.72]">
					{#if entry.response}
						<Markdown source={entry.response} />
					{/if}
					{#if entry.streaming}<span class="stream-caret" aria-hidden="true"></span>{/if}
				</div>
			</div>
		</article>
	{/each}
</div>

<style>
	.avatar {
		font-family: var(--font-sans);
	}

	.stream-caret {
		display: inline-block;
		width: 2px;
		height: 1em;
		margin-left: 2px;
		vertical-align: -0.14em;
		background: var(--foreground);
		animation: caret-blink 1.05s steps(2, jump-none) infinite;
	}
	@keyframes caret-blink {
		0%,
		50% {
			opacity: 1;
		}
		50.01%,
		100% {
			opacity: 0;
		}
	}

	.message-body :global(p) {
		margin: 0 0 0.85em;
	}
	.message-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.message-body :global(h1),
	.message-body :global(h2),
	.message-body :global(h3),
	.message-body :global(h4) {
		font-family: var(--font-serif);
		font-weight: 600;
		letter-spacing: -0.01em;
		line-height: 1.25;
		margin: 1.2em 0 0.5em;
	}
	.message-body :global(h1) { font-size: 1.35em; }
	.message-body :global(h2) { font-size: 1.2em; }
	.message-body :global(h3) { font-size: 1.05em; }
	.message-body :global(em) {
		font-style: italic;
	}
	.message-body :global(strong) {
		font-weight: 600;
	}
	.message-body :global(code) {
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
		font-size: 0.9em;
		background: var(--code-tint);
		padding: 0.08em 0.32em;
		border-radius: 3px;
	}
	.message-body :global(pre) {
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
		font-size: 0.88em;
		line-height: 1.55;
		background: var(--code-block-tint);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.85em 1em;
		overflow-x: auto;
		margin: 1em 0;
	}
	.message-body :global(pre code) {
		background: none;
		padding: 0;
		border-radius: 0;
	}
	.message-body :global(ul),
	.message-body :global(ol) {
		padding-left: 1.4em;
		margin: 0.6em 0 0.85em;
	}
	.message-body :global(li) {
		margin: 0.18em 0;
	}
	.message-body :global(blockquote) {
		font-style: italic;
		color: var(--muted-foreground);
		padding-left: 1em;
		border-left: 1px solid var(--border);
		margin: 0.85em 0;
	}
	.message-body :global(a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-thickness: 0.5px;
	}
	.message-body :global(a:hover) {
		text-decoration-thickness: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		.stream-caret {
			animation: none;
			opacity: 1;
		}
	}
</style>
