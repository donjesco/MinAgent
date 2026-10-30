# MinAgent Project Guidelines

## Overview

MinAgent is a CLI/TUI coding agent for the directory from which it is started. It connects to an OpenAI Chat Completions compatible endpoint, streams the model response as it arrives, and gives the model workspace tools for reading and changing files.

## Architecture

### Core Modules

- **`src/minagent.mjs`** — Main entry point, TUI, conversation loop
- **`src/agent-mode.mjs`** — Build/Plan permissions and mode state
- **`src/agent-runtime.mjs`** — Tool validation, edit evidence, loop guards
- **`src/openai.mjs`** — SSE client, streaming, tool-call reassembly
- **`src/workspace.mjs`** — Workspace boundaries and file operations
- **`src/config.mjs`** — Environment configuration loading
- **`src/commands.mjs`** — Slash command catalog
- **`src/skills.mjs`** — Skill discovery and loading
- **`src/mcp.mjs`** — MCP configuration and tool discovery

### Key Directories

```
C:\MinAgent/
├── src/              # Source code
├── tests/            # Test files
├── scripts/          # Utility scripts
├── .minagent/        # MCP configuration
├── skills/           # Project-specific skills (optional)
├── INSTALLATION.md   # Setup guide
├── README.md         # Project overview
└── AGENTS.md         # This file
```

## Conventions

### Code Style

- **Language**: JavaScript (ES modules)
- **Linting**: ESLint (via `npm run check`)
- **Formatting**: Prettier (via `npm run format`)
- **Testing**: Node.js built-in test runner (`node --test`)

### File Naming

- Source files: `<name>.mjs` (modules)
- Test files: `<name>.test.mjs`
- Utility scripts: `<name>.mjs` in `scripts/`

### Testing Conventions

- Tests must pass before code changes
- Use `npm run test` to run all tests
- Coverage target: 80%+
- Each function should have tests

### Documentation

- README.md for project overview
- INSTALLATION.md for setup
- AGENTS.md for conventions
- Inline JSDoc for functions

## Skills

### Required Skills

Enable skills for enhanced capabilities:

```env
# .env
SKILLS_MODE=ask      # Ask before using skills (recommended)
MCP_MODE=ask         # Ask before using MCP tools
TERMINAL_MODE=ask    # Ask before running terminal commands
```

### Available Skills

- **project-investigation** — Investigate project structure, errors, improvements
- **systematic-debugging** — 4-phase root cause debugging
- **test-driven-development** — TDD: RED-GREEN-REFACTOR
- **codebase-inspection** — LOC, language breakdown with pygount
- **hermes-agent-skill-authoring** — Skill authoring standards
- **requesting-code-review** — Pre-commit review, security gates
- **simplify-code** — Parallel 4-agent cleanup

### Using Skills

```bash
# Load skill
skill_view(name='project-investigation')

# Use skill
/project-investigation

# Delegate to subagent
delegate_task(
    goal="Investigate project",
    context="Follow project-investigation skill"
)
```

## Commands

### Slash Commands

| Command | Description |
|---------|-------------|
| `/new` | Clear conversation, start fresh |
| `/init [focus]` | Investigate and generate AGENTS.md |
| `/model` | Query API models catalog |
| `/compact [instructions]` | Summarize history |
| `/mcp [server]` | List MCP servers, show tools |
| `/status` | Show session status |
| `/context` | Show context breakdown |
| `/doctor` | Run health checks |
| `/help` | Show command list |
| `/exit` | Close MinAgent |

### Keyboard Shortcuts

- **Tab** — Toggle between Build/Plan modes
- **Esc** — Stop streaming response
- **Ctrl+J** — Insert newline
- **↑/↓** — Navigate suggestions/history
- **/** — Open command autocomplete

## Development Workflow

### 1. Investigation First

Before making changes, investigate:

```bash
# Analyze project
/project-investigation

# Or delegate
delegate_task(
    goal="Investigate project structure",
    context="Follow project-investigation skill"
)
```

### 2. Test-Driven Development

Implement with TDD:

```bash
# Write test first
npm run test -- --testNamePattern="your_test"

# Implement minimal fix
npm run test

# Refactor
npm run format
npm run check
```

### 3. Code Review

Before committing:

- [ ] Tests pass (`npm run test`)
- [ ] Linting clean (`npm run check`)
- [ ] Formatting correct (`npm run format`)
- [ ] No console.log in production
- [ ] Types correct (if applicable)
- [ ] Error handling implemented

### 4. Continuous Integration

```bash
# Run all checks
npm run check      # Syntax
npm run format     # Format
npm run test       # Tests
npm run doctor     # Health
```

## Error Handling

### Common Errors

- **ConfigurationError** — Invalid .env configuration
- **NodeVersionError** — Node.js version too low
- **PermissionDeniedError** — File permission issues
- **McpError** — MCP server connection failed
- **ToolError** — Tool execution failed

### Debugging

Use systematic-debugging skill:

```bash
/systematic-debugging
```

Or delegate:

```python
delegate_task(
    goal="Debug [error]",
    context="Follow systematic-debugging skill"
)
```

## Configuration

### .env

```env
# Permisos
MCP_MODE=ask
TERMINAL_MODE=ask
SKILLS_MODE=ask

# OpenAI
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=tu_api_key
OPENAI_MODEL=tu_model
OPENAI_CONTEXT_WINDOW=128000

# Límites
MCP_MAX_TOOLS=50
```

### .minagent/mcp.json

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/ruta/archivos"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"]
    },
    "duckduckgo-mcp-server": {
      "command": "npx",
      "args": ["-y", "@ericthered926/duckdduckgo-mcp-server@0.6.0"]
    }
  }
}
```

## Quality Standards

### Code Quality

- **Coverage**: 80%+
- **Tests**: Every function tested
- **Docs**: Every module documented
- **Types**: Complete typing (if applicable)

### Performance

- **Test suite**: < 30 seconds
- **Linting**: < 10 seconds
- **Build**: < 60 seconds
- **Memory leaks**: None

## Security

### Dependencies

```bash
# Check for vulnerabilities
npm audit
npm audit fix

# Check for security issues
npm run security-audit  # if available
```

### Best Practices

- Never commit secrets
- Use environment variables for credentials
- Validate all inputs
- Implement error handling
- Log security-relevant events

## Troubleshooting

### Common Issues

1. **Skills not loading** — Check `SKILLS_MODE` in .env
2. **MCP not connecting** — Check .minagent/mcp.json
3. **Tests failing** — Run `npm run doctor` for diagnostics
4. **Formatting errors** — Run `npm run format`

### Diagnostics

```bash
# Run health checks
npm run doctor

# Check configuration
node src/doctor.mjs

# Verify Node version
node --version
```

## License

MIT License — See LICENSE file for details.

---

**Generated**: 2026-10-26  
**Version**: 1.0.0  
**Author**: Hermes Agent
