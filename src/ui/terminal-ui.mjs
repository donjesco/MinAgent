import { safeTerminalText, terminalTextWidth, truncateStyledTerminalText, wrapMessage } from "../terminal-text.mjs";

export const UI_COLORS = {
	cyan: [31, 226, 220],
	magenta: [255, 48, 167],
	pale: [226, 239, 241],
	muted: [130, 153, 164],
	success: [112, 224, 154],
	warning: [255, 177, 109],
	error: [255, 108, 132],
	userBackground: [18, 49, 58],
	assistantBackground: [13, 21, 35],
};

/**
 * Encapsulates all terminal rendering and interaction logic.
 */
export class TerminalUI {
	constructor({ stdout, useColorGetter }) {
		this.stdout = stdout;
		this.useColorGetter = useColorGetter;
	}

	get useColor() {
		return this.useColorGetter();
	}

	uiText(value, color = "pale", bold = false) {
		const safe = safeTerminalText(value);
		if (!this.useColor) return safe;
		const [red, green, blue] = UI_COLORS[color] ?? UI_COLORS.pale;
		return `\u001b[${bold ? "1;" : ""}38;2;${red};${green};${blue}m${safe}\u001b[0m`;
	}

	uiPrint(value) {
		this.stdout.write(`${value}${this.useColor ? "\u001b[0m" : ""}\n`);
	}

	print(value) {
		this.stdout.write(`${safeTerminalText(value)}\n`);
	}

	uiBubbleText(value, foreground, background) {
		const safe = safeTerminalText(value);
		if (!this.useColor) return safe;
		const [fr, fg, fb] = UI_COLORS[foreground] ?? UI_COLORS.pale;
		const [br, bg, bb] = UI_COLORS[background] ?? UI_COLORS.assistantBackground;
		return `\u001b[38;2;${fr};${fg};${fb};48;2;${br};${bg};${bb}m${safe}\u001b[0m`;
	}

	printUserBubble(text) {
		const columns = this.stdout.columns || 80;
		const maxContentWidth = Math.max(4, Math.min(66, columns - 8));
		const lines = wrapMessage(text, maxContentWidth);
		const contentWidth = Math.max(4, ...lines.map(terminalTextWidth));
		const outerWidth = contentWidth + 4;
		const indent = " ".repeat(Math.max(0, columns - outerWidth));
		const title = "╭─ YOU ";
		const titleFill = Math.max(0, outerWidth - terminalTextWidth(title) - 1);
		this.uiPrint(`${indent}${this.uiText(title, "magenta", true)}${this.uiText("─".repeat(titleFill) + "╮", "magenta")}`);
		for (const line of lines) {
			const padding = " ".repeat(Math.max(0, contentWidth - terminalTextWidth(line)));
			this.uiPrint(`${indent}${this.uiText("│", "magenta")}${this.uiBubbleText(` ${line}${padding} `, "pale", "userBackground")}${this.uiText("│", "magenta")}`);
		}
		this.uiPrint(`${indent}${this.uiText(`╰${"─".repeat(contentWidth + 2)}╯`, "magenta")}`);
	}

	printError(error) {
		const text = safeTerminalText(error instanceof Error ? error.message : String(error));
		const errorWidth = Math.max(4, (this.stdout.columns || 80) - 4);
		this.print("");
		this.uiPrint(this.uiText("╭─ ERROR", "error", true));
		for (const line of wrapMessage(text, errorWidth)) this.uiPrint(`${this.uiText("│", "error")} ${this.uiText(line, "pale")}`);
		this.uiPrint(this.uiText(`╰${"─".repeat(Math.max(8, errorWidth))}`, "error"));
	}

