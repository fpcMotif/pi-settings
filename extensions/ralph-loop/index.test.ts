import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import ralphLoop from "./index";

// Mocking the context
function createMockContext(cwd: string) {
    return {
        cwd,
        ui: {
            notify: mock(),
            setStatus: mock(),
        },
    };
}

describe("ralph-loop extension", () => {
    let pi: any;
    let testCwd: string;

    beforeEach(() => {
        testCwd = join(process.cwd(), ".test-ralph-loop-" + Math.random().toString(36).substring(7));
        if (!existsSync(testCwd)) {
            mkdirSync(testCwd, { recursive: true });
        }

        pi = {
            registerTool: mock(),
            registerCommand: mock(),
            on: mock(),
            sendUserMessage: mock(),
        };
    });

    afterEach(() => {
        if (existsSync(testCwd)) {
            rmSync(testCwd, { recursive: true, force: true });
        }
    });

    it("registers commands, tool and events", () => {
        ralphLoop(pi);

        expect(pi.registerTool).toHaveBeenCalled();
        const toolArg = pi.registerTool.mock.calls[0][0];
        expect(toolArg.name).toBe("ralph_promise");

        expect(pi.registerCommand).toHaveBeenCalledTimes(3);
        const commandNames = pi.registerCommand.mock.calls.map((call: any[]) => call[0]);
        expect(commandNames).toContain("ralph-loop");
        expect(commandNames).toContain("cancel-ralph");
        expect(commandNames).toContain("ralph-status");

        expect(pi.on).toHaveBeenCalledTimes(3);
        const eventNames = pi.on.mock.calls.map((call: any[]) => call[0]);
        expect(eventNames).toContain("agent_end");
        expect(eventNames).toContain("session_shutdown");
        expect(eventNames).toContain("session_start");
    });

    describe("/ralph-loop command", () => {
        let ralphLoopCommand: any;

        beforeEach(() => {
            ralphLoop(pi);
            ralphLoopCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-loop")[1].handler;
        });

        it("starts a loop correctly with prompt, max iterations and promise", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('My prompt --max-iterations 5 --completion-promise "DONE"', ctx);

            expect(ctx.ui.notify).toHaveBeenCalledWith("Ralph loop activated!", "success");
            expect(ctx.ui.setStatus).toHaveBeenCalledWith("ralph-loop", "Ralph iter 1 | max: 5 | promise: DONE");
            expect(pi.sendUserMessage).toHaveBeenCalled();
            const message = pi.sendUserMessage.mock.calls[0][0];
            expect(message).toContain("TASK:\nMy prompt");
            expect(message).toContain("CRITICAL: To signal completion, call the ralph_promise tool with:");

            // Verify state is written
            const statePath = join(testCwd, ".pi", "ralph-loop.state.json");
            expect(existsSync(statePath)).toBe(true);
            const state = JSON.parse(readFileSync(statePath, "utf-8"));
            expect(state.active).toBe(true);
            expect(state.iteration).toBe(1);
            expect(state.maxIterations).toBe(5);
            expect(state.completionPromise).toBe("DONE");
            expect(state.prompt).toBe("My prompt");
        });

        it("fails if loop already active", async () => {
            const ctx = createMockContext(testCwd);

            // Start first loop
            await ralphLoopCommand('prompt 1', ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith("Ralph loop activated!", "success");

            // Try starting second loop
            await ralphLoopCommand('prompt 2', ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith("Ralph loop already active (iteration 1). Run /cancel-ralph first.", "error");
        });

        it("fails with invalid args", async () => {
            const ctx = createMockContext(testCwd);

            // Empty args
            await ralphLoopCommand('  ', ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith('Usage: /ralph-loop <prompt> [--max-iterations N] [--completion-promise "TEXT"]', "error");

            // Invalid max-iterations
            await ralphLoopCommand('prompt --max-iterations bad', ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith("--max-iterations must be a non-negative integer, got: bad", "error");
        });

        it("handles missing completion promise args", async () => {
             const ctx = createMockContext(testCwd);
             await ralphLoopCommand('prompt --completion-promise', ctx);
             expect(ctx.ui.notify).toHaveBeenCalledWith("--completion-promise requires a text argument", "error");
        });
    });

    describe("ralph_promise tool", () => {
        let ralphPromiseExecute: any;
        let ralphLoopCommand: any;

        beforeEach(() => {
            ralphLoop(pi);
            ralphPromiseExecute = pi.registerTool.mock.calls.find((call: any[]) => call[0].name === "ralph_promise")[0].execute;
            ralphLoopCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-loop")[1].handler;
        });

        it("fails if no active loop", async () => {
            const ctx = createMockContext(testCwd);
            const result = await ralphPromiseExecute("tool-id", { promise_text: "DONE" }, null, null, ctx);
            expect(result.content[0].text).toBe("No active Ralph loop.");
        });

        it("fails if active loop has no completion promise", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt', ctx); // No --completion-promise

            const result = await ralphPromiseExecute("tool-id", { promise_text: "DONE" }, null, null, ctx);
            expect(result.content[0].text).toBe("This Ralph loop has no completion promise set.");
        });

        it("fails with mismatching promise text", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt --completion-promise "DONE"', ctx);

            const result = await ralphPromiseExecute("tool-id", { promise_text: "NOT DONE" }, null, null, ctx);
            expect(result.content[0].text).toContain('Promise mismatch. Expected: "DONE", got: "NOT DONE"');

            // Marker should not be written
            const markerPath = join(testCwd, ".pi", "ralph-promise-detected");
            expect(existsSync(markerPath)).toBe(false);
        });

        it("succeeds with matching promise text and writes marker", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt --completion-promise "ALL TESTS PASS"', ctx);

            const result = await ralphPromiseExecute("tool-id", { promise_text: "ALL TESTS PASS" }, null, null, ctx);
            expect(result.content[0].text).toContain('Promise "ALL TESTS PASS" accepted');

            // Marker should be written
            const markerPath = join(testCwd, ".pi", "ralph-promise-detected");
            expect(existsSync(markerPath)).toBe(true);
            const markerContent = readFileSync(markerPath, "utf-8");
            expect(markerContent).toBe("ALL TESTS PASS");
        });

        it("succeeds with matching promise text ignoring extra spaces", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt --completion-promise "ALL TESTS PASS"', ctx);

            const result = await ralphPromiseExecute("tool-id", { promise_text: "  ALL   TESTS   PASS  " }, null, null, ctx);
            expect(result.content[0].text).toContain('Promise "ALL TESTS PASS" accepted');
        });
    });

    describe("/cancel-ralph command", () => {
        let cancelRalphCommand: any;
        let ralphLoopCommand: any;

        beforeEach(() => {
            ralphLoop(pi);
            cancelRalphCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "cancel-ralph")[1].handler;
            ralphLoopCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-loop")[1].handler;
        });

        it("fails if no active loop", async () => {
            const ctx = createMockContext(testCwd);
            await cancelRalphCommand(null, ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith("No active Ralph loop to cancel.", "info");
        });

        it("cancels an active loop and removes state", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt', ctx);

            const statePath = join(testCwd, ".pi", "ralph-loop.state.json");
            expect(existsSync(statePath)).toBe(true);

            await cancelRalphCommand(null, ctx);

            expect(ctx.ui.notify).toHaveBeenCalledWith("Ralph loop cancelled after 1 iteration.", "success");
            expect(ctx.ui.setStatus).toHaveBeenCalledWith("ralph-loop", "");
            expect(existsSync(statePath)).toBe(false);
        });
    });

    describe("/ralph-status command", () => {
        let ralphStatusCommand: any;
        let ralphLoopCommand: any;

        beforeEach(() => {
            ralphLoop(pi);
            ralphStatusCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-status")[1].handler;
            ralphLoopCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-loop")[1].handler;
        });

        it("shows no active loop", async () => {
            const ctx = createMockContext(testCwd);
            await ralphStatusCommand(null, ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith("No active Ralph loop.", "info");
        });

        it("shows status of active loop", async () => {
            const ctx = createMockContext(testCwd);
            const longPrompt = 'Very long prompt that should be truncated when displaying status because it exceeds eighty characters in length';
            await ralphLoopCommand(longPrompt, ctx);
            await ralphStatusCommand(null, ctx);

            expect(ctx.ui.notify).toHaveBeenCalled();
            const notification = ctx.ui.notify.mock.calls[1][0];
            expect(notification).toContain("Ralph loop active");
            expect(notification).toContain("Iteration: 1");
            expect(notification).toContain("Max: unlimited");
            expect(notification).toContain("Promise: none");
            expect(notification).toContain(`Prompt: ${longPrompt.slice(0, 80)}...`);
        });
    });

    describe("agent_end event loop", () => {
        let agentEndHandler: any;
        let ralphLoopCommand: any;
        let ralphPromiseExecute: any;

        beforeEach(() => {
            ralphLoop(pi);
            agentEndHandler = pi.on.mock.calls.find((call: any[]) => call[0] === "agent_end")[1];
            ralphLoopCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-loop")[1].handler;
            ralphPromiseExecute = pi.registerTool.mock.calls.find((call: any[]) => call[0].name === "ralph_promise")[0].execute;
        });

        it("does nothing if no active loop", async () => {
            const ctx = createMockContext(testCwd);
            await agentEndHandler(null, ctx);
            expect(ctx.ui.setStatus).not.toHaveBeenCalled();
            expect(pi.sendUserMessage).not.toHaveBeenCalled();
        });

        it("increments iteration and sends prompt again", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt', ctx);

            // clear initial calls
            pi.sendUserMessage.mockClear();
            ctx.ui.setStatus.mockClear();

            await agentEndHandler(null, ctx);

            const statePath = join(testCwd, ".pi", "ralph-loop.state.json");
            const state = JSON.parse(readFileSync(statePath, "utf-8"));
            expect(state.iteration).toBe(2);

            expect(ctx.ui.setStatus).toHaveBeenCalledWith("ralph-loop", "Ralph iter 2 | max: unlimited");
            expect(pi.sendUserMessage).toHaveBeenCalled();
            expect(pi.sendUserMessage.mock.calls[0][0]).toContain("Ralph iteration 2");
            expect(pi.sendUserMessage.mock.calls[0][0]).toContain("TASK:\nprompt");
        });

        it("stops when hitting max iterations", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt --max-iterations 2', ctx);

            // First loop end
            await agentEndHandler(null, ctx);
            const statePath = join(testCwd, ".pi", "ralph-loop.state.json");
            let state = JSON.parse(readFileSync(statePath, "utf-8"));
            expect(state.iteration).toBe(2);

            // clear calls
            ctx.ui.setStatus.mockClear();

            // Second loop end (should hit max)
            await agentEndHandler(null, ctx);

            expect(existsSync(statePath)).toBe(false);
            expect(ctx.ui.setStatus).toHaveBeenCalledWith("ralph-loop", "");
            expect(ctx.ui.notify).toHaveBeenCalledWith("Ralph loop: Max iterations (2) reached. Stopped.", "info");
        });

        it("stops when completion marker is detected", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt --completion-promise "DONE"', ctx);

            // Simulate agent calling promise tool
            await ralphPromiseExecute("tool-id", { promise_text: "DONE" }, null, null, ctx);

            // clear calls
            ctx.ui.setStatus.mockClear();

            // Agent end should detect it
            await agentEndHandler(null, ctx);

            const statePath = join(testCwd, ".pi", "ralph-loop.state.json");
            const markerPath = join(testCwd, ".pi", "ralph-promise-detected");
            expect(existsSync(statePath)).toBe(false);
            expect(existsSync(markerPath)).toBe(false);

            expect(ctx.ui.setStatus).toHaveBeenCalledWith("ralph-loop", "");
            expect(ctx.ui.notify).toHaveBeenCalledWith('Ralph loop complete! Promise fulfilled: "DONE"', "success");
        });

        it("continues if completion marker does not match", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt --completion-promise "DONE"', ctx);

            // manually write a bad marker
            const markerPath = join(testCwd, ".pi", "ralph-promise-detected");
            writeFileSync(markerPath, "NOT DONE", "utf-8");

            // Agent end should ignore it and continue
            await agentEndHandler(null, ctx);

            const statePath = join(testCwd, ".pi", "ralph-loop.state.json");
            expect(existsSync(statePath)).toBe(true);
            const state = JSON.parse(readFileSync(statePath, "utf-8"));
            expect(state.iteration).toBe(2);
        });
    });

    describe("session events", () => {
        let sessionShutdownHandler: any;
        let sessionStartHandler: any;
        let ralphLoopCommand: any;

        beforeEach(() => {
            ralphLoop(pi);
            sessionShutdownHandler = pi.on.mock.calls.find((call: any[]) => call[0] === "session_shutdown")[1];
            sessionStartHandler = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];
            ralphLoopCommand = pi.registerCommand.mock.calls.find((call: any[]) => call[0] === "ralph-loop")[1].handler;
        });

        it("warns about active loop on session shutdown", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt', ctx);

            await sessionShutdownHandler(null, ctx);
            expect(ctx.ui.notify).toHaveBeenCalledWith("Ralph loop was active (iteration 1). State preserved — resume with pi -c.", "info");
        });

        it("restores status bar on session start", async () => {
            const ctx = createMockContext(testCwd);
            await ralphLoopCommand('prompt', ctx);

            ctx.ui.setStatus.mockClear();

            await sessionStartHandler(null, ctx);
            expect(ctx.ui.setStatus).toHaveBeenCalledWith("ralph-loop", "Ralph iter 1 | max: unlimited (resumed)");
        });
    });
});
