import { describe, it, expect } from "vitest";
import { parseArgs } from "./index.ts";

describe("parseArgs", () => {
  describe("edge cases and errors", () => {
    it("should throw if no prompt is provided (empty string)", () => {
      expect(() => parseArgs("")).toThrow("No prompt provided.");
    });

    it("should throw if no prompt is provided (whitespace only)", () => {
      expect(() => parseArgs("   \n  \t ")).toThrow("No prompt provided.");
    });

    it("should throw if flags are provided but no actual prompt text exists", () => {
      expect(() => parseArgs("--max-iterations 5 --completion-promise 'DONE'")).toThrow("No prompt provided.");
    });

    it("should throw if --max-iterations has no argument", () => {
      expect(() => parseArgs("fix bug --max-iterations")).toThrow("--max-iterations requires a number argument");
    });

    it("should throw if --max-iterations argument is not a valid number", () => {
      expect(() => parseArgs("fix bug --max-iterations NaN")).toThrow("--max-iterations must be a non-negative integer, got: NaN");
      expect(() => parseArgs("fix bug --max-iterations foo")).toThrow("--max-iterations must be a non-negative integer, got: foo");
    });

    it("should throw if --max-iterations argument is negative", () => {
      expect(() => parseArgs("fix bug --max-iterations -5")).toThrow("--max-iterations must be a non-negative integer, got: -5");
    });

    it("should throw if --completion-promise has no argument", () => {
      expect(() => parseArgs("fix bug --completion-promise")).toThrow("--completion-promise requires a text argument");
    });
  });

  describe("happy paths", () => {
    it("should parse a basic prompt", () => {
      const result = parseArgs("Build a REST API");
      expect(result).toEqual({
        prompt: "Build a REST API",
        maxIterations: 0,
        completionPromise: null
      });
    });

    it("should parse a prompt with max-iterations", () => {
      const result = parseArgs("Fix the auth bug --max-iterations 10");
      expect(result).toEqual({
        prompt: "Fix the auth bug",
        maxIterations: 10,
        completionPromise: null
      });
    });

    it("should parse a prompt with completion-promise", () => {
      const result = parseArgs('Refactor the cache layer --completion-promise "ALL TESTS PASS"');
      expect(result).toEqual({
        prompt: "Refactor the cache layer",
        maxIterations: 0,
        completionPromise: "ALL TESTS PASS"
      });
    });

    it("should parse single quotes for completion-promise", () => {
      const result = parseArgs("Refactor the cache layer --completion-promise 'ALL TESTS PASS'");
      expect(result).toEqual({
        prompt: "Refactor the cache layer",
        maxIterations: 0,
        completionPromise: "ALL TESTS PASS"
      });
    });

    it("should parse both max-iterations and completion-promise together", () => {
      const result = parseArgs('/ralph-loop Build a REST API --completion-promise "DONE" --max-iterations 20');
      // The original code in parseArgs keeps '/ralph-loop' if provided in the argsStr.
      // However, usually the command handler strips it. parseArgs just receives what's passed to it.
      expect(result).toEqual({
        prompt: "/ralph-loop Build a REST API",
        maxIterations: 20,
        completionPromise: "DONE"
      });
    });
  });
});
