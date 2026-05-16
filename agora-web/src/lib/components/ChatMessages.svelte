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
	// `pinned` = stay glued to the bottom. Goes false the *instant* the
	// user touches the wheel / trackpad / arrow keys (not after a scroll
	// event), so a streaming token can never yank them back mid-scroll.
	let pinned = $state(true);

	const streamingTick = $derived.by(() => {
		for (let i = entries.length - 1; i >= 0; i--) {
			const e = entries[i];
			if (e.streaming) return `${i}:${e.response.length}`;
		}
		return `idle:${entries.length}`;
	});

	let scrollScheduled = false;

	function isAtBottom(): boolean {
		if (!scroller) return true;
		return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 24;
	}

	function unpin(): void {
		if (pinned) pinned = false;
	}

	function onScrollerScroll(): void {
		// Only the "user reached the bottom again" transition is decided
		// from the scroll handler. Unpin is driven by direct input events.
		if (!pinned && isAtBottom()) pinned = true;
	}

	$effect(() => {
		if (!rootEl || scroller) return;
		const found = rootEl.closest('[data-chat-scroll]') as HTMLElement | null;
		if (!found) return;
		scroller = found;
		found.addEventListener('scroll', onScrollerScroll, { passive: true });
		found.addEventListener('wheel', unpin, { passive: true });
		found.addEventListener('touchstart', unpin, { passive: true });
		found.addEventListener('keydown', unpin);
		return () => {
			found.removeEventListener('scroll', onScrollerScroll);
			found.removeEventListener('wheel', unpin);
			found.removeEventListener('touchstart', unpin);
			found.removeEventListener('keydown', unpin);
		};
	});

	$effect(() => {
		void streamingTick;
		if (!scroller || !pinned) return;
		if (scrollScheduled) return;
		scrollScheduled = true;
		const raf = requestAnimationFrame(() => {
			scrollScheduled = false;
			if (!scroller || !pinned) return;
			scroller.scrollTop = scroller.scrollHeight;
		});
		return () => {
			cancelAnimationFrame(raf);
			scrollScheduled = false;
		};
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

<div bind:this={rootEl} class="chat-list flex flex-col py-8">
	{#each entries as entry, i (i)}
		{#if entry.kind === 'moderator'}
			<div
				class="moderator-row text-muted-foreground/80 my-3 flex items-baseline gap-3 pl-12 text-[12.5px] leading-snug"
				in:fly={{ y: 4, duration: 220, easing: quintOut }}
			>
				<span aria-hidden="true" class="text-muted-foreground/45 select-none">◌</span>
				<span class="font-display italic">{entry.response}</span>
			</div>
		{:else}
			{@const meta = metaLine(entry)}
			<article
				class="group my-5 flex gap-4 first:mt-0"
				class:is-streaming={entry.streaming}
				class:is-settled={!entry.streaming}
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
							<Markdown source={entry.response} streaming={entry.streaming === true} />
						{/if}
						{#if entry.streaming}<span class="stream-caret" aria-hidden="true"></span>{/if}
					</div>
				</div>
			</article>
		{/if}
	{/each}
</div>

<style>
	.avatar {
		font-family: var(--font-sans);
	}

	/* Stop the browser's own scroll-anchoring from fighting with us when
	   the streaming message grows. Without this, Chrome can silently push
	   the viewport mid-scroll to "preserve" the focused element. */
	.chat-list {
		overflow-anchor: none;
	}

	/* Settled messages skip layout/paint while off-screen. The single
	   biggest win when scrolling back through a long conversation: prior
	   messages no longer contribute to the running layout/paint budget. */
	article.is-settled {
		content-visibility: auto;
		contain-intrinsic-size: auto 220px;
		contain: layout style paint;
	}

	article.is-streaming {
		contain: layout style;
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
