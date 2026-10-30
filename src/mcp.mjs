import { spawn } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { terminateProcessTree } from "./processes.mjs";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2024-11-05", "2025-03-26", "2025-06-18", MCP_PROTOCOL_VERSION]);
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_POLICY = { attempts: 3, baseDelayMs: 500, maxDelayMs: 4_000 };
const DEFAULT_CIRCUIT_BREAKER = { threshold: 5, cooldownMs: 30_000 };
const MAX_MCP_TEXT_RESULT_CHARS = 48_000;
const MAX_MCP_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_MCP_IMAGE_COUNT = 4;
const MAX_MCP_CONFIG_BYTES = 1024 * 1024;
const MAX_MCP_SERVERS = 50;
const MAX_MCP_TOOLS = 50;
const MAX_MCP_SCHEMA_BYTES = 8 * 1024;
const MAX_MCP_TOTAL_TOOL_BYTES = 256 * 1024;
const MAX_MCP_TOOL_DESCRIPTION_CHARS = 1_500;
const MAX_MCP_GUIDANCE_CHARS = 8 * 1024;

// Transient failures may succeed on a retry; JSON-RPC application errors
// (invalid arguments, permission denied, schema errors) never do.
const TRANSIENT_ERROR_PATTERNS = [
	/timed out/i,
	/timeout/i,
	/fetch failed/i,
	/socket hang up/i,
	/ECONNREFUSED/i,
	/ECONNRESET/i,
	/EPIPE/i,
	/ENOTFOUND/i,
	/EAI_AGAIN/i,
	/ETIMEDOUT/i,
	/getaddrinfo/i,
	/MCP HTTP (?:408|425|429|5\d\d)/,
];

