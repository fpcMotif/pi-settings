import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { applyExtensionDefaults, applyExtensionTheme, THEME_MAP } from "./themeMap";

describe("themeMap", () => {
    let mockCtx: any;
    const originalArgv = [...process.argv];

    beforeEach(() => {
        mockCtx = {
            hasUI: true,
            ui: {
                setTheme: mock(() => ({ success: true })),
                setTitle: mock(() => {}),
            },
        };
    });

    afterEach(() => {
        process.argv = [...originalArgv];
    });

    describe("applyExtensionTheme", () => {
        it("should return false if hasUI is false", () => {
            mockCtx.hasUI = false;
            const result = applyExtensionTheme("file:///path/to/minimal.ts", mockCtx);
            expect(result).toBe(false);
            expect(mockCtx.ui.setTheme).not.toHaveBeenCalled();
        });

        it("should set theme based on extension name", () => {
            const result = applyExtensionTheme("file:///path/to/minimal.ts", mockCtx);
            expect(result).toBe(true);
            expect(mockCtx.ui.setTheme).toHaveBeenCalledWith("synthwave");
        });

        it("should use default synthwave if extension not in map", () => {
            const result = applyExtensionTheme("file:///path/to/unknown.ts", mockCtx);
            expect(result).toBe(true);
            expect(mockCtx.ui.setTheme).toHaveBeenCalledWith("synthwave");
        });

        it("should return true and not set theme if primary extension doesn't match current file", () => {
            process.argv = ["node", "script.js", "-e", "other-extension"];
            const result = applyExtensionTheme("file:///path/to/minimal.ts", mockCtx);
            expect(result).toBe(true);
            expect(mockCtx.ui.setTheme).not.toHaveBeenCalled();
        });

        it("should set theme if primary extension matches current file", () => {
            process.argv = ["node", "script.js", "--extension", "minimal"];
            const result = applyExtensionTheme("file:///path/to/minimal.ts", mockCtx);
            expect(result).toBe(true);
            expect(mockCtx.ui.setTheme).toHaveBeenCalledWith("synthwave");
        });

        it("should fallback to synthwave if specified theme fails", () => {
            THEME_MAP["custom"] = "custom-theme";
            mockCtx.ui.setTheme.mockImplementation((theme: string) => {
                if (theme === "custom-theme") return { success: false };
                return { success: true };
            });

            const result = applyExtensionTheme("file:///path/to/custom.ts", mockCtx);
            expect(result).toBe(true);
            expect(mockCtx.ui.setTheme).toHaveBeenCalledWith("custom-theme");
            expect(mockCtx.ui.setTheme).toHaveBeenCalledWith("synthwave");
            delete THEME_MAP["custom"];
        });
    });

    describe("applyExtensionDefaults", () => {
        it("should call applyExtensionTheme and applyExtensionTitle", async () => {
            process.argv = ["node", "script.js", "-e", "minimal"];
            applyExtensionDefaults("file:///path/to/minimal.ts", mockCtx);

            // applyExtensionTheme part
            expect(mockCtx.ui.setTheme).toHaveBeenCalledWith("synthwave");

            // applyExtensionTitle part (async due to setTimeout)
            await new Promise(resolve => setTimeout(resolve, 200));
            expect(mockCtx.ui.setTitle).toHaveBeenCalledWith("π - minimal");
        });

        it("should not set title if no primary extension is set", async () => {
            process.argv = ["node", "script.js"];
            applyExtensionDefaults("file:///path/to/minimal.ts", mockCtx);

            await new Promise(resolve => setTimeout(resolve, 200));
            expect(mockCtx.ui.setTitle).not.toHaveBeenCalled();
        });
    });
});
