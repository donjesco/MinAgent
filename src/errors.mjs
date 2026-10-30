/**
 * Error Hierarchy for MinAgent
 *
 * Provides typed errors for better debugging, UI handling, and recovery.
 * Each error has: code, message, cause, retryable, userSafe, details
 */

// Base class
export class MinAgentError extends Error {
	constructor(message, options = {}) {
		super(message);
		this.name = this.constructor.name;
		this.code = options.code || this.constructor.DEFAULT_CODE || "MINAGENT_ERROR";
		this.cause = options.cause;
		this.retryable = options.retryable ?? false;
		this.userSafe = options.userSafe ?? true;
		this.details = { message, ...(options.details || {}) };

		// Preserve stack trace
		Error.captureStackTrace(this, this.constructor);
	}
}

// Configuration errors
export class ConfigurationError extends MinAgentError {
	static DEFAULT_CODE = "CFG_INVALID";
	constructor(message, options = {}) {
		super(message, options);
	}
}

export class NodeVersionError extends ConfigurationError {
	static DEFAULT_CODE = "CFG_NODE_VERSION";
	constructor(installedVersion, requiredVersion, options = {}) {
		super(`MinAgent requires Node.js ${requiredVersion} or later. Installed: ${installedVersion}.`, {
			details: { installed: installedVersion, required: requiredVersion },
			...options,
		});
	}
}

export class ConfigurationMissingError extends ConfigurationError {
	constructor(key, options = {}) {
		super(`Configuration key '${key}' is missing or invalid.`, {
			details: { key },
			...options,
		});
	}
}

// Provider/Model errors
export class ProviderError extends MinAgentError {
	static DEFAULT_CODE = "PROVIDER_UNAVAILABLE";
	constructor(message, options = {}) {
		super(message, options);
	}
}

export class ModelNotFoundError extends ProviderError {
	static DEFAULT_CODE = "MODEL_NOT_FOUND";
	constructor(modelName, availableModels = [], options = {}) {
		super(`Model '${modelName}' not found.`, {
			details: { model: modelName, available: availableModels },
			...options,
		});
	}
}

export class ModelTimeoutError extends ProviderError {
	static DEFAULT_CODE = "PROVIDER_TIMEOUT";
	constructor(message, options = {}) {
		super(message, {
			retryable: true,
			...options,
		});
	}
}

// Tool errors
export class ToolError extends MinAgentError {
	static DEFAULT_CODE = "TOOL_ERROR";
	constructor(message, toolName, options = {}) {
		super(message, {
			code: `TOOL_${toolName.toUpperCase().replace(/[^A-Z]/g, '_')}`,
			details: { tool: toolName },
			...options,
		});
	}
}

export class PermissionDeniedError extends ToolError {
	static DEFAULT_CODE = "TOOL_PERMISSION_DENIED";
	constructor(toolName, reason, options = {}) {
		super(`Permission denied for ${toolName}: ${reason}`, toolName, {
			code: "TOOL_PERMISSION_DENIED",
			details: { tool: toolName, reason },
			...options,
		});
	}
}

export class RepeatedCallError extends ToolError {
	static DEFAULT_CODE = "TOOL_REPEATED_CALL";
	constructor(toolName, argumentsString, options = {}) {
		super(`Repeated call to ${toolName} detected`, toolName, {
			code: "TOOL_REPEATED_CALL",
			details: { tool: toolName, args: argumentsString },
			...options,
		});
	}
}

// Workspace errors
export class WorkspaceError extends MinAgentError {
	static DEFAULT_CODE = "WORKSPACE_OUTSIDE_ROOT";
	constructor(message, options = {}) {
		super(message, options);
	}
}

export class EvidenceStaleError extends WorkspaceError {
	static DEFAULT_CODE = "WORKSPACE_EVIDENCE_STALE";
	constructor(filePath, options = {}) {
		super(`Evidence for '${filePath}' is stale or missing.`, {
			details: { file: filePath },
			...options,
		});
	}
}

// MCP errors
export class McpError extends MinAgentError {
	static DEFAULT_CODE = "MCP_CONNECTION_FAILED";
	constructor(message, options = {}) {
		super(message, options);
	}
}

export class McpTimeoutError extends McpError {
	static DEFAULT_CODE = "MCP_TIMEOUT";
	constructor(serverName, options = {}) {
		super(`MCP server '${serverName}' timed out.`, {
			retryable: true,
			details: { server: serverName },
			...options,
		});
	}
}

export class McpSchemaError extends McpError {
	static DEFAULT_CODE = "MCP_SCHEMA_INVALID";
	constructor(serverName, message, options = {}) {
		super(`Invalid schema from MCP server '${serverName}': ${message}`, {
			details: { server: serverName },
			...options,
		});
	}
}

// Terminal errors
export class TerminalError extends MinAgentError {
	static DEFAULT_CODE = "TERMINAL_TIMEOUT";
	constructor(message, options = {}) {
		super(message, options);
	}
}

// Context errors
export class ContextError extends MinAgentError {
	static DEFAULT_CODE = "CONTEXT_LIMIT";
	constructor(message, options = {}) {
		super(message, options);
	}
}

// Validation errors
export class ValidationError extends MinAgentError {
	static DEFAULT_CODE = "VALIDATION_ERROR";
	constructor(message, options = {}) {
		super(message, {
			...options,
		});
	}
}

// Export all errors
export default {
	MinAgentError,
	ConfigurationError,
	NodeVersionError,
	ConfigurationMissingError,
	ProviderError,
	ModelNotFoundError,
	ModelTimeoutError,
	ToolError,
	PermissionDeniedError,
	RepeatedCallError,
	WorkspaceError,
	EvidenceStaleError,
	McpError,
	McpTimeoutError,
	McpSchemaError,
	TerminalError,
	ContextError,
	ValidationError,
};
