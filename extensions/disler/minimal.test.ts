import { describe, it, expect, mock, beforeEach } from "bun:test";
import { visibleWidth } from "@mariozechner/pi-tui";
import minimal from "./minimal.ts";

describe("minimal extension", () => {
    let pi: any;
    let mockCtx: any;
    let mockTheme: any;
    let mockTui: any;
    let mockFooterData: any;

    beforeEach(() => {
        pi = {
            on: mock()
        };

        mockCtx = {
            model: { id: "test-model" },
            getContextUsage: mock().mockReturnValue({ percent: 50 }),
            ui: {
                setFooter: mock()
            }
        };

        mockTheme = {
            fg: mock().mockImplementation((color, text) => text)
        };

        mockTui = {};
        mockFooterData = {};
    });

    it("registers session_start event", () => {
        minimal(pi);
        expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    });

    it("sets the footer on session_start", async () => {
        minimal(pi);
        const onSessionStart = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];

        await onSessionStart({}, mockCtx);

        expect(mockCtx.ui.setFooter).toHaveBeenCalledWith(expect.any(Function));
    });

    describe("footer render", () => {
        let footerComponent: any;

        beforeEach(async () => {
            minimal(pi);
            const onSessionStart = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];
            await onSessionStart({}, mockCtx);
            const footerFactory = mockCtx.ui.setFooter.mock.calls[0][0];
            footerComponent = footerFactory(mockTui, mockTheme, mockFooterData);
        });

        it("renders model and progress bar correctly", () => {
            const lines = footerComponent.render(100);
            expect(lines).toBeArray();
            expect(lines.length).toBe(1);

            const line = lines[0];
            // Should contain model ID
            expect(line).toContain("test-model");

            // Should contain progress bar for 50%
            expect(line).toContain("50%");
        });

        it("handles missing model ID", async () => {
            mockCtx.model = null; // Edge case
            const lines = footerComponent.render(100);
            expect(lines[0]).toContain("no-model");
        });

        it("handles missing context usage", async () => {
            mockCtx.getContextUsage.mockReturnValue(null); // Edge case
            const lines = footerComponent.render(100);
            expect(lines[0]).toContain("0%");
        });

        it("handles 0% context usage", async () => {
            mockCtx.getContextUsage.mockReturnValue({ percent: 0 }); // Edge case
            const lines = footerComponent.render(100);
            expect(lines[0]).toContain("0%");
        });

        it("truncates or formats properly with narrow width", () => {
            const lines = footerComponent.render(10); // Very narrow
            // The string might have ANSI escape codes from truncateToWidth depending on pi-tui implementation
            // So we should verify visible width instead of raw length, or check that visibleWidth matches expected
            expect(visibleWidth(lines[0])).toBeLessThanOrEqual(10);
        });
    });
});
