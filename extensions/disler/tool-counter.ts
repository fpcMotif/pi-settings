/**
 * Tool Counter — Rich two-line footer
 * Line 1: model + context meter | tokens in/out + cost
 * Line 2: cwd (branch) | per-tool call tally
 *
 * Usage: pi -e ~/.pi/agent/extensions/disler/tool-counter.ts
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { basename } from "node:path";
import { applyExtensionDefaults } from "./themeMap.ts";
import { renderProgressBar } from "./utils.ts";

export default function (pi: ExtensionAPI) {
	const counts: Record<string, number> = {};

	pi.on("tool_execution_end", async (event) => {
		counts[event.toolName] = (counts[event.toolName] || 0) + 1;
	});

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					let tokIn = 0;
					let tokOut = 0;
					let cost = 0;
					for (const entry of ctx.sessionManager.getBranch()) {
						if (entry.type === "message" && entry.message.role === "assistant") {
							const m = entry.message as AssistantMessage;
							tokIn += m.usage.input;
							tokOut += m.usage.output;
							cost += m.usage.cost.total;
						}
					}

					const fmt = (n: number) => n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
					const dir = basename(ctx.cwd);
					const branch = footerData.getGitBranch();

					// Line 1: model + context | tokens + cost
					const model = ctx.model?.id || "no-model";
					const usage = ctx.getContextUsage();
					const bar = renderProgressBar(usage?.percent ?? 0);

					const l1Left = theme.fg("dim", ` ${model} ${bar}`);
					const l1Right = theme.fg("dim", `↓${fmt(tokIn)} ↑${fmt(tokOut)} $${cost.toFixed(4)} `);
					const l1Pad = " ".repeat(Math.max(1, width - visibleWidth(l1Left) - visibleWidth(l1Right)));

					// Line 2: cwd (branch) | tool counts
					const branchStr = branch ? ` (${branch})` : "";
					const l2Left = theme.fg("accent", ` ${dir}${branchStr}`);
					const toolStr = Object.entries(counts)
						.sort(([, a], [, b]) => b - a)
						.map(([name, count]) => `${name}:${count}`)
						.join(" ");
					const l2Right = theme.fg("dim", `${toolStr} `);
					const l2Pad = " ".repeat(Math.max(1, width - visibleWidth(l2Left) - visibleWidth(l2Right)));

					return [
						truncateToWidth(l1Left + l1Pad + l1Right, width),
						truncateToWidth(l2Left + l2Pad + l2Right, width),
					];
				},
			};
		});
	});
}