export function isTransientMcpError(error) {
	const message = String(error?.message ?? error ?? "");
	return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function retryDelayMs(policy, attempt) {
	const base = Math.min(policy.maxDelayMs, policy.baseDelayMs * 3 ** (attempt - 1));
	// ±25% jitter so parallel callers do not stampede the server.
	return Math.round(base * (0.75 + Math.random() * 0.5));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(operation, policy) {
	let lastError;
	for (let attempt = 0; attempt < policy.attempts; attempt += 1) {
		if (attempt > 0) await delay(retryDelayMs(policy, attempt));
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (!isTransientMcpError(error) || attempt >= policy.attempts - 1) throw error;
		}
	}
	throw lastError;
}

async function withTimeout(promise, ms, label) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms.`)), ms);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Per-server circuit breaker: CLOSED → OPEN → HALF_OPEN → CLOSED.
 * Only transient transport failures move it toward OPEN.
 */
export class CircuitBreaker {
	constructor({ threshold = DEFAULT_CIRCUIT_BREAKER.threshold, cooldownMs = DEFAULT_CIRCUIT_BREAKER.cooldownMs, now = Date.now } = {}) {
		this.threshold = threshold;
		this.cooldownMs = cooldownMs;
		this.now = now;
		this.failures = 0;
		this.openedAt = 0;
		this.state = "closed";
		this.probing = false;
	}

	assertAllowed(serverName = "server") {
		if (this.state === "open") {
			if (this.now() - this.openedAt >= this.cooldownMs) {
				this.state = "half_open";
				this.probing = false;
			} else {
				const remaining = this.cooldownMs - (this.now() - this.openedAt);
				throw new Error(`MCP ${serverName} circuit breaker is open after ${this.failures} transient failures; retry paused for ${remaining} ms.`);
			}
		}
		if (this.state === "half_open" && this.probing) {
			throw new Error(`MCP ${serverName} circuit breaker is testing recovery; wait for the probe to finish.`);
		}
		if (this.state === "half_open") this.probing = true;
	}

	recordSuccess() {
		this.failures = 0;
		this.openedAt = 0;
		this.probing = false;
		this.state = "closed";
	}

	recordFailure() {
		this.probing = false;
		this.failures += 1;
		if (this.state === "half_open" || this.failures >= this.threshold) {
			this.state = "open";
			this.openedAt = this.now();
		}
	}
}

function isLoopbackHost(hostname) {
	const host = String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "");
	return host === "localhost" || host === "::1" || /^127\./.test(host);
}

function normalizeRetryPolicy(retry) {
	const attempts = Number.isSafeInteger(retry?.attempts) && retry.attempts >= 1 && retry.attempts <= 10 ? retry.attempts : DEFAULT_RETRY_POLICY.attempts;
	const baseDelayMs = Number.isSafeInteger(retry?.baseDelayMs) && retry.baseDelayMs >= 0 ? retry.baseDelayMs : DEFAULT_RETRY_POLICY.baseDelayMs;
	return { attempts, baseDelayMs, maxDelayMs: DEFAULT_RETRY_POLICY.maxDelayMs };
}

function insecureTransportWarning(serverName, serverConfig) {
	if (serverTransport(serverConfig) !== "http") return null;
	try {
		const url = new URL(serverConfig.url);
		if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
			return `MCP server "${serverName}" uses plain HTTP to remote host ${url.hostname}; prefer HTTPS.`;
		}
	} catch {}
	return null;
}

function credentialHeaderWarning(serverName, serverConfig) {
	const headers = serverConfig?.headers;
	if (!headers || typeof headers !== "object" || Array.isArray(headers)) return null;
	for (const [name, value] of Object.entries(headers)) {
		if (/authorization|api[-_]?key|token|secret|password/i.test(name)
			&& typeof value === "string" && /^(?:bearer|token|basic|sk-|ghp_|github_pat_|xox[baprs]-)/i.test(value.trim())) {
			return `MCP server "${serverName}" stores a literal credential in "headers"; prefer "headersFromEnv" so secrets stay in the environment.`;
		}
	}
	return null;
}

export async function connectMcpServers({
	configPath,
	defaultCwd,
	maxTools = MAX_MCP_TOOLS,
	requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
	connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
	httpNetwork = "allow",
	retry,
	circuitBreaker,
}) {
	const retryPolicy = normalizeRetryPolicy(retry);
	const breakerOptions = {
		threshold: Number.isSafeInteger(circuitBreaker?.threshold) && circuitBreaker.threshold >= 1 ? circuitBreaker.threshold : DEFAULT_CIRCUIT_BREAKER.threshold,
		cooldownMs: Number.isSafeInteger(circuitBreaker?.cooldownMs) && circuitBreaker.cooldownMs >= 0 ? circuitBreaker.cooldownMs : DEFAULT_CIRCUIT_BREAKER.cooldownMs,
	};
	const clientOptions = { requestTimeoutMs, connectTimeoutMs, httpNetwork, serverName: "" };
	let config;
	try {
		const directory = await lstat(dirname(configPath));
		if (directory.isSymbolicLink() || !directory.isDirectory()) throw new Error("MCP configuration directory must be a regular directory.");
		const file = await lstat(configPath);
		if (file.isSymbolicLink() || !file.isFile() || file.nlink > 1) {
			throw new Error("MCP configuration must be a regular, unlinked file.");
		}
		if (file.size > MAX_MCP_CONFIG_BYTES) throw new Error(`MCP configuration exceeds ${MAX_MCP_CONFIG_BYTES} bytes.`);
		config = JSON.parse(await readFile(configPath, "utf8"));
	} catch (error) {
		if (error?.code === "ENOENT") return emptyConnections();
		return emptyConnections([`Could not load MCP configuration ${configPath}: ${error.message}`]);
	}
	if (!config || typeof config !== "object" || !config.mcpServers || typeof config.mcpServers !== "object" || Array.isArray(config.mcpServers)) {
		return emptyConnections([`MCP configuration must contain an object named "mcpServers": ${configPath}`]);
	}

	const clients = [];
	const warnings = [];
	const entries = Object.entries(config.mcpServers);
	if (entries.length > MAX_MCP_SERVERS) {
		return emptyConnections([`MCP configuration contains more than ${MAX_MCP_SERVERS} servers.`]);
	}
	const toolDefinitions = [];
	const toolLookup = new Map();
	const serverGuidance = [];
	const servers = [];
	const breakers = new Map();
	let totalToolDefinitionBytes = 0;
	let totalToolBudgetReached = false;

	for (let serverIndex = 0; serverIndex < entries.length; serverIndex += 1) {
		if (totalToolBudgetReached || toolDefinitions.length >= maxTools) {
			const remaining = entries.slice(serverIndex);
			const reason = totalToolBudgetReached ? "combined schema byte limit" : `${maxTools}-tool limit`;
			for (const [name, config] of remaining) {
				servers.push({ name, transport: serverTransport(config), status: "skipped", toolCount: 0, discovered: 0, reason });
			}
			if (remaining.length > 0) {
				warnings.push(`Skipping remaining MCP servers after the ${reason}: ${remaining.map(([name]) => name).join(", ")}.`);
			}
			break;
		}
		const [serverName, serverConfig] = entries[serverIndex];
		let client;
		try {
			const toolFilter = parseToolFilter(serverConfig, serverName);
			const securityWarning = credentialHeaderWarning(serverName, serverConfig) ?? insecureTransportWarning(serverName, serverConfig);
			if (securityWarning) warnings.push(securityWarning);
			client = await connectServerClient(serverConfig, defaultCwd, { ...clientOptions, serverName }, retryPolicy);
			const toolList = await client.listTools(toolFilter?.include ? Number.MAX_SAFE_INTEGER : maxTools);
			let remoteTools = toolList.tools;
			if (toolFilter) {
				// Intentional configuration: filter silently before the global quota.
				remoteTools = remoteTools.filter((tool) => {
					const toolName = typeof tool?.name === "string" ? tool.name : "";
					if (toolFilter.exclude?.has(toolName)) return false;
					if (toolFilter.include && !toolFilter.include.has(toolName)) return false;
					return true;
				});
			}
			if (toolList.truncated) warnings.push(`MCP server "${serverName}" returned more than ${maxTools} tools; only the first ${maxTools} were considered.`);
			clients.push(client);
			if (client.instructions) serverGuidance.push({ serverName, instructions: client.instructions });
			const toolsBefore = toolDefinitions.length;
			for (let toolIndex = 0; toolIndex < remoteTools.length; toolIndex += 1) {
				if (toolDefinitions.length >= maxTools) {
					const omitted = remoteTools.slice(toolIndex).map((tool) => tool?.name).filter((name) => typeof name === "string" && name);
					const omittedList = omitted.slice(0, 8).join(", ") + (omitted.length > 8 ? `, and ${omitted.length - 8} more` : "");
					warnings.push(`Ignoring additional MCP tools after the ${maxTools}-tool limit: ${omittedList}.`);
					totalToolBudgetReached = true;
					break;
				}
				const remoteTool = remoteTools[toolIndex];
				if (!remoteTool || typeof remoteTool.name !== "string" || !remoteTool.name.trim()) {
					warnings.push(`Ignoring an MCP tool with no valid name from server "${serverName}".`);
					continue;
				}
				const functionName = makeFunctionName(serverIndex, toolIndex, serverName, remoteTool.name);
				const parameters = remoteTool.inputSchema && typeof remoteTool.inputSchema === "object" && !Array.isArray(remoteTool.inputSchema)
					? remoteTool.inputSchema
					: { type: "object", properties: {} };
				try {
					if (parameters.type !== "object" || (parameters.properties !== undefined
						&& (!parameters.properties || typeof parameters.properties !== "object" || Array.isArray(parameters.properties)))) {
						throw new Error("inputSchema must describe an object with object properties.");
					}
					if (parameters.required !== undefined && (!Array.isArray(parameters.required)
						|| parameters.required.some((item) => typeof item !== "string"))) {
						throw new Error("inputSchema.required must be an array of strings.");
					}
					if (Buffer.byteLength(JSON.stringify(parameters), "utf8") > MAX_MCP_SCHEMA_BYTES) {
						throw new Error(`inputSchema exceeds ${MAX_MCP_SCHEMA_BYTES} bytes.`);
					}
				} catch (error) {
					warnings.push(`Ignoring MCP tool "${remoteTool.name}" from "${serverName}": ${error.message}`);
					continue;
				}
				const title = remoteTool.title || "No title";
				const desc = remoteTool.description || `Call the ${remoteTool.name} MCP tool.`;
				const description = (title + " " + desc).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, MAX_MCP_TOOL_DESCRIPTION_CHARS);
				const definition = {
					type: "function",
					function: {
						name: functionName,
						description: description + " (MCP server: " + serverName.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 128) + ".)",
						parameters,
					},
				};
				const definitionBytes = Buffer.byteLength(JSON.stringify(definition), "utf8");
				if (totalToolDefinitionBytes + definitionBytes > MAX_MCP_TOTAL_TOOL_BYTES) {
					warnings.push(`Ignoring additional MCP tools after reaching the ${MAX_MCP_TOTAL_TOOL_BYTES}-byte combined schema limit.`);
					totalToolBudgetReached = true;
					break;
				}
				toolDefinitions.push(definition);
				totalToolDefinitionBytes += definitionBytes;
				const breaker = breakers.get(serverName) ?? new CircuitBreaker(breakerOptions);
				breakers.set(serverName, breaker);
				toolLookup.set(functionName, { client, serverName, remoteToolName: remoteTool.name, retryPolicy, breaker });
			}
			servers.push({
				name: serverName,
				transport: serverTransport(serverConfig),
				status: "connected",
				toolCount: toolDefinitions.length - toolsBefore,
				discovered: remoteTools.length,
			});
		} catch (error) {
			await client?.close();
			warnings.push(`MCP server "${serverName}" could not be connected: ${error.message}`);
			servers.push({
				name: serverName,
				transport: serverTransport(serverConfig),
				status: "failed",
				toolCount: 0,
				discovered: 0,
				error: error.message,
			});
		}
	}

	return {
		clients,
		toolDefinitions,
		toolLookup,
		serverGuidance,
		servers,
		warnings,
		close: () => Promise.allSettled(clients.map((client) => client.close())),
	};
}

function emptyConnections(warnings = []) {
	return { clients: [], toolDefinitions: [], toolLookup: new Map(), serverGuidance: [], servers: [], warnings, close: async () => {} };
}

// Each attempt builds a fresh client so a dead stdio process or a broken
// HTTP session never blocks the retry. Non-transient failures never retry.
async function connectServerClient(serverConfig, defaultCwd, options, retryPolicy) {
	let lastError;
	for (let attempt = 0; attempt < retryPolicy.attempts; attempt += 1) {
		if (attempt > 0) await delay(retryDelayMs(retryPolicy, attempt));
		let client;
		try {
			client = createClient(serverConfig, defaultCwd, options);
			await withTimeout(client.connect(), options.connectTimeoutMs, `MCP initialize for "${options.serverName}"`);
			return client;
		} catch (error) {
			await client?.close().catch(() => {});
			lastError = error;
			if (!isTransientMcpError(error) || attempt >= retryPolicy.attempts - 1) throw error;
		}
	}
	throw lastError;
}

function serverTransport(serverConfig) {
	if (serverConfig && typeof serverConfig === "object" && !Array.isArray(serverConfig)) {
		if (typeof serverConfig.url === "string" && serverConfig.url.trim()) return "http";
		if (typeof serverConfig.command === "string" && serverConfig.command.trim()) return "stdio";
	}
	return "unknown";
}

function parseToolFilter(serverConfig, serverName) {
	const include = normalizeToolNameList(serverConfig?.enabledTools, `${serverName}.enabledTools`);
	const exclude = normalizeToolNameList(serverConfig?.disabledTools, `${serverName}.disabledTools`);
	if (!include && !exclude) return null;
	return { include, exclude };
}

function normalizeToolNameList(value, label) {
	if (value === undefined) return null;
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
		throw new Error(`${label} must be an array of non-empty strings.`);
	}
	return new Set(value.map((item) => item.trim()));
}

function createClient(config, defaultCwd, options = {}) {
	if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Server settings must be a JSON object.");
	if (typeof config.url === "string" && config.url.trim()) {
		return new McpHttpClient(config, options);
	}
	if (typeof config.command !== "string" || !config.command.trim()) {
		throw new Error("Set either a stdio server command or an HTTP server URL.");
	}
	const args = config.args ?? [];
	if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
		throw new Error("Server args must be an array of strings.");
	}
	const env = config.env ?? {};
	if (!env || typeof env !== "object" || Array.isArray(env) || Object.values(env).some((value) => typeof value !== "string")) {
		throw new Error("Server env must be an object containing string values.");
	}
	if (config.cwd !== undefined && typeof config.cwd !== "string") throw new Error("Server cwd must be a string.");
	const cwd = config.cwd ? resolve(defaultCwd, config.cwd) : defaultCwd;
	return new McpStdioClient(config.command, args, env, cwd, options);
}

function makeFunctionName(serverIndex, toolIndex, serverName, toolName) {
	const safeNames = `${serverName}_${toolName}`.replace(/[^A-Za-z0-9_-]/g, "_");
	return `mcp_${serverIndex}_${toolIndex}_${safeNames}`.slice(0, 64);
}

export function formatMcpContext(serverGuidance) {
	if (serverGuidance.length === 0) return "";
	let context = "MCP guidance:";
	for (const { serverName, instructions } of serverGuidance) {
		const safeName = String(serverName).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 128);
		const heading = "\n\n" + JSON.stringify(safeName) + ":\n";
		const remaining = MAX_MCP_GUIDANCE_CHARS - context.length - heading.length;
		if (remaining <= 0) break;
		const safeInstructions = String(instructions).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
		if (safeInstructions.length > remaining) {
			const marker = "\n[truncated]";
			const contentLimit = Math.max(0, remaining - marker.length);
			context += heading + safeInstructions.slice(0, contentLimit) + (remaining > marker.length ? marker : "");
			break;
		}
		context += heading + safeInstructions;
	}
	return context;
}

export async function executeMcpTool(functionName, args, toolLookup, imageEnabled) {
	const entry = toolLookup.get(functionName);
	if (!entry) throw new Error(`MCP tool is not available: ${functionName}`);
	const breaker = entry.breaker;
	breaker?.assertAllowed(entry.serverName);
	let result;
	try {
		result = await withRetry(() => entry.client.callTool(entry.remoteToolName, args), entry.retryPolicy ?? DEFAULT_RETRY_POLICY);
		breaker?.recordSuccess();
	} catch (error) {
		if (breaker && isTransientMcpError(error)) breaker.recordFailure();
		throw error;
	}
	const textParts = [];
	const images = [];
	for (const item of Array.isArray(result?.content) ? result.content : []) {
		if (item?.type === "text" && typeof item.text === "string") textParts.push(item.text);
		else if (item?.type === "resource" && typeof item.resource?.text === "string") textParts.push(item.resource.text);
		else if (item?.type === "resource_link") textParts.push(`Resource link: ${item.name || item.uri}\n${item.uri}`);
		else if (item?.type === "image") {
			const encoded = typeof item.data === "string" ? item.data : "";
			const encodedLimit = Math.ceil(MAX_MCP_IMAGE_BYTES / 3) * 4;
			const validBase64 = encoded.length > 0
				&& encoded.length <= encodedLimit
				&& encoded.length % 4 === 0
				&& /^[A-Za-z0-9+/]*={0,2}$/.test(encoded);
			const canIncludeImage = imageEnabled
				&& images.length < MAX_MCP_IMAGE_COUNT
				&& /^image\/(?:png|jpeg|gif|webp)$/i.test(item.mimeType || "")
				&& validBase64;
			const data = canIncludeImage ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
			if (canIncludeImage && data.length > 0 && data.length <= MAX_MCP_IMAGE_BYTES) {
				images.push({ mimeType: item.mimeType, data: data.toString("base64"), path: `MCP server ${entry.serverName}` });
			} else {
				const reason = !imageEnabled
					? "image input is disabled for the model"
					: images.length >= MAX_MCP_IMAGE_COUNT
						? `the ${MAX_MCP_IMAGE_COUNT}-image limit was reached`
						: "its format, encoding, or size is unsupported";
				textParts.push(`[An MCP image was omitted because ${reason}.]`);
			}
		} else if (item?.type) {
			textParts.push(`[MCP returned content of type ${String(item.type).slice(0, 80)}.]`);
		}
	}
	if (result?.structuredContent && typeof result.structuredContent === "object") {
		textParts.push(`Structured result:\n${JSON.stringify(result.structuredContent)}`);
	}
	let toolText = textParts.join("\n\n").trim() || "The MCP tool returned no text content.";
	if (result?.isError) toolText = `MCP tool reported an error.\n${toolText}`;
	if (toolText.length > MAX_MCP_TEXT_RESULT_CHARS) toolText = `${toolText.slice(0, MAX_MCP_TEXT_RESULT_CHARS)}\n[Tool result truncated.]`;
	return { toolText: `[MCP ${entry.serverName}/${entry.remoteToolName}]\n${toolText}`, images, isError: Boolean(result?.isError) };
}

class McpClient {
	constructor(options = {}) {
		this.nextId = 1;
		this.instructions = "";
		this.requestTimeoutMs = Number.isSafeInteger(options.requestTimeoutMs) && options.requestTimeoutMs > 0
			? options.requestTimeoutMs
			: DEFAULT_REQUEST_TIMEOUT_MS;
	}

	async connect() {
		const result = await this.request("initialize", {
			protocolVersion: MCP_PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: "MinAgent", version: "1.0.0" },
		});
		this.setProtocolVersion(result?.protocolVersion);
		this.instructions = typeof result?.instructions === "string" ? result.instructions.slice(0, 12_000) : "";
		await this.notify("notifications/initialized");
	}

	setProtocolVersion(version) {
		if (!SUPPORTED_PROTOCOL_VERSIONS.has(version)) throw new Error(`Server selected unsupported MCP protocol version: ${version || "missing"}`);
		this.protocolVersion = version;
	}

	async listTools(maxTools = MAX_MCP_TOOLS) {
		const limit = Number.isSafeInteger(maxTools) && maxTools > 0 ? maxTools : MAX_MCP_TOOLS;
		const tools = [];
		let cursor;
		for (let page = 0; page < 100; page += 1) {
			const result = await this.request("tools/list", cursor ? { cursor } : {});
			const pageTools = Array.isArray(result?.tools) ? result.tools : [];
			const remaining = limit - tools.length;

			if (remaining <= 0) {
				return { tools, truncated: true };
			}

			if (pageTools.length > remaining) {
				tools.push(...pageTools.slice(0, remaining));
				return { tools, truncated: true };
			}

			tools.push(...pageTools);

			if (!result?.nextCursor) {
				return { tools, truncated: false };
			}
			cursor = result.nextCursor;
		}
		throw new Error("MCP tools/list exceeded the 100-page limit.");
	}

	callTool(name, argumentsValue) {
		return this.request("tools/call", { name, arguments: argumentsValue });
	}
}

class McpStdioClient extends McpClient {
	constructor(command, args, serverEnv, cwd, options = {}) {
		super(options);
		this.command = command;
		this.args = args;
		this.serverEnv = serverEnv;
		this.cwd = cwd;
		this.child = null;
		this.pending = new Map();
		this.buffer = "";
		this.stderrTail = "";
		this.closed = false;
		this.failure = null;
	}

	async connect() {
		const spawnArgs = [];
		const spawnOptions = {
			cwd: this.cwd,
			env: { ...process.env, ...this.serverEnv },
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
			detached: process.platform !== "win32",
		};

		let childProcess;
		if (process.platform === "win32") {
			// Sanitize inputs: remove surrounding double quotes if present, as they might have been
			// added by configuration parsers or tests, causing double-quoting issues later.
			const cleanCommand = this.command.replace(/^"(.*)"$/, "$1");
			const cleanArgs = this.args.map((arg) => arg.replace(/^"(.*)"$/, "$1"));

			// Heuristic: If the command is an executable (.exe), we can often avoid shell:true
			// which mitigates DEP0190 and improves security/performance.
			const isExecutable = /\.(exe|com)$/i.test(cleanCommand);

			if (isExecutable && !/[&|^<>]/.test(cleanCommand)) {
				// Safe to run directly without shell interpretation overhead/risk
				// spawn(command, args[], options)
				childProcess = spawn(cleanCommand, cleanArgs, { ...spawnOptions, shell: false });
			} else {
				// Requires shell interpretation (e.g., npx, uvx, or paths with spaces/special chars)
				// Construct a safe command string for cmd.exe
				const quoteArg = (arg) => {
					if (/^[A-Za-z0-9_:./-]+$/.test(arg)) return arg;
					// Escape double quotes inside by doubling them, then wrap in quotes
					return `"${arg.replace(/"/g, '""')}"`;
				};
				const fullCommand = [quoteArg(cleanCommand), ...cleanArgs.map(quoteArg)].join(" ");
				// spawn(command_string, options) when shell is true
				childProcess = spawn(fullCommand, { ...spawnOptions, shell: true });
			}
		} else {
			// Unix/Linux/macOS: standard execve style
			childProcess = spawn(this.command, this.args, { ...spawnOptions, shell: false });
		}
		this.child = childProcess;
		this.child.stdout.setEncoding("utf8");
		this.child.stdout.on("data", (chunk) => this.consumeStdout(chunk));
		this.child.stderr.setEncoding("utf8");
		this.child.stderr.on("data", (chunk) => {
			this.stderrTail = `${this.stderrTail}${chunk}`.slice(-8000);
		});
		this.child.once("error", (error) => this.fail(error));
		this.child.once("close", (code, signal) => {
			this.fail(new Error(`Server exited (${code ?? signal ?? "unknown status"})${this.stderrTail.trim() ? `: ${this.stderrTail.trim()}` : ""}`));
		});
		await super.connect();
	}

	consumeStdout(chunk) {
		this.buffer += chunk;
		if (this.buffer.length > 16 * 1024 * 1024) {
			this.fail(new Error("MCP server sent an oversized stdio message."));
			this.buffer = "";
			return;
		}
		let newline;
		while ((newline = this.buffer.indexOf("\n")) >= 0) {
			const line = this.buffer.slice(0, newline).trim();
			this.buffer = this.buffer.slice(newline + 1);
			if (!line) continue;
			let message;
			try {
				message = JSON.parse(line);
			} catch {
				if (line.startsWith("{") && (line.length > 1024 || this.buffer.length > 1024)) {
					this.fail(new Error("Malformed JSON in MCP server stdout."));
					return;
				}
				continue;
			}
			const pendingId = message.id;
			if (pendingId === undefined) continue;
			if (this.pending.has(pendingId)) {
				const pending = this.pending.get(pendingId);
				pending.resolve(message);
				this.pending.delete(pendingId);
			} else {
				this.pending.set(pendingId, { resolve: (result) => {}, reject: () => {} });
			}
		}
	}

	async request(method, params) {
		const id = this.nextId++;
		const message = { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) };
		let timer;
		const promise = new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`MCP request timed out after ${this.requestTimeoutMs} ms: ${method}.`));
			}, this.requestTimeoutMs);
		});
		try {
			this.child.stdin.write(`${JSON.stringify(message)}\n`);
			const response = await promise;
			if (response?.error) throw new Error(response.error.message || "MCP request failed.");
			return response?.result;
		} catch (error) {
			this.pending.delete(id);
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}

	notify(method, params) {
		const message = { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
		try {
			this.child.stdin.write(`${JSON.stringify(message)}\n`);
		} catch (error) {
			this.fail(error);
			throw error;
		}
	}

	fail(error) {
		if (this.closed || this.failure) return;
		this.closed = true;
		this.failure = error;
		for (const [id, promise] of this.pending) {
			promise.reject(error);
		}
		this.pending.clear();
	}

	async close() {
		if (!this.child) return;
		if (this.child.exitCode !== null || this.child.signalCode !== null) return;
		terminateProcessTree(this.child);
		await new Promise((resolve, reject) => {
			this.child.once("close", resolve);
			this.child.once("error", reject);
			setTimeout(() => reject(new Error("MCP server close timeout")), 5000);
		});
	}
}

