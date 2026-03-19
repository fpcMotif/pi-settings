import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const STATE_FILENAME = "ralph-loop.state.json";
const PROMISE_MARKER = "ralph-promise-detected";

interface RalphState {
  active: boolean;
  iteration: number;
  maxIterations: number;
  completionPromise: string | null;
  prompt: string;
  startedAt: string;
}

function stateDir(cwd: string): string {
  const dir = join(cwd, ".pi");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function statePath(cwd: string): string {
  return join(stateDir(cwd), STATE_FILENAME);
}

function markerPath(cwd: string): string {
  return join(stateDir(cwd), PROMISE_MARKER);
}

async function readState(cwd: string): Promise<RalphState | null> {
  const p = statePath(cwd);
  if (!existsSync(p)) return null;
  try {
    const state = JSON.parse(await readFile(p, "utf-8")) as RalphState;
    if (!state.active || typeof state.iteration !== "number" || typeof state.prompt !== "string") {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

async function writeState(cwd: string, state: RalphState): Promise<void> {
  await writeFile(statePath(cwd), JSON.stringify(state, null, 2), "utf-8");
}

async function removeState(cwd: string): Promise<void> {
  const p = statePath(cwd);
  if (existsSync(p)) await unlink(p);
  const m = markerPath(cwd);
  if (existsSync(m)) await unlink(m);
}

function parseArgs(argsStr: string): { prompt: string; maxIterations: number; completionPromise: string | null } {
  const tokens = argsStr.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const promptParts: string[] = [];
  let maxIterations = 0;
  let completionPromise: string | null = null;

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "--max-iterations") {
      i++;
      if (i >= tokens.length) throw new Error("--max-iterations requires a number argument");
      const val = parseInt(tokens[i], 10);
      if (isNaN(val) || val < 0) throw new Error(`--max-iterations must be a non-negative integer, got: ${tokens[i]}`);
      maxIterations = val;
    } else if (token === "--completion-promise") {
      i++;
      if (i >= tokens.length) throw new Error("--completion-promise requires a text argument");
      completionPromise = tokens[i].replace(/^["']|["']$/g, "");
    } else {
      promptParts.push(token);
    }
    i++;
  }

  const prompt = promptParts.join(" ").trim();
  if (!prompt) {
    throw new Error(
      "No prompt provided.\n\n" +
      "Usage:\n" +
      '  /ralph-loop Build a REST API --completion-promise "DONE" --max-iterations 20\n' +
      "  /ralph-loop Fix the auth bug --max-iterations 10\n" +
      '  /ralph-loop --completion-promise "ALL TESTS PASS" Refactor the cache layer'
    );
  }

  return { prompt, maxIterations, completionPromise };
}

function formatMax(state: RalphState): string {
  return state.maxIterations > 0 ? String(state.maxIterations) : "unlimited";
}

function formatPromise(state: RalphState): string {
  return state.completionPromise ?? "none";
}

export default function ralphLoop(pi: ExtensionAPI) {
  // ── ralph_promise tool — AI calls this to signal completion ──────────
  pi.registerTool({
    name: "ralph_promise",
    label: "Ralph Promise",
    description:
      "Signal that a Ralph Loop completion promise has been fulfilled. " +
      "ONLY call this tool when the promise statement is completely and unequivocally TRUE. " +
      "Do NOT call this to escape the loop — only when the task is genuinely complete.",
    parameters: Type.Object({
      promise_text: Type.String({
        description: "The exact completion promise text that was specified when the loop started",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = await readState(ctx.cwd);
      if (!state) {
        return {
          content: [{ type: "text" as const, text: "No active Ralph loop." }],
          details: {},
        };
      }
      if (!state.completionPromise) {
        return {
          content: [{ type: "text" as const, text: "This Ralph loop has no completion promise set." }],
          details: {},
        };
      }
      const provided = params.promise_text.trim().replace(/\s+/g, " ");
      if (provided !== state.completionPromise) {
        return {
          content: [{
            type: "text" as const,
            text: `Promise mismatch. Expected: "${state.completionPromise}", got: "${provided}". Loop continues.`,
          }],
          details: {},
        };
      }
      // Write marker for agent_end to pick up
      writeFileSync(markerPath(ctx.cwd), state.completionPromise, "utf-8");
      return {
        content: [{
          type: "text" as const,
          text: `Promise "${state.completionPromise}" accepted. Ralph loop will stop after this turn.`,
        }],
        details: {},
      };
    },
  });

  // ── /ralph-loop command ──────────────────────────────────────────────
  pi.registerCommand("ralph-loop", {
    description: "Start a Ralph Wiggum loop — iterative AI development with the same prompt",
    handler: async (args, ctx) => {
      const existing = await readState(ctx.cwd);
      if (existing) {
        ctx.ui.notify(
          `Ralph loop already active (iteration ${existing.iteration}). Run /cancel-ralph first.`,
          "error"
        );
        return;
      }

      if (!args || !args.trim()) {
        ctx.ui.notify(
          'Usage: /ralph-loop <prompt> [--max-iterations N] [--completion-promise "TEXT"]',
          "error"
        );
        return;
      }

      let parsed: ReturnType<typeof parseArgs>;
      try {
        parsed = parseArgs(args);
      } catch (err: unknown) {
        ctx.ui.notify((err as Error).message, "error");
        return;
      }

      const state: RalphState = {
        active: true,
        iteration: 1,
        maxIterations: parsed.maxIterations,
        completionPromise: parsed.completionPromise,
        prompt: parsed.prompt,
        startedAt: new Date().toISOString(),
      };

      await writeState(ctx.cwd, state);

      ctx.ui.notify("Ralph loop activated!", "success");
      ctx.ui.setStatus("ralph-loop", `Ralph iter 1 | max: ${formatMax(state)} | promise: ${formatPromise(state)}`);

      const lines = [
        "Ralph loop activated.",
        `Iteration: 1`,
        `Max iterations: ${formatMax(state)}`,
        `Completion promise: ${formatPromise(state)}`,
        "",
        "When you finish, the SAME PROMPT will be fed back to you.",
        "You will see your previous work in the files, enabling iterative improvement.",
      ];

      if (state.completionPromise) {
        lines.push(
          "",
          "CRITICAL: To signal completion, call the ralph_promise tool with:",
          `  promise_text: "${state.completionPromise}"`,
          "",
          "ONLY call it when the statement is completely and unequivocally TRUE.",
          "Do NOT call it to escape the loop."
        );
      }

      if (state.maxIterations > 0 && !state.completionPromise) {
        lines.push("", `The loop will automatically stop after ${state.maxIterations} iterations.`);
      }

      if (state.maxIterations === 0 && !state.completionPromise) {
        lines.push("", "WARNING: No completion promise or max-iterations set.", "This loop runs INDEFINITELY. Use /cancel-ralph to stop.");
      }

      pi.sendUserMessage(`${lines.join("\n")}\n\n---\n\nTASK:\n${state.prompt}`);
    },
  });

  // ── /cancel-ralph command ────────────────────────────────────────────
  pi.registerCommand("cancel-ralph", {
    description: "Cancel an active Ralph loop",
    handler: async (_args, ctx) => {
      const state = await readState(ctx.cwd);
      if (!state) {
        ctx.ui.notify("No active Ralph loop to cancel.", "info");
        return;
      }
      const n = state.iteration;
      await removeState(ctx.cwd);
      ctx.ui.setStatus("ralph-loop", "");
      ctx.ui.notify(`Ralph loop cancelled after ${n} iteration${n !== 1 ? "s" : ""}.`, "success");
    },
  });

  // ── /ralph-status command ────────────────────────────────────────────
  pi.registerCommand("ralph-status", {
    description: "Show Ralph loop status",
    handler: async (_args, ctx) => {
      const state = await readState(ctx.cwd);
      if (!state) {
        ctx.ui.notify("No active Ralph loop.", "info");
        return;
      }
      ctx.ui.notify(
        `Ralph loop active\n` +
        `  Iteration: ${state.iteration}\n` +
        `  Max: ${formatMax(state)}\n` +
        `  Promise: ${formatPromise(state)}\n` +
        `  Started: ${state.startedAt}\n` +
        `  Prompt: ${state.prompt.slice(0, 80)}${state.prompt.length > 80 ? "..." : ""}`,
        "info"
      );
    },
  });

  // ── agent_end — the core loop mechanism ──────────────────────────────
  pi.on("agent_end", async (_event, ctx) => {
    const state = await readState(ctx.cwd);
    if (!state) return;

    // Check max iterations
    if (state.maxIterations > 0 && state.iteration >= state.maxIterations) {
      await removeState(ctx.cwd);
      ctx.ui.setStatus("ralph-loop", "");
      ctx.ui.notify(`Ralph loop: Max iterations (${state.maxIterations}) reached. Stopped.`, "info");
      return;
    }

    // Check for promise marker (written by ralph_promise tool)
    if (state.completionPromise) {
      const mp = markerPath(ctx.cwd);
      if (existsSync(mp)) {
        try {
          const detected = (await readFile(mp, "utf-8")).trim();
          await unlink(mp);
          if (detected === state.completionPromise) {
            await removeState(ctx.cwd);
            ctx.ui.setStatus("ralph-loop", "");
            ctx.ui.notify(`Ralph loop complete! Promise fulfilled: "${state.completionPromise}"`, "success");
            return;
          }
        } catch {
          // Marker read failed — continue the loop
        }
      }
    }

    // Continue: increment iteration, feed same prompt
    const next = state.iteration + 1;
    state.iteration = next;
    await writeState(ctx.cwd, state);

    ctx.ui.setStatus("ralph-loop", `Ralph iter ${next} | max: ${formatMax(state)}`);

    let msg = `Ralph iteration ${next}`;
    if (state.completionPromise) {
      msg += ` | To complete: call ralph_promise tool with promise_text="${state.completionPromise}" (ONLY when TRUE)`;
    }
    if (state.maxIterations > 0) {
      msg += ` | ${state.maxIterations - next} iterations remaining`;
    }

    pi.sendUserMessage(`${msg}\n\n---\n\nTASK:\n${state.prompt}`);
  });

  // ── session_shutdown — warn about active loop ────────────────────────
  pi.on("session_shutdown", async (_event, ctx) => {
    const state = await readState(ctx.cwd);
    if (state) {
      ctx.ui.notify(
        `Ralph loop was active (iteration ${state.iteration}). State preserved — resume with pi -c.`,
        "info"
      );
    }
  });

  // ── session_start — restore status bar if loop was active ────────────
  pi.on("session_start", async (_event, ctx) => {
    const state = await readState(ctx.cwd);
    if (state) {
      ctx.ui.setStatus("ralph-loop", `Ralph iter ${state.iteration} | max: ${formatMax(state)} (resumed)`);
    }
  });
}
