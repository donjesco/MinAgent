/**
 * AgentSession - Manages a single agent conversation session
 *
 * Tracks messages, tool history, and session metadata.
 * UI should not manipulate the history directly.
 */

export class AgentSession {
	constructor(options = {}) {
		this.id = options.id || crypto.randomUUID?.() || `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
		this.created = options.created ?? new Date().toISOString();
		this.updated = this.created;

		this.model = options.model ?? null;
		this.workspace = options.workspace ?? null;
		this.mode = options.mode ?? "build";

		this.messages = options.messages ?? [{ role: "system", content: "" }];
		this.toolHistory = options.toolHistory ?? [];
		this.summary = options.summary ?? null;
		this.turnId = options.turnId ?? 0;

		this.isClosed = false;
	}

	// Add a message to the session
	addMessage(role, content, metadata = {}) {
		this.messages.push({ role, content, metadata });
		this.updated = new Date().toISOString();
	}

	// Add a system message
	addSystemMessage(content, metadata = {}) {
		this.addMessage("system", content, { type: "system", ...metadata });
	}

	// Add a user message
	addUserMessage(content, metadata = {}) {
		this.addMessage("user", content, { type: "user", ...metadata });
	}

	// Add an assistant message
	addAssistantMessage(content, metadata = {}) {
		this.addMessage("assistant", content, { type: "assistant", ...metadata });
	}

	// Record a tool call
	recordToolCall(toolName, argumentsObj, result, metadata = {}) {
		this.toolHistory.push({
			id: crypto.randomUUID?.() || `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			tool: toolName,
			arguments: argumentsObj,
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			status: "completed",
			result: result,
			error: null,
			retryCount: metadata.retryCount ?? 0,
			...metadata,
		});
	}

	recordToolCallStart(toolName, argumentsObj) {
		const id = crypto.randomUUID?.() || `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
		this.toolHistory.push({
			id,
			tool: toolName,
			arguments: argumentsObj,
			startedAt: new Date().toISOString(),
			endedAt: null,
			status: "running",
			result: null,
			error: null,
			retryCount: 0,
		});
		return id;
	}

	recordToolCallError(toolName, error) {
		const tool = this.toolHistory[this.toolHistory.length - 1];
		if (tool) {
			tool.endedAt = new Date().toISOString();
			tool.status = "error";
			tool.error = error;
			tool.retryCount = (tool.retryCount ?? 0) + 1;
		}
	}

	// Close the session
	close(summary = null) {
		this.summary = summary ?? this.summary;
		this.isClosed = true;
		this.updated = new Date().toISOString();
	}

	// Get statistics
	getStats() {
		const messageCount = this.messages.length;
		const toolCallCount = this.toolHistory.length;
		const errorCount = this.toolHistory.filter(t => t.status === "error").length;

		return {
			id: this.id,
			created: this.created,
			updated: this.updated,
			model: this.model,
			workspace: this.workspace,
			mode: this.mode,
			messageCount,
			toolCallCount,
			errorCount,
			isClosed: this.isClosed,
		};
	}

	// Get context for model (excluding sensitive data)
	getContextForModel(maxMessages = null, maxTools = null) {
		const messages = maxMessages !== null
			? this.messages.slice(-maxMessages)
			: this.messages;

		const tools = maxTools !== null
			? this.toolHistory.slice(-maxTools)
			: this.toolHistory;

		return {
			session: {
				id: this.id,
				model: this.model,
				workspace: this.workspace,
				mode: this.mode,
			},
			messages,
			tools,
		};
	}
}

// Factory function
export function createSession(options = {}) {
	return new AgentSession(options);
}

export default AgentSession;
