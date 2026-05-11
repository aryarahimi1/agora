<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { MODE_META, type DiscussionMode } from '$lib/chat/types';
	import { ArrowRightIcon, SparklesIcon } from '@lucide/svelte';

	const modeIds = Object.keys(MODE_META) as DiscussionMode[];
</script>

<div class="bg-app text-foreground min-h-screen">
	<header class="border-border/80 flex justify-end border-b px-6 py-4">
		<Button variant="outline" size="sm" href={resolve('/workspace')}>
			Open workspace
			<ArrowRightIcon data-icon="inline-end" />
		</Button>
	</header>

	<section class="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center">
		<Badge variant="secondary" class="mb-4 gap-1 font-normal">
			<SparklesIcon class="size-3.5" />
			Multi-agent · OpenRouter
		</Badge>
		<h1 class="text-brand text-4xl font-extrabold tracking-tight sm:text-5xl">Debator</h1>
		<p class="text-muted-foreground mx-auto mt-4 max-w-xl text-lg leading-relaxed">
			Run structured discussions between multiple AI models. Orchestrate roleplay, consensus,
			brainstorms, debates, and collaborative teaching—all from one polished workspace.
		</p>
		<div class="mt-8 flex flex-wrap justify-center gap-3">
			<Button size="lg" class="font-semibold" href={resolve('/workspace')}>
				Enter workspace
			</Button>
			<Button size="lg" variant="outline" href={resolve('/workspace?mode=debate')}>
				Try debate mode
			</Button>
		</div>
	</section>

	<section class="mx-auto max-w-6xl px-6 py-12">
		<h2 class="mb-8 text-center text-2xl font-bold tracking-tight">Discussion modes</h2>
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each modeIds as id (id)}
				{@const m = MODE_META[id]}
				<a href={resolve(`/workspace?mode=${id}`)} class="group block h-full">
					<Card
						class="glass border-border/80 hover:border-primary/35 h-full transition-all hover:-translate-y-0.5 hover:shadow-lg"
					>
						<CardHeader class="gap-3">
							<div
								class="flex size-12 items-center justify-center rounded-xl text-2xl shadow-md {m.gradientClass}"
							>
								{m.emoji}
							</div>
							<CardTitle class="text-lg">{m.label}</CardTitle>
							<CardDescription class="leading-relaxed">{m.hint}</CardDescription>
						</CardHeader>
						<CardContent class="text-muted-foreground flex items-center gap-1 text-sm font-medium">
							Open in workspace
							<ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
						</CardContent>
					</Card>
				</a>
			{/each}
		</div>
	</section>

	<section class="border-border/80 mx-auto max-w-4xl border-t px-6 py-14">
		<div class="grid gap-8 sm:grid-cols-3">
			<div class="flex flex-col gap-2 text-center">
				<h3 class="font-semibold">3–6 agents</h3>
				<p class="text-muted-foreground text-sm leading-relaxed">
					Add voices, swap models per agent, and reset personas when you change modes.
				</p>
			</div>
			<div class="flex flex-col gap-2 text-center">
				<h3 class="font-semibold">Chat-first UI</h3>
				<p class="text-muted-foreground text-sm leading-relaxed">
					Mode, roster, and generation depth live on the composer—where you already are.
				</p>
			</div>
			<div class="flex flex-col gap-2 text-center">
				<h3 class="font-semibold">Stop anytime</h3>
				<p class="text-muted-foreground text-sm leading-relaxed">
					Interrupt long runs without losing your topic or sidebar history.
				</p>
			</div>
		</div>
	</section>
</div>
