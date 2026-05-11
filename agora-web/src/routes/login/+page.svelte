<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { login } from '$lib/auth/auth.svelte';
	import { ApiError } from '$lib/auth/apiClient';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (submitting) return;
		submitting = true;

		try {
			await login({ email: email.trim(), password });
			const next = page.url.searchParams.get('next');
			// Reject //-prefixed paths (protocol-relative URLs are an open-redirect vector).
			const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/workspace';
			goto(safe);
		} catch (err) {
			if (err instanceof ApiError) {
				toast.error(err.detail);
			} else {
				toast.error('Could not sign in. Please try again.');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — Agora</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>Sign in</Card.Title>
			<Card.Description>Enter your email and password to continue.</Card.Description>
		</Card.Header>

		<form onsubmit={handleSubmit}>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<Label for="login-email">Email</Label>
					<Input
						id="login-email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						disabled={submitting}
						placeholder="you@example.com"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="login-password">Password</Label>
					<Input
						id="login-password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={password}
						disabled={submitting}
						placeholder="••••••••"
					/>
				</div>
			</Card.Content>

			<Card.Footer class="flex flex-col gap-3">
				<Button type="submit" class="w-full" disabled={submitting}>
					{submitting ? 'Signing in…' : 'Sign in'}
				</Button>
				<p class="text-muted-foreground text-center text-sm">
					No account?
					<a href="/signup" class="text-foreground underline underline-offset-4">Sign up</a>
				</p>
			</Card.Footer>
		</form>
	</Card.Root>
</div>