class McpHttpClient extends McpClient {
	constructor(config, options = {}) {
		super(options);
		this.url = new URL(config.url);
		if (!/^https?:$/.test(this.url.protocol)) throw new Error("MCP server URLs must use HTTP or HTTPS.");
		if (options.httpNetwork === "local" && !isLoopbackHost(this.url.hostname)) {
			throw new Error(`MCP HTTP server host "${this.url.hostname}" is not loopback, and MCP_HTTP_NETWORK=local allows local hosts only.`);
		}
		this.serverHeaders = resolveServerHeaders(config);
		if (!this.serverHeaders || typeof this.serverHeaders !== "object" || Array.isArray(this.serverHeaders)
			|| Object.values(this.serverHeaders).some((value) => typeof value !== "string")) {
			throw new Error("HTTP server headers must be an object containing string values.");
		}
		this.protocolVersion = null;
		this.sessionId = null;
	}

	async request(method, params) {
		const id = this.nextId++;
		return this.post({ jsonrpc: "2.0", id, method, params }, id);
	}

	async notify(method, params) {
		await this.post({ jsonrpc: "2.0", method, ...(params ? { params } : {}) });
	}

	async post(message, id) {
		const headers = new Headers({
			Accept: "application/json, text/event-stream",
			"Content-Type": "application/json",
			...this.serverHeaders,
		});
		if (this.sessionId) headers.set("Mcp-Session-Id", this.sessionId);
		if (this.protocolVersion) headers.set("MCP-Protocol-Version", this.protocolVersion);
		const response = await fetch(this.url, {
			method: "POST",
			headers,
			body: JSON.stringify(message),
			redirect: "error",
			signal: AbortSignal.timeout(this.requestTimeoutMs),
		});
		const sessionId = response.headers.get("mcp-session-id");
		if (sessionId) this.sessionId = sessionId;
		if (!response.ok) {
			const body = await readLimitedResponseText(response, 16 * 1024 * 1024);
			let detail = body.slice(0, 1000);
			try {
				const parsed = JSON.parse(body);
				detail = parsed?.error?.message || detail;
			} catch {}
			throw new Error(`MCP HTTP ${response.status}: ${detail || response.statusText}`);
		}
		if (id === undefined) {
			await response.body?.cancel().catch(() => {});
			return undefined;
		}
		const contentType = response.headers.get("content-type")?.toLowerCase() || "";
		let result;
		if (contentType.includes("text/event-stream")) {
			result = await readSseResponse(response, id, 16 * 1024 * 1024);
		} else {
			const body = await readLimitedResponseText(response, 16 * 1024 * 1024);
			if (!body.trim()) throw new Error(`MCP server returned an empty response for ${message.method}.`);
			result = JSON.parse(body);
		}
		if (!result) throw new Error(`MCP server did not return a response for ${message.method}.`);
		if (String(result.id) !== String(id)) throw new Error(`MCP server returned the wrong response ID for ${message.method}.`);
		if (result.error) throw new Error(result.error.message || "MCP request failed.");
		return result.result;
	}

