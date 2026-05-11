<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import ChatShell from '$lib/components/ChatShell.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import { auth, bootstrap } from '$lib/auth/auth.svelte';
	import '../app.css';

	let { children } = $props();

	const showShell = $derived(page.url.pathname.startsWith('/workspace'));
	const needsGuard = $derived(
		page.url.pathname.startsWith('/workspace') || page.url.pathname.startsWith('/account')
	);

	onMount(() => {
		bootstrap();
	});

	$effect(() => {
		if (auth.status === 'loading') return;
		if (needsGuard && auth.status === 'guest') {
			const next = encodeURIComponent(page.url.pathname + page.url.search);
			goto(`/login?next=${next}`);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Agora — Multi-Agent AI Discussions</title>
</svelte:head>

<ModeWatcher defaultMode="system" />
<Toaster richColors position="top-center" />

{#if auth.status === 'loading'}
	<div class="flex min-h-screen items-center justify-center">
		<div class="border-primary/30 border-t-primary h-8 w-8 animate-spin rounded-full border-2"></div>
	</div>
{:else if showShell}
	<ChatShell>{@render children()}</ChatShell>
{:else}
	{@render children()}
{/if}
