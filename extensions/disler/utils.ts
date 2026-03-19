/**
 * Renders a 10-block progress bar and percentage string.
 * Example: [###-------] 30%
 */
export function renderProgressBar(percent: number | null): string {
	const pct = percent ?? 0;
	const filled = Math.round(pct / 10);
	const bar = "#".repeat(filled) + "-".repeat(10 - filled);
	return `[${bar}] ${Math.round(pct)}%`;
}
