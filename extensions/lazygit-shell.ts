import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function tokenize(command: string): string[] {
	const args: string[] = [];
	let currentArg = "";
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let escaped = false;
	let inToken = false;

	for (let i = 0; i < command.length; i++) {
		const char = command[i];

		if (escaped) {
			currentArg += char;
			escaped = false;
			inToken = true;
		} else if (inSingleQuote) {
			if (char === "'") {
				inSingleQuote = false;
			} else {
				currentArg += char;
			}
			inToken = true;
		} else if (inDoubleQuote) {
			if (char === '"') {
				inDoubleQuote = false;
			} else if (char === '\\') {
				escaped = true;
			} else {
				currentArg += char;
			}
			inToken = true;
		} else {
			if (char === '\\') {
				escaped = true;
				inToken = true;
			} else if (char === "'") {
				inSingleQuote = true;
				inToken = true;
			} else if (char === '"') {
				inDoubleQuote = true;
				inToken = true;
			} else if (char === ' ' || char === '\t') {
				if (inToken) {
					args.push(currentArg);
					currentArg = "";
					inToken = false;
				}
			} else {
				currentArg += char;
				inToken = true;
			}
		}
	}

	if (inToken) {
		args.push(currentArg);
	}

	return args;
}

function isLazygitCommand(command: string): boolean {
	const trimmed = command.trim();
	return (
		trimmed === "lazygit" ||
		trimmed.startsWith("lazygit ") ||
		trimmed === "lg" ||
		trimmed.startsWith("lg ")
	);
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

		const args = tokenize(event.command);
		if (args.length === 0) return;

		const bin = args[0] === "lg" ? "lazygit" : args[0];
		if (bin !== "lazygit") return; // just to be safe

		const commandArgs = args.slice(1);

		const env = {
			...process.env,
			PATH: `/opt/zerobrew/prefix/bin:${process.env.PATH ?? ""}`,
		};

		const exitCode = await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
			tui.stop();
			process.stdout.write("\x1b[2J\x1b[H");

			const result = spawnSync(bin, commandArgs, {
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
