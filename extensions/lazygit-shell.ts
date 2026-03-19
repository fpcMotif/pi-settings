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

function getArgs(command: string): string[] {
	const trimmed = command.trim();
	let argsString = "";
	if (trimmed.startsWith("lazygit")) {
		argsString = trimmed.slice(7).trim();
	} else if (trimmed.startsWith("lg")) {
		argsString = trimmed.slice(2).trim();
	}
	if (!argsString) return [];

	const args: string[] = [];
	let current = "";
	let inQuotes: string | null = null;
	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i];
		if (inQuotes) {
			if (char === inQuotes) {
				inQuotes = null;
			} else {
				current += char;
			}
		} else if (char === '"' || char === "'") {
			inQuotes = char;
		} else if (/\s/.test(char)) {
			if (current.length > 0) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}
	if (current.length > 0) {
		args.push(current);
	}
	return args;
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

		const args = getArgs(event.command);
		const env = {
			...process.env,
			PATH: `/opt/zerobrew/prefix/bin:${process.env.PATH ?? ""}`,
		};

		const exitCode = await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
			tui.stop();
			process.stdout.write("\x1b[2J\x1b[H");

			const result = spawnSync("lazygit", args, {
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
