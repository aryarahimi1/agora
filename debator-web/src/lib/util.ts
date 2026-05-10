export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		const t = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(t);
			resolve();
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

export function statusClass(status: string): string {
	if (status.includes('Error')) return 'status-error';
	if (status.includes('stopped')) return 'status-warning';
	if (status.includes('Complete') || status.includes('Reached')) return 'status-success';
	return 'status-info';
}
