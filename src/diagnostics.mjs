import { versions } from "node:process";

/**
 * Runs a comprehensive health check of the MinAgent environment.
 */
export async function runDoctorCheck({ config, workspaceAccess, mcpConnections, skillsMode }) {
	const checks = [];

	// 1. Node Version
	const nodeVersion = versions.node;
	const major = Number(nodeVersion.split(".")[0]);
	checks.push({
		label: "Node.js Version",
		status: major >= 22 ? "ok" : "error",
		message: major >= 22 ? `v${nodeVersion} (>=22 required)` : `v${nodeVersion} (requires >=22)`,
	});

	// 2. Configuration Integrity
	try {
		if (!config.model) throw new Error("Missing OPENAI_MODEL");
		if (!config.endpoint) throw new Error("Missing Endpoint");
		checks.push({ label: "Configuration", status: "ok", message: `Model ${config.model} · ${new URL(config.endpoint).host}` });
	} catch (e) {
		checks.push({ label: "Configuration", status: "error", message: e.message });
	}

	// 3. Workspace Access
	try {
		await workspaceAccess.listDirectory({ path: "." });
		checks.push({ label: "Workspace", status: "ok", message: `Root accessible: ${config.workspaceName}` });
	} catch (e) {
		checks.push({ label: "Workspace", status: "error", message: `Cannot list root: ${e.message}` });
	}

	// 4. MCP Status
	if (config.mcpMode !== "off") {
		const servers = mcpConnections.servers ?? [];
		const connected = servers.filter((entry) => entry.status === "connected");
		const failed = servers.filter((entry) => entry.status === "failed");
		const toolCount = mcpConnections.toolLookup?.size ?? 0;
		checks.push({
			label: "MCP Servers",
			status: servers.length > 0 ? (failed.length > 0 ? "warn" : "ok") : "info",
			message: `${connected.length}/${servers.length} connected, ${toolCount} tools exposed${failed.length > 0 ? `, ${failed.length} failed: ${failed.map((entry) => entry.name).join(", ")}` : ""}`,
		});
	} else {
		checks.push({ label: "MCP", status: "info", message: "Disabled (MCP_MODE=off)" });
	}

	// 5. Skills Status
	if (skillsMode !== "off") {
		checks.push({ label: "Skills", status: "info", message: `Mode: ${skillsMode}` });
	} else {
		checks.push({ label: "Skills", status: "info", message: "Disabled" });
	}

	// 6. Terminal Safety
	checks.push({
		label: "Terminal Mode",
		status: config.terminalMode === "auto" ? "warn" : "ok",
		message: `Mode: ${String(config.terminalMode).toUpperCase()} (${config.terminalMode === "auto" ? "commands run without approval" : "commands require approval or are disabled"})`,
	});

	return checks;
}

/**
 * Generates a formatted string for the /status command.
 */
export function getStatusReport({ model, contextWindow, usedTokens, workspaceName, mcpStats, terminalMode, skillsMode, agentMode }) {
	const percent = contextWindow > 0 ? ((usedTokens / contextWindow) * 100).toFixed(1) : "0.0";
	const barLength = 20;
	const filled = Math.max(0, Math.min(barLength, Math.round((Number(percent) / 100) * barLength)));
	const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

	return [
		`Session Mode: ${agentMode.effective.toUpperCase()}`,
		`Model: ${model}`,
		`Context: ${usedTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens (${percent}% ${bar})`,
		`Workspace: ${workspaceName}`,
		`MCP: ${mcpStats.servers} servers / ${mcpStats.tools} tools`,
		`Terminal: ${terminalMode.toUpperCase()}`,
		`Skills: ${skillsMode.toUpperCase()}`,
	].join("\n");
}
