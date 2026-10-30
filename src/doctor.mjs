#!/usr/bin/env node
// Non-interactive environment health check: `npm run doctor`.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfiguration } from "./config.mjs";
import { createWorkspaceAccess } from "./workspace.mjs";
import { connectMcpServers } from "./mcp.mjs";
import { runDoctorCheck } from "./diagnostics.mjs";

const appDirectory = dirname(fileURLToPath(import.meta.url));

const marks = { ok: "✓", warn: "⚠", error: "✗", info: "→" };
let exitCode = 0;

try {
	const config = await loadConfiguration({ appDirectory });
	const workspaceAccess = createWorkspaceAccess(config.rootDirectory, config.workspaceName);
	let mcpConnections = { servers: [], toolLookup: new Map(), warnings: [], close: async () => {} };
	if (config.mcpMode !== "off") {
		try {
			mcpConnections = await connectMcpServers({
				configPath: join(config.applicationRoot, ".minagent", "mcp.json"),
				defaultCwd: config.rootDirectory,
				maxTools: config.mcpMaxTools,
				requestTimeoutMs: config.mcpRequestTimeout,
				connectTimeoutMs: config.mcpConnectTimeout,
				httpNetwork: config.mcpHttpNetwork,
			});
		} catch (error) {
			mcpConnections = { servers: [], toolLookup: new Map(), warnings: [error.message], close: async () => {} };
		}
	}
	const checks = await runDoctorCheck({
		config,
		workspaceAccess,
		mcpConnections,
		skillsMode: config.skillsMode,
	});
	console.log("MinAgent Doctor");
	console.log("─".repeat(48));
	for (const check of checks) {
		console.log(`${marks[check.status] ?? marks.info} ${check.label}: ${check.message}`);
		if (check.status === "error") exitCode = 1;
	}
	await mcpConnections.close?.();
} catch (error) {
	console.log(`${marks.error} Configuration: ${error.message}`);
	exitCode = 1;
}

process.exitCode = exitCode;
