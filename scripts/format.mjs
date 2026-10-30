#!/usr/bin/env node
/**
 * MinAgent - Formatter Script
 *
 * Dependency-free formatting tool that checks and fixes:
 * - Trailing whitespace
 * - Missing final newlines
 *
 * Features:
 * - Reads all .mjs files in src/, tests/, scripts/
 * - Normalizes line endings and removes trailing spaces
 * - Ensures files end with a single newline
 * - Can auto-fix with --write flag
 *
 * Usage:
 *   node scripts/format.mjs              # Check formatting
 *   node scripts/format.mjs --write      # Auto-fix issues
 *
 * Exit codes:
 *   0 - All files clean
 *   1 - Files need formatting (or --write not provided)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["src", "tests", "scripts"];
const write = process.argv.includes("--write");

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

const offenders = [];

for (const file of files) {
	const relative = file.slice(root.length + 1).replace(/\\/g, "/");
	const original = readFileSync(file, "utf8");
	const normalized = original.replace(/[ \t]+(?=\r?\n)/g, "").replace(/\r?\n?$/, "\n");
	if (normalized === original) continue;
	if (write) writeFileSync(file, normalized);
	else offenders.push(relative);
}

if (write) {
	console.log(`✓ formatting applied where needed across ${files.length} files.`);
} else if (offenders.length > 0) {
	for (const file of offenders) console.error(`✗ ${file}: trailing whitespace or missing final newline`);
	console.error(`\n${offenders.length} file${offenders.length === 1 ? "" : "s"} need formatting. Run: node scripts/format.mjs --write`);
	process.exit(1);
} else {
	console.log(`✓ ${files.length} files format clean.`);
}
