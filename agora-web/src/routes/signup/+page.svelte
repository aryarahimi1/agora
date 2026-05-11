<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { signup } from '$lib/auth/auth.svelte';
	import { ApiError } from '$lib/auth/apiClient';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let submitting = $state(false);

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (submitting) return;

		if (password.length < 8) {
			toast.error('Password must be at least 8 characters.');
			return;
		}

		submitting = true;

		try {
			await signup({
				email: email.trim(),
				password,
				name: name.trim() || undefined
			});
			const next = page.url.searchParams.get('next');
			// Reject //-prefixed paths (protocol-relative URLs are an open-redirect vector).
			const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/workspace';
			goto(safe);
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				toast.error('An account with that email already exists.');
			} else if (err instanceof ApiError) {
				toast.error(err.detail);
			} else {
				toast.error('Could not create account. Please try again.');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign up — Agora</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>Create an account</Card.Title>
			<Card.Description>Join Agora to save and continue your discussions.</Card.Description>
		</Card.Header>

		<form onsubmit={handleSubmit}>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<Label for="signup-name">Name <span class="text-muted-foreground">(optional)</span></Label>
					<Input
						id="signup-name"
						type="text"
						autocomplete="name"
						bind:value={name}
						disabled={submitting}
						placeholder="Your name"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="signup-email">Email</Label>
					<Input
						id="signup-email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						disabled={submitting}
						placeholder="you@example.com"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="signup-password">Password</Label>
					<Input
						id="signup-password"
						type="password"
						autocomplete="new-password"
						required
						minlength={8}
						bind:value={password}
						disabled={submitting}
						placeholder="At least 8 characters"
					/>
				</div>
			</Card.Content>

			<Card.Footer class="flex flex-col gap-3">
				<Button type="submit" class="w-full" disabled={submitting}>
					{submitting ? 'Creating account…' : 'Create account'}
				</Button>
				<p class="text-muted-foreground text-center text-sm">
					Already have an account?
					<a href="/login" class="text-foreground underline underline-offset-4">Sign in</a>
				</p>
			</Card.Footer>
		</form>
	</Card.Root>
</div>