	async close() {
		if (!this.sessionId) return;
		try {
			const headers = new Headers(this.serverHeaders);
			headers.set("Mcp-Session-Id", this.sessionId);
			if (this.protocolVersion) headers.set("MCP-Protocol-Version", this.protocolVersion);
			await fetch(this.url, { method: "DELETE", headers, redirect: "error", signal: AbortSignal.timeout(3000) });
		} catch {}
	}
}

// Merges literal headers with headersFromEnv, where each value names an
// environment variable so credentials never live in the MCP configuration.
function resolveServerHeaders(config) {
	const headers = { ...(config.headers ?? {}) };
	if (config.headersFromEnv === undefined) return headers;
	const fromEnv = config.headersFromEnv;
	if (!fromEnv || typeof fromEnv !== "object" || Array.isArray(fromEnv)) {
		throw new Error("HTTP server headersFromEnv must be an object mapping header names to environment variable names.");
	}
	for (const [headerName, envName] of Object.entries(fromEnv)) {
		if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(headerName)) {
			throw new Error(`headersFromEnv key "${headerName}" is not a valid header name.`);
		}
		if (typeof envName !== "string" || !envName.trim()) {
			throw new Error(`headersFromEnv value for "${headerName}" must be an environment variable name.`);
		}
		const value = process.env[envName];
		if (!value) {
			throw new Error(`MCP header "${headerName}" requires environment variable ${envName}, which is not set.`);
		}
		headers[headerName] = value;
	}
	return headers;
}

