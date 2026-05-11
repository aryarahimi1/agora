<script lang="ts">
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import ChatShell from '$lib/components/ChatShell.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import '../app.css';

	let { children } = $props();

	const showShell = $derived(page.url.pathname.startsWith('/workspace'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Debator — AI Discussion Hub</title>
</svelte:head>

<ModeWatcher defaultMode="dark" />
<Toaster richColors position="top-center" />

{#if showShell}
	<ChatShell>{@render children()}</ChatShell>
{:else}
	{@render children()}
{/if}