	tokenCount(value) {
		return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)));
	}

	usageMeter(percent, width = 20) {
		const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
		return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
	}

	permissionModeLabel(mode) {
		if (mode === "auto") return "Auto";
		if (mode === "ask") return "Ask";
		return "Off";
	}

	printStartupPanel(state) {
		const { model, contextWindow, usedTokens, inputModalities, terminalMode, workspaceName, skillsMode, mcpMode, availableSkillsCount, mcpToolsCount } = state;
		const percent = contextWindow > 0 ? (usedTokens / contextWindow) * 100 : 0;
		this.print("");
		const rows = [
			["Model", model],
			["Context", `~${this.tokenCount(usedTokens)} / ${this.tokenCount(contextWindow)} tokens  ${percent.toFixed(1)}%  ${this.usageMeter(percent)}`],
			["Input", inputModalities.join(" · ")],
			["Terminal", this.permissionModeLabel(terminalMode)],
			["Workspace", workspaceName],
		];
		if (skillsMode !== "off" || mcpMode !== "off") {
			rows.push(["Extensions", `Skills ${this.permissionModeLabel(skillsMode)}${skillsMode !== "off" ? ` (${availableSkillsCount} loaded)` : ""} · MCP ${this.permissionModeLabel(mcpMode)}${mcpMode !== "off" ? ` (${mcpToolsCount} tools)` : ""}`]);
		}
		const contents = ["MinAgent · SESSION", ...rows.map(([label, value]) => `${label.padEnd(10)} ${value}`)];
		const maxInnerWidth = Math.max(4, (this.stdout.columns || 80) - 4);
		const innerWidth = Math.min(maxInnerWidth, Math.max(4, ...contents.map(terminalTextWidth)));
		const edge = (left, right) => `${left}${"─".repeat(innerWidth + 2)}${right}`;
		const panelLine = (content, color = "pale") => {
			for (const line of wrapMessage(content, innerWidth)) {
				const padding = " ".repeat(Math.max(0, innerWidth - terminalTextWidth(line)));
				this.uiPrint(`${this.uiText("│", "cyan")} ${this.uiText(line, color)}${padding} ${this.uiText("│", "cyan")}`);
			}
		};
		this.uiPrint(this.uiText(edge("╭", ""), "cyan"));
		panelLine(contents[0], "magenta");
		for (const [label, value] of rows) {
			const content = `${label.padEnd(10)} ${value}`;
			if (terminalTextWidth(content) <= innerWidth) {
				const padding = " ".repeat(Math.max(0, innerWidth - terminalTextWidth(content)));
				this.uiPrint(`${this.uiText("│", "cyan")} ${this.uiText(label.padEnd(10), "muted")} ${this.uiText(value, "pale")}${padding} ${this.uiText("│", "cyan")}`);
			} else {
				panelLine(label.trimEnd(), "muted");
				panelLine(`  ${value}`, "pale");
			}
		}
		this.uiPrint(this.uiText(edge("╰", "╯"), "cyan"));
	}

	printCommandMenu(commands) {
		this.print("");
		this.uiPrint(this.uiText("╭─ COMMANDS", "magenta", true));
		for (const command of commands) this.uiPrint(`  ${this.uiText(`/${command.name.padEnd(12)}`, "cyan", true)} ${this.uiText(command.description, "pale")}`);
		this.uiPrint(this.uiText("╰─ Enter to select · Esc to close", "muted"));
	}

	renderPersistentFooter(state) {
		if (!state.persistentUiActive || !state.persistentUiTerminal) return;
		const columns = Math.max(1, this.stdout.columns || 80);
		const terminal = state.persistentUiTerminal;
		const usagePercent = state.contextUsage.percent;
		const separator = this.uiText(" · ", "muted");
		const contextColor = usagePercent >= 90 ? "error" : usagePercent >= 75 ? "warning" : "cyan";
		const activityColor = state.persistentUiActivity === "Ready" ? "success" : state.persistentUiActivity === "Approval needed" ? "warning" : "cyan";
		const status = [
			...(state.agentModeRunning && state.agentModeRunning !== state.agentModeSelected ? [this.uiText(`Running: ${state.agentModeRunning === "plan" ? "Plan" : "Build"}`, "cyan")] : []),
			this.uiText(state.model, "magenta", true),
			this.uiText(this.tokenCount(state.usedTokens), "pale", true) + this.uiText(`/${this.tokenCount(state.contextWindow)} tokens`, "muted"),
			this.uiText(`${usagePercent.toFixed(1)}% ${this.usageMeter(usagePercent, 10)}`, contextColor),
			this.uiText(state.persistentUiActivity, activityColor, true),
			...(state.persistentUiQueuedCount > 0 ? [this.uiText(`${state.persistentUiQueuedCount} queued`, "warning")] : []),
		].join(separator);
		const hints = [["Tab", "mode", "warning"], ["/", "commands", "magenta"], ["@", "files", "cyan"], ["Ctrl+J", "new line", "success"], ["Esc", "stop", "warning"]]
			.map(([key, label, color]) => `${this.uiText(`[${key}]`, color, true)} ${this.uiText(label, "muted")}`).join("  ");
		const line = safeTerminalText(terminal.line ?? "");
		const cursor = Number.isInteger(terminal.cursor) ? Math.max(0, Math.min(terminal.cursor, line.length)) : line.length;
		const suggestions = state.persistentModelSelector
			? state.formatAutocompletePanel(state.persistentModelSelector, { columns, useColor: this.useColor, uiText: this.uiText.bind(this) })
			: state.persistentUiAutocompleteVisible && state.persistentUiAutocompleteState
			? state.formatAutocompletePanel(state.persistentUiAutocompleteState, { columns, useColor: this.useColor, uiText: this.uiText.bind(this) })
			: [];
		state.persistentFooter.render({
			status: truncateStyledTerminalText(status, columns),
			hints,
			prompt: state.persistentUiPrompt,
			line, cursor, suggestions,
		});
	}

	showAutocompletePanel(state, nextState) {
		state.persistentUiAutocompleteState = nextState;
		state.persistentUiAutocompleteVisible = true;
		this.renderPersistentFooter(state);
	}

	hideAutocompletePanel(state) {
		if (!state.persistentUiAutocompleteVisible) return;
		state.persistentUiAutocompleteVisible = false;
		state.persistentUiAutocompleteState = null;
		this.renderPersistentFooter(state);
	}

	toolIcon(name) {
		const icons = {
			read_file: "🔍",
			edit_file: "✏️",
			write_file: "📝",
			delete_file: "🗑️",
			delete_directory: "🗑️",
			list_directory: "📁",
			search_files: "🔎",
			run_terminal: "💻",
		};
		if (icons[name]) return icons[name];
		if (name.startsWith("mcp_")) return "🔌";
		if (name.startsWith("skill_")) return "🧩";
		return "⚡";
	}

	toolDisplayName(name) {
		if (name.startsWith("mcp_")) {
			return name.replace(/^mcp_\d+_\d+_/, "");
		}
		return name;
	}

	printToolResult(name, _args, result) {
		const failed = Boolean(result && typeof result === "object" && result.isError)
			|| (typeof result === "string" && (/^(?:Error:|Could not start the command:)/i.test(result)
				|| (name === "run_terminal" && /^Exit code: (?!0\b)/m.test(result))));
		const icon = this.toolIcon(name);
		const cleanName = this.toolDisplayName(name);

		if (result && typeof result === "object" && "toolText" in result) {
			const displayText = safeTerminalText(result.displayText ?? result.toolText).slice(0, 3000);
			const statusLabel = failed ? "Tool failed" : "Tool finished";
			const statusColor = failed ? "error" : "cyan";
			const badgeText = failed ? " ✗ Error " : " ✓ Listo ";
			const badgeColor = failed ? "error" : "success";
			this.uiPrint(`  ${this.uiText("╭─", statusColor)} ${icon} ${this.uiText(cleanName, "pale", true)} ${this.uiText(badgeText, badgeColor, true)} ${this.uiText(`(${statusLabel})`, "muted")}`);
			for (const line of displayText.split(/\r?\n/)) {
				this.uiPrint(`  ${this.uiText("│", statusColor)}  ${this.uiText(line, failed ? "error" : "pale")}`);
			}
			if (!result.displayText && displayText.length < result.toolText.length) {
				this.uiPrint(`  ${this.uiText("│", statusColor)}  ${this.uiText("[Output truncated on screen; the full result was passed to the model.]", "muted")}`);
			}
			this.uiPrint(`  ${this.uiText("╰" + "─".repeat(46), statusColor)}`);
			return;
		}
		const text = String(result);
		if (/^(?:Permission denied by the user|MCP call denied by the user)/i.test(text)) {
			this.uiPrint(`  ${this.uiText("╭─", "warning")} 🛡️  ${this.uiText(cleanName, "pale", true)} ${this.uiText(" ⚠ Denegado ", "warning", true)} ${this.uiText("(Not executed)", "muted")}`);
			this.uiPrint(`  ${this.uiText("│", "warning")}  ${this.uiText(text, "muted")}`);
			this.uiPrint(`  ${this.uiText("╰" + "─".repeat(46), "warning")}`);
			return;
		}
		if (text.startsWith("Error:")) {
			this.uiPrint(`  ${this.uiText("╭─", "error")} ✗ ${this.uiText(cleanName, "pale", true)} ${this.uiText(" ✗ Error ", "error", true)} ${this.uiText("(Tool failed)", "muted")}`);
			this.uiPrint(`  ${this.uiText("│", "error")}  ${this.uiText(text, "error")}`);
			this.uiPrint(`  ${this.uiText("╰" + "─".repeat(46), "error")}`);
			return;
		}
		if (name === "run_terminal") {
			const statusLabel = failed ? "Command failed" : "Command finished";
			const statusColor = failed ? "error" : "cyan";
			const badgeText = failed ? " ✗ Error " : " ✓ Listo ";
			const badgeColor = failed ? "error" : "success";
			const shown = safeTerminalText(text).slice(0, 3000);
			this.uiPrint(`  ${this.uiText("╭─", statusColor)} 💻 ${this.uiText("Terminal", "pale", true)} ${this.uiText(badgeText, badgeColor, true)} ${this.uiText(`(${statusLabel})`, "muted")}`);
			for (const line of shown.split(/\r?\n/)) {
				this.uiPrint(`  ${this.uiText("│", statusColor)}  ${this.uiText(line, failed ? "error" : "pale")}`);
			}
			if (shown.length < text.length) {
				this.uiPrint(`  ${this.uiText("│", statusColor)}  ${this.uiText("[Output truncated on screen; the full result is available to the model.]", "muted")}`);
			}
			this.uiPrint(`  ${this.uiText("╰" + "─".repeat(46), statusColor)}`);
			return;
		}
		const statusColor = failed ? "error" : "cyan";
		this.uiPrint(`  ${this.uiText("╭─", statusColor)} ${icon} ${this.uiText(cleanName, "pale", true)}`);
		this.uiPrint(`  ${this.uiText("│", statusColor)}  ${this.uiText(text, failed ? "error" : "pale")}`);
		this.uiPrint(`  ${this.uiText("╰" + "─".repeat(46), statusColor)}`);
	}
}