async function readLimitedResponseText(response, maxBytes) {
	if (!response.body) return "";
	const reader = response.body.getReader();
	const chunks = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				throw new Error(`MCP HTTP response exceeds ${maxBytes} bytes.`);
			}
			chunks.push(Buffer.from(value));
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks, totalBytes).toString("utf8");
}

async function readSseResponse(response, id, maxBytes) {
	if (!response.body) throw new Error("MCP HTTP response has no body.");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				throw new Error(`MCP HTTP SSE response exceeds ${maxBytes} bytes.`);
			}
			buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
			const message = extractSseMessage(buffer, id, false);
			if (message) return message;
		}
		buffer += decoder.decode();
		const message = extractSseMessage(buffer, id, true);
		if (message) return message;
		throw new Error("MCP HTTP SSE response missing event data.");
	} finally {
		reader.releaseLock();
	}
}

function extractSseMessage(buffer, id, final) {
	const trimmed = buffer.trimStart();
	if (trimmed.startsWith("{")) {
		// Some servers label a single plain JSON payload with an event-stream content type.
		if (!final) return undefined;
		try {
			return JSON.parse(trimmed);
		} catch (error) {
			throw new Error(`MCP HTTP response is not valid JSON: ${error.message}`);
		}
	}
	const blocks = buffer.split("\n\n");
	const completeBlocks = final ? blocks.length : Math.max(0, blocks.length - 1);
	for (let index = 0; index < completeBlocks; index += 1) {
		const dataLines = blocks[index].split("\n").filter((line) => line.startsWith("data:"));
		if (dataLines.length === 0) continue;
		const payload = dataLines.map((line) => line.slice(5).replace(/^ /, "")).join("\n");
		if (!payload) continue;
		let parsed;
		try {
			parsed = JSON.parse(payload);
		} catch {
			continue;
		}
		if (parsed && String(parsed.id) === String(id)) return parsed;
	}
	return undefined;
}

export { McpHttpClient, McpStdioClient };
