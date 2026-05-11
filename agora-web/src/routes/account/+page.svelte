<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth, logout, setOpenrouterKeySet } from '$lib/auth/auth.svelte';
	import { apiFetch } from '$lib/auth/apiClient';
	import { ApiError } from '$lib/auth/apiClient';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { ArrowLeftIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface AccountPayload {
		id: string;
		email: string;
		name: string | null;
		created_at: string;
		email_verified_at: string | null;
		openrouter_key_set: boolean;
	}

	let nameValue = $state(auth.user?.name ?? '');
	let savingName = $state(false);

	let keyValue = $state('');
	let savingKey = $state(false);
	let signingOut = $state(false);

	const keySet = $derived(auth.user?.openrouter_key_set === true);

	async function handleSaveName(): Promise<void> {
		if (savingName) return;
		savingName = true;
		try {
			const result = await apiFetch<AccountPayload>('/api/account', {
				method: 'PATCH',
				body: JSON.stringify({ name: nameValue.trim() || null })
			});
			if (auth.user) {
				auth.user.name = result.name;
			}
			toast.success('Name saved.');
		} catch (err) {
			if (err instanceof ApiError) {
				toast.error(err.detail);
			} else {
				toast.error('Could not save name. Please try again.');
			}
		} finally {
			savingName = false;
		}
	}

	async function handleSaveKey(): Promise<void> {
		if (savingKey || !keyValue.trim()) return;
		savingKey = true;
		try {
			const result = await apiFetch<AccountPayload>('/api/account', {
				method: 'PATCH',
				body: JSON.stringify({ openrouter_api_key: keyValue.trim() })
			});
			setOpenrouterKeySet(result.openrouter_key_set);
			keyValue = '';
			toast.success('API key saved.');
		} catch (err) {
			if (err instanceof ApiError && err.status === 422) {
				toast.error('Not a valid OpenRouter API key.');
			} else if (err instanceof ApiError) {
				toast.error(err.detail);
			} else {
				toast.error('Could not save key. Please try again.');
			}
		} finally {
			savingKey = false;
		}
	}

	async function handleRemoveKey(): Promise<void> {
		if (savingKey) return;
		savingKey = true;
		try {
			const result = await apiFetch<AccountPayload>('/api/account', {
				method: 'PATCH',
				body: JSON.stringify({ openrouter_api_key: '' })
			});
			setOpenrouterKeySet(result.openrouter_key_set);
			toast.success('Key removed.');
		} catch (err) {
			if (err instanceof ApiError) {
				toast.error(err.detail);
			} else {
				toast.error('Could not remove key. Please try again.');
			}
		} finally {
			savingKey = false;
		}
	}

	async function handleLogout(): Promise<void> {
		signingOut = true;
		await logout();
		goto('/login');
	}
</script>

<svelte:head>
	<title>Account — Agora</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="flex w-full max-w-sm flex-col gap-5">
		<a
			href={resolve('/workspace')}
			class="text-muted-foreground hover:text-foreground -mb-1 inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
		>
			<ArrowLeftIcon class="size-3.5" />
			Back to chat
		</a>

		<!-- Profile -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Profile</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<Label>Email</Label>
					<p class="text-foreground text-sm font-medium">{auth.user?.email ?? ''}</p>
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="account-name">Name</Label>
					<div class="flex gap-2">
						<Input
							id="account-name"
							type="text"
							autocomplete="name"
							bind:value={nameValue}
							disabled={savingName}
							placeholder="Your name (optional)"
							class="flex-1"
						/>
						<Button
							variant="outline"
							disabled={savingName}
							onclick={handleSaveName}
						>
							{savingName ? 'Saving…' : 'Save'}
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- OpenRouter API key -->
		<Card.Root>
			<Card.Header>
				<Card.Title>OpenRouter API key</Card.Title>
				<Card.Description>
					Used to call models on your behalf.
					<a
						href="https://openrouter.ai/keys"
						target="_blank"
						rel="noopener noreferrer"
						class="text-foreground underline underline-offset-4"
					>
						Get a key at openrouter.ai/keys
					</a>
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex items-center gap-2">
					<span
						class="inline-block size-2 rounded-full {keySet
							? 'bg-green-500'
							: 'bg-muted-foreground/40'}"
						aria-hidden="true"
					></span>
					<span class="text-muted-foreground text-sm">
						{keySet ? 'Key is set' : 'No key set'}
					</span>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label for="account-key">New key</Label>
					<Input
						id="account-key"
						type="password"
						autocomplete="off"
						bind:value={keyValue}
						disabled={savingKey}
						placeholder="sk-or-v1-…"
					/>
				</div>

				<div class="flex gap-2">
					<Button
						class="flex-1"
						disabled={savingKey || !keyValue.trim()}
						onclick={handleSaveKey}
					>
						{savingKey ? 'Saving…' : 'Save key'}
					</Button>
					{#if keySet}
						<Button
							variant="outline"
							disabled={savingKey}
							onclick={handleRemoveKey}
						>
							Remove key
						</Button>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Sign out -->
		<Separator />
		<Button variant="outline" class="w-full" disabled={signingOut} onclick={handleLogout}>
			{signingOut ? 'Signing out…' : 'Sign out'}
		</Button>
	</div>
</div>
