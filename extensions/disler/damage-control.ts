/**
 * Damage Control — Safety interceptor that blocks dangerous commands
 * Loads rules from .pi/damage-control-rules.yaml (project or global ~/.pi/agent/)
 *
 * Usage: pi -e ~/.pi/agent/extensions/disler/damage-control.ts
 */

import type { ExtensionAPI, ToolCallEvent } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { parse as yamlParse } from "yaml";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { applyExtensionDefaults } from "./themeMap.ts";

interface Rule {
	pattern: string;
	reason: string;
	ask?: boolean;
}

interface Rules {
	bashToolPatterns: Rule[];
	zeroAccessPaths: string[];
	readOnlyPaths: string[];
	noDeletePaths: string[];
}

export default function (pi: ExtensionAPI) {
	let rules: Rules = {
		bashToolPatterns: [],
		zeroAccessPaths: [],
		readOnlyPaths: [],
		noDeletePaths: [],
	};

	function resolvePath(p: string, cwd: string): string {
		if (p.startsWith("~")) p = path.join(os.homedir(), p.slice(1));
		return path.resolve(cwd, p);
	}

	function isPathMatch(targetPath: string, pattern: string, cwd: string): boolean {
		const resolvedPattern = pattern.startsWith("~") ? path.join(os.homedir(), pattern.slice(1)) : pattern;
		if (resolvedPattern.endsWith("/")) {
			const absolutePattern = path.isAbsolute(resolvedPattern) ? resolvedPattern : path.resolve(cwd, resolvedPattern);
			return targetPath.startsWith(absolutePattern);
		}
		const regexPattern = resolvedPattern
			.replace(/[.+^${}()|[\]\\]/g, "\\$&")
			.replace(/\*/g, ".*");
		const regex = new RegExp(`^${regexPattern}$|^${regexPattern}/|/${regexPattern}$|/${regexPattern}/`);
		const relativePath = path.relative(cwd, targetPath);
		return regex.test(targetPath) || regex.test(relativePath) || targetPath.includes(resolvedPattern) || relativePath.includes(resolvedPattern);
	}


	function validateBashCommand(command: string, rules: Rules): { violationReason: string | null, shouldAsk: boolean } {
		let violationReason: string | null = null;
		let shouldAsk = false;

		for (const rule of rules.bashToolPatterns) {
			const regex = new RegExp(rule.pattern);
			if (regex.test(command)) {
				violationReason = rule.reason;
				shouldAsk = !!rule.ask;
				break;
			}
		}

		if (!violationReason) {
			for (const zap of rules.zeroAccessPaths) {
				if (command.includes(zap)) { return { violationReason: `Bash references zero-access path: ${zap}`, shouldAsk }; }
			}
		}
		if (!violationReason) {
			for (const rop of rules.readOnlyPaths) {
				if (command.includes(rop) && (/[\s>|]/.test(command) || command.includes("rm") || command.includes("mv") || command.includes("sed"))) {
					return { violationReason: `Bash may modify read-only path: ${rop}`, shouldAsk };
				}
			}
		}
		if (!violationReason) {
			for (const ndp of rules.noDeletePaths) {
				if (command.includes(ndp) && (command.includes("rm") || command.includes("mv"))) {
					return { violationReason: `Bash attempts to delete protected path: ${ndp}`, shouldAsk };
				}
			}
		}

		return { violationReason, shouldAsk };
	}

	function validateWritePaths(inputPaths: string[], rules: Rules, cwd: string, resolvePath: (p: string, cwd: string) => string, isPathMatch: (t: string, p: string, c: string) => boolean): string | null {
		for (const p of inputPaths) {
			const resolved = resolvePath(p, cwd);
			for (const rop of rules.readOnlyPaths) {
				if (isPathMatch(resolved, rop, cwd)) { return `Modification of read-only path: ${rop}`; }
			}
		}
		return null;
	}

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);

		// Look for rules in: project .pi/ → global ~/.pi/agent/
		const projectRulesPath = path.join(ctx.cwd, ".pi", "damage-control-rules.yaml");
		const globalRulesPath = path.join(os.homedir(), ".pi", "agent", "damage-control-rules.yaml");
		const rulesPath = fs.existsSync(projectRulesPath) ? projectRulesPath : fs.existsSync(globalRulesPath) ? globalRulesPath : null;

		try {
			if (rulesPath) {
				const content = fs.readFileSync(rulesPath, "utf8");
				const loaded = yamlParse(content) as Partial<Rules>;
				rules = {
					bashToolPatterns: loaded.bashToolPatterns || [],
					zeroAccessPaths: loaded.zeroAccessPaths || [],
					readOnlyPaths: loaded.readOnlyPaths || [],
					noDeletePaths: loaded.noDeletePaths || [],
				};
				const source = rulesPath === projectRulesPath ? "project" : "global";
				ctx.ui.notify(`🛡️ Damage-Control: Loaded ${rules.bashToolPatterns.length + rules.zeroAccessPaths.length + rules.readOnlyPaths.length + rules.noDeletePaths.length} rules (${source}).`);
			} else {
				ctx.ui.notify("🛡️ Damage-Control: No rules found. Create .pi/damage-control-rules.yaml");
			}
		} catch (err) {
			ctx.ui.notify(`🛡️ Damage-Control: Failed to load rules: ${err instanceof Error ? err.message : String(err)}`);
		}

		ctx.ui.setStatus(`🛡️ DC Active: ${rules.bashToolPatterns.length + rules.zeroAccessPaths.length + rules.readOnlyPaths.length + rules.noDeletePaths.length} rules`);
	});

	pi.on("tool_call", async (event, ctx) => {
		let violationReason: string | null = null;
		let shouldAsk = false;

		const checkPaths = (pathsToCheck: string[]) => {
			for (const p of pathsToCheck) {
				const resolved = resolvePath(p, ctx.cwd);
				for (const zap of rules.zeroAccessPaths) {
					if (isPathMatch(resolved, zap, ctx.cwd)) return `Access to zero-access path restricted: ${zap}`;
				}
			}
			return null;
		};

		const inputPaths: string[] = [];
		if (isToolCallEventType("read", event) || isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
			inputPaths.push(event.input.path);
		} else if (isToolCallEventType("grep", event) || isToolCallEventType("find", event) || isToolCallEventType("ls", event)) {
			inputPaths.push(event.input.path || ".");
		}

		if (!violationReason) violationReason = checkPaths(inputPaths);

		if (!violationReason && isToolCallEventType("bash", event)) {
			const result = validateBashCommand(event.input.command, rules);
			violationReason = result.violationReason;
			shouldAsk = result.shouldAsk;
		} else if (!violationReason && (isToolCallEventType("write", event) || isToolCallEventType("edit", event))) {
			violationReason = validateWritePaths(inputPaths, rules, ctx.cwd, resolvePath, isPathMatch);
		}

		if (violationReason) {
			if (shouldAsk) {
				const confirmed = await ctx.ui.confirm("🛡️ Damage-Control", `${violationReason}\n\nCommand: ${isToolCallEventType("bash", event) ? event.input.command : JSON.stringify(event.input)}\n\nProceed?`, { timeout: 30000 });
				if (!confirmed) {
					ctx.abort();
					return { block: true, reason: `🛑 BLOCKED: ${violationReason} (User denied)\n\nDO NOT attempt to work around this restriction. Report this block to the user.` };
				}
				return { block: false };
			}
			ctx.ui.notify(`🛑 Blocked ${event.toolName}: ${violationReason}`);
			ctx.abort();
			return { block: true, reason: `🛑 BLOCKED: ${violationReason}\n\nDO NOT attempt to work around this restriction. Report this block to the user.` };
		}

		return { block: false };
	});
}
