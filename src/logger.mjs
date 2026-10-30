/**
 * Logger for MinAgent
 *
 * Provides structured logging with levels: silent, error, warn, info, debug, trace
 * Never logs secrets or sensitive information.
 */

const LEVELS = {
	silent: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
	trace: 5,
};

const DEFAULT_LEVEL = "info";

const LEVEL_NAMES = Object.keys(LEVELS);

export function createLogger({ level = DEFAULT_LEVEL, prefix = "" } = {}) {
	const currentLevel = LEVELS[level.toLowerCase()] ?? LEVELS.info;

	return {
		debug(...args) {
			if (currentLevel >= LEVELS.debug) this._log("debug", args);
		},
		trace(...args) {
			if (currentLevel >= LEVELS.trace) this._log("trace", args);
		},
		info(...args) {
			if (currentLevel >= LEVELS.info) this._log("info", args);
		},
		warn(...args) {
			if (currentLevel >= LEVELS.warn) this._log("warn", args);
		},
		error(...args) {
			if (currentLevel >= LEVELS.error) this._log("error", args);
		},

		_log(level, args) {
			const message = args.map(a => {
				if (a instanceof Error) {
					return a.message;
				}
				return String(a);
			}).join(" ");

			const timestamp = new Date().toISOString();
			const logEntry = `${timestamp} [${prefix}] [${level.toUpperCase()}] ${message}`;

			// Redirect based on level
			if (level === "error") {
				console.error(logEntry);
			} else {
				console.log(logEntry);
			}

			// Return object for programmatic access
			return {
				level,
				prefix,
				message,
				timestamp,
			};
		},

		setLevel(newLevel) {
			this.level = newLevel;
			this.currentLevel = LEVELS[newLevel.toLowerCase()] ?? LEVELS.info;
		},

		get level() {
			return LEVEL_NAMES[this.currentLevel];
		},

		set level(value) {
			this.currentLevel = LEVELS[value.toLowerCase()] ?? LEVELS.info;
		},

		// Metadata for metrics
		getMetadata() {
			return {
				level: this.level,
				prefix,
			};
		},
	};
}

export const levels = LEVELS;
export const levelNames = LEVEL_NAMES;
export { DEFAULT_LEVEL };

export default createLogger;
