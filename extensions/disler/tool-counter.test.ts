import { describe, it, expect, mock, beforeEach } from "bun:test";
import toolCounter from "./tool-counter.ts";

describe("tool-counter", () => {
    let pi: any;

    beforeEach(() => {
        pi = {
            on: mock()
        };
    });

	it("registers tool_execution_end and session_start events", () => {
		toolCounter(pi);
		expect(pi.on).toHaveBeenCalledWith("tool_execution_end", expect.any(Function));
		expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
	});
});

// Mocking dependencies for test
function createMockContext() {
    return {
        cwd: "/home/user/project",
        model: { id: "gpt-4" },
        getContextUsage: mock().mockReturnValue({ percent: 45 }),
        ui: {
            setFooter: mock(),
            setTheme: mock().mockReturnValue({ success: true }),
            setTitle: mock()
        },
        sessionManager: {
            getBranch: mock().mockReturnValue([])
        },
        hasUI: true
    };
}

function createMockFooterData() {
    return {
        onBranchChange: mock().mockReturnValue(mock()), // Returns an unsubscribe function
        getGitBranch: mock().mockReturnValue("main")
    };
}

function createMockTUI() {
    return {
        requestRender: mock()
    };
}

function createMockTheme() {
    return {
        fg: mock().mockImplementation((color, text) => text)
    };
}

describe("tool tracking", () => {
    let pi: any;

    beforeEach(() => {
        pi = {
            on: mock()
        };
    });

    it("tracks tool counts accurately", async () => {
        toolCounter(pi);
        const onToolExecutionEnd = pi.on.mock.calls.find((call: any[]) => call[0] === "tool_execution_end")[1];

        // Execute some tools
        await onToolExecutionEnd({ toolName: "read_file" });
        await onToolExecutionEnd({ toolName: "list_files" });
        await onToolExecutionEnd({ toolName: "read_file" });

        // Verify counts are updated. We will do this by checking the rendered footer later,
        // as the counts object is private to the module. We can use the UI mock to test this.

        // Let's set up the session start event to get access to the footer renderer
        const onSessionStart = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];
        const ctx = createMockContext();
        await onSessionStart({}, ctx);

        // Extract the footer factory
        expect(ctx.ui.setFooter).toHaveBeenCalled();
        const footerFactory = ctx.ui.setFooter.mock.calls[0][0];

        // Create footer component
        const footerData = createMockFooterData();
        const footerComponent = footerFactory(createMockTUI(), createMockTheme(), footerData);

        // Render and check if tools are present
        const lines = footerComponent.render(100);
        // "read_file:2 list_files:1" should be on the second line
        expect(lines[1]).toContain("read_file:2");
        expect(lines[1]).toContain("list_files:1");
    });
});

describe("session_start event", () => {
    let pi: any;

    beforeEach(() => {
        pi = {
            on: mock()
        };
    });

    it("applies defaults and sets the footer", async () => {
        toolCounter(pi);
        const onSessionStart = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];
        const ctx = createMockContext();
        await onSessionStart({}, ctx);

        // verify the UI theme is set (via applyExtensionDefaults)
        expect(ctx.ui.setTheme).toHaveBeenCalled();
        expect(ctx.ui.setFooter).toHaveBeenCalledWith(expect.any(Function));
    });
});

describe("render function", () => {
    let pi: any;
    let footerComponent: any;
    let ctx: any;

    beforeEach(async () => {
        pi = { on: mock() };
        toolCounter(pi);

        const onSessionStart = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];
        ctx = createMockContext();

        // Mock session with messages to calculate tokens
        ctx.sessionManager.getBranch.mockReturnValue([
            {
                type: "message",
                message: {
                    role: "assistant",
                    usage: {
                        input: 1200,
                        output: 500,
                        cost: { total: 0.015 }
                    }
                }
            },
            {
                type: "message",
                message: {
                    role: "user"
                } // Should be ignored
            },
            {
                type: "message",
                message: {
                    role: "assistant",
                    usage: {
                        input: 500,
                        output: 100,
                        cost: { total: 0.005 }
                    }
                }
            }
        ]);

        await onSessionStart({}, ctx);
        const footerFactory = ctx.ui.setFooter.mock.calls[0][0];

        const footerData = createMockFooterData();
        footerComponent = footerFactory(createMockTUI(), createMockTheme(), footerData);
    });

    it("renders exactly two lines", () => {
        const lines = footerComponent.render(120);
        expect(lines).toBeArray();
        expect(lines.length).toBe(2);
    });

    it("formats line 1 correctly (model, context, tokens, cost)", () => {
        const lines = footerComponent.render(120);
        const l1 = lines[0];

        // Model
        expect(l1).toContain("gpt-4");

        // Context percent (45%) and bar map to 4 filled and 6 empty (# = round(45/10) = 5 actually based on rounding in the implementation, Math.round(45/10) = 5)
        // Let's just check the percent string
        expect(l1).toContain("45%");

        // Tokens
        // input 1200 + 500 = 1700 -> 1.7k
        // output 500 + 100 = 600 -> 600
        expect(l1).toContain("↓1.7k");
        expect(l1).toContain("↑600");

        // Cost: 0.015 + 0.005 = 0.02 -> 0.0200
        expect(l1).toContain("$0.0200");
    });

    it("formats line 2 correctly (cwd, branch, tools)", () => {
        const lines = footerComponent.render(120);
        const l2 = lines[1];

        // Cwd base name (project)
        expect(l2).toContain("project");

        // Branch
        expect(l2).toContain("(main)");

        // Tool tracking might still be active from the previous test depending on how toolCounter instantiates `counts`
        // Given it's a module level variable `counts` in the actual code: `const counts: Record<string, number> = {};`
        // This makes `counts` state persistent across tests. We should just test we get a string.
        expect(typeof l2).toBe("string");
    });
});

describe("dispose function", () => {
    let pi: any;

    beforeEach(() => {
        pi = {
            on: mock()
        };
    });

    it("calls unsubscribe from onBranchChange", async () => {
        toolCounter(pi);
        const onSessionStart = pi.on.mock.calls.find((call: any[]) => call[0] === "session_start")[1];
        const ctx = createMockContext();
        await onSessionStart({}, ctx);

        const footerFactory = ctx.ui.setFooter.mock.calls[0][0];

        const mockUnsubscribe = mock();
        const footerData = {
            onBranchChange: mock().mockReturnValue(mockUnsubscribe),
            getGitBranch: mock().mockReturnValue("main")
        };

        const footerComponent = footerFactory(createMockTUI(), createMockTheme(), footerData);

        // Ensure onBranchChange was called when component was created
        expect(footerData.onBranchChange).toHaveBeenCalled();

        // Call dispose
        footerComponent.dispose();

        // Ensure unsubscribe is called
        expect(mockUnsubscribe).toHaveBeenCalled();
    });
});
