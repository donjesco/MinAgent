#!/usr/bin/env node
/**
 * MinAgent - Installation Script
 *
 * Automated installation script for MinAgent.
 * Verifies Node.js version, creates default configuration,
 * and runs health checks.
 *
 * Usage:
 *   node scripts/install.mjs
 *
 * Exit codes:
 *   0 - Installation successful
 *   1 - Installation failed
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(dirname(__filename));
const root = join(__dirname, "..");

// Required Node.js version
const REQUIRED_NODE_VERSION = "22.0.0";

/**
 * Check Node.js version
 */
function checkNodeVersion() {
	const [major, minor] = process.versions.node
		.split(".")
		.map((v) => parseInt(v, 10));

	if (major < 22 || (major === 22 && minor < 0)) {
		console.error(`❌ Node.js ${REQUIRED_NODE_VERSION}+ required. Found: ${process.versions.node}`);
		return false;
	}

	console.log(`✓ Node.js ${process.versions.node} detected`);
	return true;
}

/**
 * Check npm availability
 */
async function checkNpm() {
	try {
		const { execSync } = await import("node:child_process");
		execSync("npm --version", { stdio: "pipe" });
		console.log("✓ npm available");
		return true;
	} catch {
		console.error("❌ npm not found in PATH");
		return false;
	}
}

/**
 * Create .env if it doesn't exist
 */
async function createEnvFile() {
	const envPath = join(root, ".env");

	if (existsSync(envPath)) {
		console.log("✓ .env already exists");
		return;
	}

	const envExamplePath = join(__dirname, "..", ".env.example");
	let envExample;

	try {
		envExample = readFileSync(envExamplePath, "utf8");
	} catch {
		console.warn("⚠️  .env.example not found, creating default .env");
		writeFileSync(envPath, "# MinAgent Configuration\n# Edit this file with your settings\n\n# See .env.example for full documentation\nTERMINAL_MODE=ask\nSKILLS_MODE=ask\nMCP_MODE=ask\nMCP_MAX_TOOLS=50\n");
		return;
	}

	// Replace placeholders
	const envContent = envExample
		.replace(/tu_api_key_aqui/g, "your_api_key_here")
		.replace(/tu_model/g, "your_model");

	writeFileSync(envPath, envContent);
	console.log("✓ Created .env from .env.example");
}

/**
 * Check workspace access
 */
async function checkWorkspace() {
	const { listDirectory } = await import("../src/workspace.mjs");

	try {
		const files = listDirectory(root, 10);
		console.log(`✓ Workspace accessible (${files.length} entries)`);
		return true;
	} catch (error) {
		console.error(`❌ Workspace access failed: ${error.message}`);
		return false;
	}
}

/**
 * Run health checks
 */
async function runDoctor() {
	console.log("\nRunning health checks...");
	const { runDoctor: runDoctorFn } = await import("../src/doctor.mjs");

	try {
		await runDoctorFn();
		console.log("✓ Health checks passed\n");
		return true;
	} catch (error) {
		console.error(`❌ Health checks failed: ${error.message}\n`);
		return false;
	}
}

/**
 * Main installation process
 */
async function main() {
	console.log("=".repeat(60));
	console.log("MinAgent Installation");
	console.log("=".repeat(60));
	console.log();

	const results = [];

	// Step 1: Check Node.js
	console.log("Step 1: Checking Node.js version...");
	results.push(checkNodeVersion());
	console.log();

	// Step 2: Check npm
	console.log("Step 2: Checking npm...");
	results.push(checkNpm());
	console.log();

	// Step 3: Create .env
	console.log("Step 3: Creating configuration...");
	createEnvFile();
	console.log();

	// Step 4: Check workspace
	console.log("Step 4: Checking workspace access...");
	results.push(await checkWorkspace());
	console.log();

	// Summary
	console.log("=".repeat(60));
	const passed = results.filter((r) => r).length;
	const total = results.length;

	if (passed === total) {
		console.log(`✅ Installation successful! (${passed}/${total} checks passed)`);
		console.log();
		console.log("Next steps:");
		console.log("  1. Edit .env with your OpenAI configuration");
		console.log("  2. Configure MCP servers in .minagent/mcp.json");
		console.log("  3. Run: npm run doctor");
		console.log("  4. Start: npm run start");
		console.log();
		process.exit(0);
	} else {
		console.error(`❌ Installation failed! (${passed}/${total} checks passed)`);
		console.error();
		console.error("Please fix the issues above and try again.");
		console.error();
		console.error("Or run: npm run doctor");
		process.exit(1);
	}
}

// Run installation
main().catch((error) => {
	console.error("Installation failed:", error);
	process.exit(1);
});
