<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	let {
		source = '',
		streaming = false
	}: { source?: string; streaming?: boolean } = $props();

	marked.use({ gfm: true, breaks: true });

	// While a message is streaming, marked.parse + DOMPurify on the entire
	// growing string runs once per token (50–100/sec), and {@html} replaces
	// every child node each time. That is what makes the page lag when the
	// user tries to scroll. Throttle the parse to at most ~10/sec during
	// streaming, then commit the final source immediately on completion.
	const STREAM_THROTTLE_MS = 100;

	let rendered = $state('');
	let lastRenderedAt = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const s = source;
		if (!streaming) {
			if (pending !== null) {
				clearTimeout(pending);
				pending = null;
			}
			rendered = s;
			lastRenderedAt = performance.now();
			return;
		}

		const now = performance.now();
		const elapsed = now - lastRenderedAt;
		if (elapsed >= STREAM_THROTTLE_MS) {
			rendered = s;
			lastRenderedAt = now;
			return;
		}

		if (pending !== null) return;
		pending = setTimeout(() => {
			pending = null;
			rendered = source;
			lastRenderedAt = performance.now();
		}, STREAM_THROTTLE_MS - elapsed);
	});

	$effect(() => {
		return () => {
			if (pending !== null) clearTimeout(pending);
		};
	});

	const html = $derived.by(() => {
		const raw = marked.parse(rendered ?? '', { async: false }) as string;
		if (typeof window === 'undefined') return raw;
		return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
	});
</script>

<div class="md">
	{@html html}
</div>

<style>
	.md {
		font-size: 15px;
		line-height: 1.65;
		color: var(--foreground);
		word-wrap: break-word;
		overflow-wrap: anywhere;
	}

	.md :global(> *:first-child) {
		margin-top: 0;
	}
	.md :global(> *:last-child) {
		margin-bottom: 0;
	}

	/* Paragraphs */
	.md :global(p) {
		margin: 0.6em 0;
	}

	/* Headings — scale ratio ≥1.25, weight contrast */
	.md :global(h1),
	.md :global(h2),
	.md :global(h3),
	.md :global(h4) {
		font-weight: 650;
		letter-spacing: -0.012em;
		line-height: 1.25;
		margin: 1.4em 0 0.5em;
		color: oklch(0.99 0.005 265);
	}
	.md :global(h1) {
		font-size: 1.5em;
	}
	.md :global(h2) {
		font-size: 1.22em;
	}
	.md :global(h3) {
		font-size: 1.06em;
		font-weight: 600;
	}
	.md :global(h4) {
		font-size: 0.96em;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* Strong / emphasis */
	.md :global(strong) {
		font-weight: 650;
		color: oklch(0.99 0.005 265);
	}
	.md :global(em) {
		font-style: italic;
	}

	/* Lists — proper indent, comfortable rhythm */
	.md :global(ul),
	.md :global(ol) {
		margin: 0.55em 0;
		padding-left: 1.45em;
	}
	.md :global(li) {
		margin: 0.22em 0;
	}
	.md :global(li > p) {
		margin: 0.22em 0;
	}
	.md :global(ul) {
		list-style: disc;
	}
	.md :global(ul ul) {
		list-style: circle;
	}
	.md :global(ol) {
		list-style: decimal;
	}
	.md :global(li::marker) {
		color: oklch(0.7 0.12 285);
	}

	/* Links */
	.md :global(a) {
		color: oklch(0.78 0.16 285);
		text-decoration: underline;
		text-decoration-color: oklch(0.78 0.16 285 / 0.4);
		text-underline-offset: 2px;
		text-decoration-thickness: 1px;
		transition: color 120ms ease;
	}
	.md :global(a:hover) {
		color: oklch(0.86 0.14 285);
		text-decoration-color: oklch(0.86 0.14 285 / 0.7);
	}

	/* Inline code */
	.md :global(code) {
		font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
		font-size: 0.88em;
		padding: 0.12em 0.38em;
		border-radius: 5px;
		background: oklch(1 0 0 / 0.07);
		border: 1px solid oklch(1 0 0 / 0.06);
		color: oklch(0.94 0.02 285);
	}

	/* Code blocks */
	.md :global(pre) {
		margin: 0.85em 0;
		padding: 0.85em 1em;
		border-radius: 10px;
		background: oklch(0.13 0.018 265);
		border: 1px solid oklch(1 0 0 / 0.06);
		overflow-x: auto;
		font-size: 0.86em;
		line-height: 1.55;
	}
	.md :global(pre code) {
		padding: 0;
		background: transparent;
		border: 0;
		font-size: inherit;
		color: oklch(0.92 0.015 265);
	}

	/* Blockquote — background tint (no side-stripe ban) */
	.md :global(blockquote) {
		margin: 0.85em 0;
		padding: 0.65em 0.95em;
		border-radius: 8px;
		background: oklch(0.66 0.2 285 / 0.07);
		border: 1px solid oklch(0.66 0.2 285 / 0.14);
		color: oklch(0.88 0.02 265);
	}
	.md :global(blockquote p) {
		margin: 0.25em 0;
	}

	/* Tables */
	.md :global(table) {
		display: block;
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		margin: 0.9em 0;
		font-size: 0.92em;
	}
	.md :global(th),
	.md :global(td) {
		padding: 0.45em 0.7em;
		border-bottom: 1px solid oklch(1 0 0 / 0.07);
		text-align: left;
		vertical-align: top;
	}
	.md :global(th) {
		font-weight: 600;
		color: oklch(0.99 0.005 265);
		background: oklch(1 0 0 / 0.03);
	}

	/* HR */
	.md :global(hr) {
		margin: 1.4em 0;
		border: 0;
		height: 1px;
		background: oklch(1 0 0 / 0.08);
	}

	/* Images */
	.md :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 8px;
		margin: 0.6em 0;
	}
</style>
