#!/usr/bin/env node
/**
 * MinAgent - Linter Script
 *
 * Dependency-free lint tool that performs syntax checking and enforces
 * coding standards without external dependencies.
 *
 * Features:
 * - Syntax validation using Node.js --check
 * - Detects 'debugger' statements
 * - Enforces 'const'/'let' over 'var'
 * - Checks src/, tests/, scripts/ directories
 *
 * Usage:
 *   node scripts/lint.mjs              # Full lint (syntax + rules)
 *   node scripts/lint.mjs --syntax-only  # Only syntax check
 *
 * Exit codes:
 *   0 - All files clean
 *   1 - Errors found
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["src", "tests", "scripts"];
const syntaxOnly = process.argv.includes("--syntax-only");

function collect(directory) {
	const files = [];
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) files.push(...collect(path));
		else if (entry.endsWith(".mjs") && !entry.endsWith(".backup.mjs")) files.push(path);
	}
	return files;
}

const files = targets.flatMap((target) => {
	try { return collect(join(root, target)); } catch { return []; }
});

const errors = [];

for (const file of files) {
	const relative = file.slice(root.length + 1).replace(/\\/g, "/");
	const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
	if (check.status !== 0) {
		errors.push(`${relative}: syntax error\n${(check.stderr || check.stdout || "").trim()}`);
		continue;
	}
	const lines = readFileSync(file, "utf8").split(/\r?\n/);
	if (syntaxOnly) continue;
	lines.forEach((line, index) => {
		const at = `${relative}:${index + 1}`;
		if (/(^|\s)debugger\s*;/.test(line)) errors.push(`${at}: unexpected 'debugger' statement`);
		if (/(^|\s)var\s+[A-Za-z_$]/.test(line)) errors.push(`${at}: use 'const' or 'let' instead of 'var'`);
	});
}

if (errors.length > 0) {
	for (const error of errors) console.error(`✗ ${error}`);
	console.error(`\n${errors.length} problem${errors.length === 1 ? "" : "s"} found in ${files.length} files.`);
	process.exit(1);
}
console.log(`✓ ${files.length} files lint clean.`);
