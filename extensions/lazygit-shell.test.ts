import { expect, test } from "bun:test";
import { parseArgs } from "./lazygit-shell";

test("parseArgs handles normal command", () => {
	expect(parseArgs("lazygit status")).toEqual(["lazygit", "status"]);
});

test("parseArgs handles multiple spaces", () => {
	expect(parseArgs("lazygit   commit   -m   message")).toEqual(["lazygit", "commit", "-m", "message"]);
});

test("parseArgs handles double quotes", () => {
	expect(parseArgs('lazygit commit -m "hello world"')).toEqual(["lazygit", "commit", "-m", "hello world"]);
});

test("parseArgs handles single quotes", () => {
	expect(parseArgs("lazygit commit -m 'hello world'")).toEqual(["lazygit", "commit", "-m", "hello world"]);
});

test("parseArgs handles escaped quotes", () => {
	expect(parseArgs('lazygit commit -m \\"hello\\"')).toEqual(["lazygit", "commit", "-m", '"hello"']);
});

test("parseArgs handles escaped spaces", () => {
	expect(parseArgs("lazygit commit -m hello\\ world")).toEqual(["lazygit", "commit", "-m", "hello world"]);
});

test("parseArgs handles empty command", () => {
	expect(parseArgs("")).toEqual([]);
});

test("parseArgs handles only spaces", () => {
	expect(parseArgs("   ")).toEqual([]);
});
