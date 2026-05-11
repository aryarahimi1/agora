import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/** Proxies OpenRouter's public model catalog (helps avoid browser CORS quirks). */
export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const res = await fetch('https://openrouter.ai/api/v1/models', {
			headers: { Accept: 'application/json' }
		});

		if (!res.ok) {
			const text = await res.text();
			console.error(
				'OpenRouter models catalog error',
				res.status,
				text.slice(0, 500)
			);
			return json({ error: 'Model catalog unavailable' }, { status: 502 });
		}

		const body = (await res.json()) as {
			data?: { id: string; name?: string }[];
		};

		const rows =
			body.data?.map((m) => ({
				id: m.id,
				name: m.name ?? m.id
			})) ?? [];

		return json({ models: rows });
	} catch (e) {
		console.error('OpenRouter models proxy:', e);
		return json({ error: 'Model catalog unavailable' }, { status: 500 });
	}
};
