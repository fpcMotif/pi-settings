import { expect, test } from "bun:test";
import { tokenize } from "./lazygit-shell";

test("tokenize handles simple commands", () => {
	expect(tokenize("lazygit")).toEqual(["lazygit"]);
	expect(tokenize("lg")).toEqual(["lg"]);
	expect(tokenize("lazygit status")).toEqual(["lazygit", "status"]);
});

test("tokenize handles whitespace", () => {
	expect(tokenize("  lazygit   status  ")).toEqual(["lazygit", "status"]);
	expect(tokenize("\tlazygit\tstatus\t")).toEqual(["lazygit", "status"]);
});

test("tokenize handles single quotes", () => {
	expect(tokenize("lazygit 'my branch'")).toEqual(["lazygit", "my branch"]);
	expect(tokenize("lazygit 'commit message'")).toEqual(["lazygit", "commit message"]);
	// Single quotes do not escape backslashes or double quotes
	expect(tokenize("lazygit 'some \"quoted\" text'")).toEqual(["lazygit", "some \"quoted\" text"]);
	expect(tokenize("lazygit 'back\\slash'")).toEqual(["lazygit", "back\\slash"]);
});

test("tokenize handles double quotes", () => {
	expect(tokenize('lazygit "my branch"')).toEqual(["lazygit", "my branch"]);
	// Double quotes can contain escaped characters
	expect(tokenize('lazygit "some \\"quoted\\" text"')).toEqual(["lazygit", 'some "quoted" text']);
	// Double quotes can contain single quotes
	expect(tokenize('lazygit "some \'quoted\' text"')).toEqual(["lazygit", "some 'quoted' text"]);
});

test("tokenize handles backslash escaping outside quotes", () => {
	expect(tokenize("lazygit my\\ branch")).toEqual(["lazygit", "my branch"]);
	expect(tokenize("lazygit my\\'branch")).toEqual(["lazygit", "my'branch"]);
	expect(tokenize('lazygit my\\"branch')).toEqual(["lazygit", 'my"branch']);
});

test("tokenize handles adjacent quotes and text", () => {
	expect(tokenize("lazygit 'my '\"branch\"")).toEqual(["lazygit", "my branch"]);
	expect(tokenize("lazygit prefix' middle 'suffix")).toEqual(["lazygit", "prefix middle suffix"]);
});
