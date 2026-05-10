<script lang="ts">
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { DiscussionEntry } from '$lib/api';
	import { Badge } from '$lib/components/ui/badge';
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

	function avatarStyle(hue: number | undefined): string {
		const h = typeof hue === 'number' ? hue : 285;
		return `--h:${h};background:linear-gradient(135deg,oklch(0.64 0.2 ${h}),oklch(0.5 0.18 ${(h + 40) % 360}));`;
	}

	function shortModel(id: string): string {
		const slash = id.indexOf('/');
		return slash >= 0 ? id.slice(slash + 1) : id;
	}

	function metaPills(entry: DiscussionEntry): string[] {
		const out: string[] = [];
		if (entry.round !== undefined) out.push(`Round ${entry.round}`);
		if (entry.phase) out.push(entry.phase);
		if (entry.position) out.push(entry.position);
		return out;
	}
</script>

<div bind:this={rootEl} class="flex flex-col gap-6 py-6">
	{#each entries as entry, i (i)}
		<article
			class="group flex gap-3.5"
			class:is-streaming={entry.streaming}
			in:fly={{ y: 8, duration: 320, easing: quintOut }}
		>
			<div class="relative shrink-0">
				<div
					class="avatar grid size-9 place-items-center rounded-xl text-base shadow-md select-none"
					style={avatarStyle(entry.avatarHue)}
					aria-hidden="true"
				>
					{entry.emoji ?? '✦'}
				</div>
				{#if entry.streaming}
					<span class="speaker-ring" aria-hidden="true"></span>
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<div class="mb-1.5 flex flex-wrap items-center gap-1.5">
					<span class="text-foreground text-sm font-semibold tracking-tight">
						{entry.participant}
					</span>
					{#each metaPills(entry) as pill (pill)}
						<Badge
							variant="secondary"
							class="h-[18px] rounded-full px-1.5 text-[10px] font-medium tracking-wide"
						>
							{pill}
						</Badge>
					{/each}
					<span class="text-muted-foreground/90 ml-auto font-mono text-[10px] tracking-tight">
						{shortModel(entry.model)}
					</span>
				</div>

				<div class="text-foreground/92 min-w-0">
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
		position: relative;
		isolation: isolate;
		box-shadow:
			inset 0 1px 0 oklch(1 0 0 / 0.18),
			0 1px 2px oklch(0 0 0 / 0.35),
			0 4px 14px oklch(0 0 0 / 0.18);
	}
	.avatar::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		border: 1px solid oklch(1 0 0 / 0.06);
		pointer-events: none;
	}

	.speaker-ring {
		position: absolute;
		inset: -3px;
		border-radius: 14px;
		border: 1.5px solid oklch(0.78 0.16 285 / 0.55);
		animation: speaker-pulse 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
		pointer-events: none;
	}
	@keyframes speaker-pulse {
		0% {
			transform: scale(1);
			opacity: 0.85;
		}
		70% {
			transform: scale(1.18);
			opacity: 0;
		}
		100% {
			transform: scale(1.18);
			opacity: 0;
		}
	}

	.stream-caret {
		display: inline-block;
		width: 0.5em;
		height: 1.05em;
		margin-left: 3px;
		vertical-align: -0.18em;
		background: oklch(0.8 0.17 285);
		border-radius: 1px;
		box-shadow: 0 0 8px oklch(0.78 0.16 285 / 0.5);
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

	@media (prefers-reduced-motion: reduce) {
		.speaker-ring {
			animation: none;
		}
		.stream-caret {
			animation: none;
			opacity: 1;
		}
	}
</style>
