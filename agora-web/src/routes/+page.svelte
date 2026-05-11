<script lang="ts">
	import { resolve } from '$app/paths';
	import { MODE_META, type DiscussionMode } from '$lib/chat/types';
	import { auth } from '$lib/auth/auth.svelte';
	import { ArrowRightIcon } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	const modeIds = Object.keys(MODE_META) as DiscussionMode[];
</script>

<svelte:head>
	<title>Agora, a forum for staged discussion</title>
	<meta
		name="description"
		content="Agora stages structured discussions among several language models. Pick a shape: roleplay, consensus, brainstorm, debate, collaborative."
	/>
</svelte:head>

<div class="text-foreground min-h-screen">
	<!-- Hero: drenched oxblood band. The brand identifies itself here, in
	     one committed color, before the reader leaves the page. -->
	<section class="hero relative isolate">
		<header class="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
			<span class="cream-soft font-display text-[13px] italic tracking-tight">
				Agora
			</span>
			<div class="flex items-center gap-4">
				{#if auth.status === 'authed'}
					<a
						href={resolve('/workspace')}
						class="link-cream inline-flex items-center gap-1.5 text-[13px] transition-colors"
					>
						Open workspace
						<ArrowRightIcon class="size-3.5" />
					</a>
				{:else if auth.status === 'guest'}
					<a
						href={resolve('/login')}
						class="link-cream inline-flex items-center gap-1.5 text-[13px] transition-colors"
					>
						Sign in
					</a>
					<a
						href={resolve('/signup')}
						class="link-cream inline-flex items-center gap-1.5 text-[13px] transition-colors"
					>
						Sign up
						<ArrowRightIcon class="size-3.5" />
					</a>
				{/if}
			</div>
		</header>

		<div class="mx-auto max-w-6xl px-6 pt-14 pb-24 sm:px-10 sm:pt-20 sm:pb-32">
			<h1
				class="cream font-display block leading-[0.86] font-medium tracking-[-0.022em]"
				style="font-size: clamp(76px, 13.5vw, 196px);"
			>
				Agora
			</h1>
			<p
				class="cream-soft font-display mt-2 italic leading-[1.05] tracking-tight"
				style="font-size: clamp(20px, 2.6vw, 32px);"
			>
				a forum for staged discussion
			</p>

			<p
				class="cream font-display mt-14 max-w-[52ch] leading-[1.5]"
				style="font-size: clamp(17px, 1.7vw, 21px);"
			>
				Agora stages structured discussions among several language models. Pick a shape, roleplay, consensus, brainstorm, debate, or collaborative. The room takes turns. Bring a question worth thinking about together.
			</p>

			{#if auth.status === 'authed'}
				<a
					href={resolve('/workspace')}
					class="enter font-display group mt-10 inline-flex items-baseline gap-3 italic transition-colors"
					style="font-size: clamp(22px, 2.4vw, 30px);"
				>
					Enter the workspace
					<span
						class="enter-arrow inline-block transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					>→</span>
				</a>
			{:else}
				<div class="mt-10 flex flex-wrap items-baseline gap-6">
					<a
						href={resolve('/signup')}
						class="enter font-display group inline-flex items-baseline gap-3 italic transition-colors"
						style="font-size: clamp(22px, 2.4vw, 30px);"
					>
						Get started
						<span
							class="enter-arrow inline-block transition-transform group-hover:translate-x-1"
							aria-hidden="true"
						>→</span>
					</a>
					<a
						href={resolve('/login')}
						class="cream-soft font-display text-[17px] italic underline underline-offset-4"
					>
						Sign in
					</a>
				</div>
			{/if}
		</div>
	</section>

	<!-- The modes: a vertical directory, not a card grid. Each row names
	     a voice; the hint says what the room does in that voice. -->
	<section class="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:px-10 sm:pt-28 sm:pb-20">
		<h2 class="text-muted-foreground mb-10 text-[11px] font-semibold tracking-[0.22em] uppercase">
			The modes
		</h2>
		<ul class="border-border/65 divide-border/65 divide-y border-t border-b">
			{#each modeIds as id (id)}
				{@const m = MODE_META[id]}
				<li>
					<a
						href={resolve(`/workspace?mode=${id}`)}
						class="mode-row group flex items-start gap-5 py-7 transition-colors sm:gap-7 sm:py-8"
					>
						<span
							class={cn('mt-[14px] inline-block size-[10px] shrink-0 rounded-full', m.gradientClass)}
							aria-hidden="true"
						></span>
						<div class="min-w-0 flex-1">
							<h3
								class="font-display text-foreground group-hover:text-primary font-medium italic leading-[1.05] tracking-[-0.012em] transition-colors"
								style="font-size: clamp(26px, 3.2vw, 38px);"
							>
								{m.label}
							</h3>
							<p class="text-muted-foreground mt-3 max-w-[58ch] text-[15px] leading-[1.55] sm:text-[16px]">
								{m.hint}
							</p>
						</div>
						<span
							class="text-muted-foreground/55 group-hover:text-primary mt-3 hidden translate-x-0 transition-all duration-200 group-hover:translate-x-1 sm:inline-flex"
							aria-hidden="true"
						>
							<ArrowRightIcon class="size-5" />
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Colophon. A small civic note, signed in Greek. -->
	<footer class="mx-auto max-w-6xl px-6 pb-20 sm:px-10 sm:pb-28">
		<div class="border-border/55 grid gap-x-10 gap-y-4 border-t pt-10 sm:grid-cols-[auto_1fr]">
			<p class="font-display text-foreground text-[22px] italic leading-none tracking-tight">
				ἀγορά
			</p>
			<p class="text-muted-foreground max-w-[58ch] text-[13.5px] leading-relaxed">
				The assembly place where citizens gathered to argue, listen, and decide. This site is a small homage to that practice, played out among language models. Built on OpenRouter.
			</p>
		</div>
	</footer>
</div>

<style>
	/* Drenched oxblood hero. Constant in both themes; identity does not
	   flip with reading mode. A soft top-to-bottom gradient adds depth
	   without becoming a glow, matched by a hairline of cream at the
	   bottom so the band reads as a deliberate plate, not a div. */
	.hero {
		background:
			linear-gradient(180deg, var(--brand-oxblood) 0%, var(--brand-oxblood-deep) 100%);
		color: var(--brand-cream);
	}
	.hero::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: oklch(0.18 0.08 24 / 0.45);
		pointer-events: none;
	}

	.cream {
		color: var(--brand-cream);
	}
	.cream-soft {
		color: var(--brand-cream-soft);
	}
	.link-cream {
		color: var(--brand-cream-soft);
	}
	.link-cream:hover {
		color: var(--brand-cream);
	}

	.enter {
		color: var(--brand-cream);
		border-bottom: 1px solid var(--brand-cream-quiet);
		padding-bottom: 0.18em;
	}
	.enter:hover {
		border-bottom-color: var(--brand-cream);
	}
	.enter-arrow {
		font-family: var(--font-serif);
		font-style: normal;
	}

	.mode-row:hover {
		background: color-mix(in oklab, var(--primary) 4%, transparent);
	}
</style>
