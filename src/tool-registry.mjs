/**
 * Tool Registry for MinAgent
 *
 * Centralizes tool definitions, metadata, permission policy, and availability
 * filtering so the agent engine and UI can query tools without knowing their
 * implementation details.
 *
 * Every entry declares:
 *   definition — the OpenAI-compatible function schema sent to the model
 *   metadata   — { category, permission, risk } internal classification
 *
 * The registry answers:
 *   - Which tools exist?
 *   - Which permissions do they need?
 *   - What risk do they carry?
 *   - Are they available for the current mode and permission policy?
 */

import { toolsForMode } from "./agent-mode.mjs";

export const TOOL_RISK = {
	LOW: "low",
	MEDIUM: "medium",
	HIGH: "high",
	CRITICAL: "critical",
	EXTERNAL: "external",
};

export const TOOL_PERMISSION = {
	NONE: "none",       // Read-only or safe operations
	WORKSPACE: "workspace", // Mutates workspace files
	TERMINAL: "terminal",   // Requires TERMINAL_MODE check
	MCP: "mcp",             // Requires MCP_MODE check
	SKILLS: "skills",       // Requires SKILLS_MODE check
};

// Maps a tool permission to the policy key that can disable it entirely.
const PERMISSION_POLICY_KEYS = {
	terminal: "terminalMode",
	mcp: "mcpMode",
	skills: "skillsMode",
};

export class ToolRegistry {
	constructor(policy = {}) {
		this.policy = {
			terminalMode: "auto",
			mcpMode: "auto",
			skillsMode: "auto",
			...policy,
		};
		this.tools = new Map();
	}

	/**
	 * Updates the permission policy (terminalMode / mcpMode / skillsMode).
	 * Tools whose permission maps to an "off" policy are never advertised.
	 */
	setPolicy(policy = {}) {
		for (const [key, value] of Object.entries(policy)) {
			if (value !== undefined) this.policy[key] = value;
		}
		return this;
	}

	/**
	 * Registers a single { definition, metadata } entry.
	 * Re-registering a name replaces the previous entry.
	 */
	register(entry) {
		const name = entry?.definition?.function?.name;
		if (typeof name !== "string" || !name.trim()) {
			throw new Error("A registered tool must declare definition.function.name.");
		}
		const metadata = {
			category: "workspace",
			permission: TOOL_PERMISSION.NONE,
			risk: TOOL_RISK.LOW,
			...(entry.metadata ?? {}),
			name,
		};
		this.tools.set(name, { definition: entry.definition, metadata });
		return this;
	}

	/** Registers many entries in order. */
	registerMany(entries = []) {
		for (const entry of entries) this.register(entry);
		return this;
	}

	/** Removes a tool by name. Returns true when an entry was removed. */
	unregister(name) {
		return this.tools.delete(name);
	}

	/** Metadata (category / permission / risk) for a tool, or null when unknown. */
	getToolMetadata(name) {
		return this.tools.get(name)?.metadata ?? null;
	}

	/** True when the permission policy does not disable this tool's permission. */
	isPermitted(metadata) {
		const policyKey = PERMISSION_POLICY_KEYS[metadata?.permission];
		return !policyKey || this.policy[policyKey] !== "off";
	}

	/**
	 * Definitions the model may see for the given mode ("plan" | "build").
	 * PLAN is read-only: only read_file, list_directory and search_files survive
	 * (single source of truth: agent-mode.mjs), and permission-gated tools are
	 * filtered by the policy in every mode.
	 */
	getActiveDefinitions(mode = "build") {
		const definitions = [];
		for (const entry of this.tools.values()) {
			if (this.isPermitted(entry.metadata)) definitions.push(entry.definition);
		}
		return toolsForMode(definitions, mode);
	}

	/** Snapshot of every registered tool for diagnostics (/tools, /mcp, /status). */
	list() {
		return [...this.tools.values()].map(({ definition, metadata }) => ({
			name: definition.function.name,
			metadata: { ...metadata },
		}));
	}
}
