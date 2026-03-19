import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import lazygitShell from "./lazygit-shell";
import { spawnSync } from "node:child_process";

mock.module("node:child_process", () => {
    return {
        spawnSync: mock(),
    };
});

describe("lazygitShell", () => {
    let mockPi: any;
    let registeredHandler: any;
    let mockCtx: any;
    let mockTui: any;
    let processStdoutWrite: any;

    beforeEach(() => {
        registeredHandler = undefined;
        mockPi = {
            on: mock((event: string, handler: any) => {
                if (event === "user_bash") {
                    registeredHandler = handler;
                }
            })
        };

        mockTui = {
            stop: mock(),
            start: mock(),
            requestRender: mock(),
        };

        mockCtx = {
            hasUI: true,
            ui: {
                custom: mock(async (callback: any) => {
                    return new Promise((resolve) => {
                        const done = (code: number | null) => resolve(code);
                        const result = callback(mockTui, {}, {}, done);
                    });
                })
            }
        };

        (spawnSync as import("bun:test").Mock<any>).mockReset();
        lazygitShell(mockPi);

        // Mock process.stdout.write to prevent cluttering test output
        processStdoutWrite = process.stdout.write;
        process.stdout.write = mock();
    });

    afterEach(() => {
        process.stdout.write = processStdoutWrite;
    });

    describe("user_bash event handler", () => {
        it("should return error if UI is missing", async () => {
            const event = { command: "lazygit" };
            const ctx = { hasUI: false };
            const result = await registeredHandler(event, ctx);

            expect(result).toEqual({
                result: {
                    output: "(lazygit requires pi interactive TUI mode)",
                    exitCode: 1,
                    cancelled: false,
                    truncated: false,
                }
            });
            expect(spawnSync).not.toHaveBeenCalled();
        });

        it("should execute lazygit successfully", async () => {
            (spawnSync as import("bun:test").Mock<any>).mockReturnValue({ status: 0 });

            const event = { command: "lazygit", cwd: "/test/dir" };
            const result = await registeredHandler(event, mockCtx);

            expect(mockCtx.ui.custom).toHaveBeenCalled();
            expect(mockTui.stop).toHaveBeenCalled();
            expect(process.stdout.write).toHaveBeenCalledWith("\x1b[2J\x1b[H");
            expect(spawnSync).toHaveBeenCalledWith(
                process.env.SHELL || "/bin/bash",
                ["-lc", "lazygit"],
                {
                    cwd: "/test/dir",
                    stdio: "inherit",
                    env: expect.objectContaining({
                        PATH: expect.stringContaining("/opt/zerobrew/prefix/bin:")
                    })
                }
            );
            expect(mockTui.start).toHaveBeenCalled();
            expect(mockTui.requestRender).toHaveBeenCalledWith(true);

            expect(result).toEqual({
                result: {
                    output: "(lazygit exited successfully)",
                    exitCode: 0,
                    cancelled: false,
                    truncated: false,
                }
            });
        });

        it("should handle failed lazygit execution", async () => {
            (spawnSync as import("bun:test").Mock<any>).mockReturnValue({ status: 127 });

            const event = { command: "lg log", cwd: "/test/dir" };
            const result = await registeredHandler(event, mockCtx);

            // Checking the normalizeCommand behavior
            expect(spawnSync).toHaveBeenCalledWith(
                expect.any(String),
                ["-lc", "lazygit log"],
                expect.any(Object)
            );

            expect(result).toEqual({
                result: {
                    output: "(lazygit exited with code 127)",
                    exitCode: 127,
                    cancelled: false,
                    truncated: false,
                }
            });
        });

        it("should handle null exit code", async () => {
            (spawnSync as import("bun:test").Mock<any>).mockReturnValue({ status: null });

            const event = { command: "lazygit status", cwd: "/test/dir" };
            const result = await registeredHandler(event, mockCtx);

            expect(result).toEqual({
                result: {
                    output: "(lazygit exited with code 1)",
                    exitCode: 1,
                    cancelled: false,
                    truncated: false,
                }
            });
        });
    });
});
