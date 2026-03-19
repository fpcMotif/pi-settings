/**
 * Minimal — Model name + context meter in a compact footer
 * Shows model ID and a 10-block context usage bar: [###-------] 30%
 *
 * Usage: pi -e ~/.pi/agent/extensions/disler/minimal.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { applyExtensionDefaults } from "./themeMap.ts";
import { renderProgressBar } from "./utils.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		ctx.ui.setFooter((_tui, theme, _footerData) => ({
			dispose: () => {},
			invalidate() {},
			render(width: number): string[] {
				const model = ctx.model?.id || "no-model";
				const usage = ctx.getContextUsage();
				const bar = renderProgressBar(usage?.percent ?? 0);

				const left = theme.fg("dim", ` ${model}`);
				const right = theme.fg("dim", `${bar} `);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

				return [truncateToWidth(left + pad + right, width)];
			},
		}));
	});
}
