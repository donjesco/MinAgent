/**
 * AppState - Central application state management
 *
 * Manages shared state across the application lifecycle.
 * Avoids global mutable variables when possible.
 */

export const AppState = {
	session: {
		id: null,
		created: null,
		updated: null,
		model: null,
		workspace: null,
		summary: null,
		messages: [],
	},

	ui: {
		mode: null,
		colorEnabled: false,
		animationEnabled: true,
		theme: "default",
	},

	model: {
		name: null,
		contextWindow: 262144,
		inputModalities: ["text"],
		capabilities: {},
	},

	context: {
		used: 0,
		limit: 262144,
		reserved: 16384,
		compactionBudget: null,
	},

	workspace: {
		name: null,
		path: null,
		files: [],
		evidenceLedger: null,
	},

	tools: {
		registry: null,
		available: [],
		disabled: [],
	},

	mcp: {
		servers: [],
		connections: null,
		tools: [],
		policy: null,
	},

	permissions: {
		terminal: "ask",
		skills: "off",
		mcp: "off",
		delete: "ask",
	},

	lifecycle: {
		shutdownScheduled: false,
		turnId: 0,
	},
};

// Methods to manipulate state safely

export function setSession(sessionData) {
	Object.assign(AppState.session, sessionData);
	 AppState.session.updated = new Date().toISOString();
}

export function getSession() {
	return AppState.session;
}

export function setMode(mode) {
	 AppState.ui.mode = mode;
}

export function getMode() {
	return AppState.ui.mode;
}

export function setModel(modelData) {
	Object.assign(AppState.model, modelData);
}

export function getModel() {
	return AppState.model;
}

export function updateContext(used, limit) {
	AppState.context.used = used;
	AppState.context.limit = limit;
}

export function getContextUsage() {
	const total = AppState.context.used + AppState.context.reserved;
	return {
		used: AppState.context.used,
		limit: AppState.context.limit,
		percent: total / AppState.context.limit,
	};
}

export function setWorkspace(workspaceData) {
	Object.assign(AppState.workspace, workspaceData);
}

export function getWorkspace() {
	return AppState.workspace;
}

export function setToolRegistry(registry) {
	AppState.tools.registry = registry;
}

export function getToolRegistry() {
	return AppState.tools.registry;
}

export function setPermissions(permissions) {
	Object.assign(AppState.permissions, permissions);
}

export function getPermissions() {
	return AppState.permissions;
}

export function startTurn() {
	AppState.lifecycle.turnId++;
	return AppState.lifecycle.turnId;
}

export function getTurnId() {
	return AppState.lifecycle.turnId;
}

export function scheduleShutdown() {
	AppState.lifecycle.shutdownScheduled = true;
}

export function isShutdownScheduled() {
	return AppState.lifecycle.shutdownScheduled;
}

// Reset state (for testing/new session)
export function resetState() {
	Object.keys(AppState).forEach(key => {
		if (typeof AppState[key] === "object" && AppState[key] !== null) {
			Object.assign(AppState[key], AppState[key].constructor?.prototype || {});
		} else {
			AppState[key] = null;
		}
	});
	AppState.lifecycle.turnId = 0;
	AppState.lifecycle.shutdownScheduled = false;
}

export default AppState;
