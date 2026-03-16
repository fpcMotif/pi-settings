import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function isLazygitCommand(command: string): boolean {
	const trimmed = command.trim();
	return (
		trimmed === "lazygit" ||
		trimmed.startsWith("lazygit ") ||
		trimmed === "lg" ||
		trimmed.startsWith("lg ")
	);
}

function normalizeCommand(command: string): string {
	const trimmed = command.trim();
	if (trimmed === "lg") return "lazygit";
	if (trimmed.startsWith("lg ")) return `lazygit ${trimmed.slice(3)}`;
	return trimmed;
}

export default function lazygitShell(pi: ExtensionAPI) {
	pi.on("user_bash", async (event, ctx) => {
		if (!isLazygitCommand(event.command)) return;

		if (!ctx.hasUI) {
			return {
				result: {
					output: "(lazygit requires pi interactive TUI mode)",
					exitCode: 1,
					cancelled: false,
					truncated: false,
				},
			};
		}

		const command = normalizeCommand(event.command);
		const shell = process.env.SHELL || "/bin/bash";
		const env = {
			...process.env,
			PATH: `/opt/zerobrew/prefix/bin:${process.env.PATH ?? ""}`,
		};

		const exitCode = await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
			tui.stop();
			process.stdout.write("\x1b[2J\x1b[H");

			const result = spawnSync(shell, ["-lc", command], {
				cwd: event.cwd,
				stdio: "inherit",
				env,
			});

			tui.start();
			tui.requestRender(true);
			done(result.status);
			return { render: () => [], invalidate: () => {} };
		});

		return {
			result: {
				output:
					exitCode === 0
						? "(lazygit exited successfully)"
						: `(lazygit exited with code ${exitCode ?? 1})`,
				exitCode: exitCode ?? 1,
				cancelled: false,
				truncated: false,
			},
		};
	});
}
