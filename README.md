# MinAgent 🤖

[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-blue.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> A CLI/TUI coding agent that connects to an OpenAI-compatible endpoint, streams responses, and provides workspace tools.

## 🚀 Features

- **Zero dependencies** - Runs directly with Node.js
- **Build/Plan modes** - Plan without executing or implement changes
- **Granular permissions** - Auto/ask/off control
- **MCP tools** - Integration with MCP servers
- **Customizable skills** - Extensible capabilities
- **Complete tests** - Unit, integration, e2e test suite

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Commands](#-commands)
- [Tools](#-tools)
- [Skills](#-skills)
- [Modes](#-modes)
- [Testing](#-testing)
- [Structure](#-structure)
- [Contributing](#-contributing)

## 📦 Requirements

- **Node.js** ≥ 22.0.0
- **OpenAI-compatible server** with SSE streaming
- **Tool calling** enabled
- (Optional) **MCP servers** configured

### Verify Installation

```bash
node --version    # Must be ≥ 22.0.0
npm --version     # Must be available
```

## ⚡ Quick Start

1. **Clone the repository**

```bash
git clone <repository-url>
cd minagent
```

2. **Configure `.env`**

```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Configure MCP (optional)**

```bash
# Edit .minagent/mcp.json with your servers
```

4. **Run MinAgent**

```bash
npm run start
# Or directly:
node src/minagent.mjs
```

5. **Verify installation**

```bash
npm run doctor
```

## ⚙️ Configuration

MinAgent reads `.env` from the installation directory. OS environment variables take precedence.

### OpenAI Variables

```env
# SSE endpoint (required)
OPENAI_BASE_URL=https://api.openai.com/v1

# API Key (optional for some providers)
OPENAI_API_KEY=your_api_key

# Model (REQUIRED)
OPENAI_MODEL=gpt-4o

# Input modalities
OPENAI_INPUT=text

# Context window (tokens)
OPENAI_CONTEXT_WINDOW=128000
```

### Permission Modes

| Mode | Behavior | Recommended for |
|------|----------|-----------------|
| `auto` | Execute without asking | Production |
| `ask` | Request approval | First use (RECOMMENDED) |
| `off` | Disable | Development |

Applies to: `TERMINAL_MODE`, `SKILLS_MODE`, `MCP_MODE`

### Full Example

```env
# OpenAI
OPENAI_BASE_URL=http://127.0.0.1:8080/v1
OPENAI_API_KEY=llama.cpp
OPENAI_MODEL=llama.cpp
OPENAI_INPUT=text
OPENAI_CONTEXT_WINDOW=262144

# Modes
TERMINAL_MODE=ask
SKILLS_MODE=ask
MCP_MODE=ask
MCP_MAX_TOOLS=50
```

## 🎮 Commands

### Slash Commands (start with `/`)

| Command | Description |
|---------|-------------|
| `/new` | Clear conversation |
| `/init [focus]` | Investigate project and generate AGENTS.md |
| `/model` | List/Select available models |
| `/compact` | Compress history |
| `/mcp [server]` | List MCP servers |
| `/status` | Show session status |
| `/context` | Show context usage |
| `/doctor` | Check environment health |
| `/help` | Show command list |
| `/exit` | Close MinAgent |

### Keyboard Shortcuts

- **Tab** / **Shift+Tab**: Toggle Build/Plan modes
- **Esc**: Stop streaming
- **Ctrl+J**: Insert newline
- **↑/↓**: Navigate suggestions/history
- **/**: Command autocomplete

## 🛠️ Tools

MinAgent provides these workspace tools:

### Reading

- **`read_file`** - Read UTF-8 files (specific line)
- **`list_directory`** - List immediate directories
- **`search_files`** - Recursive file search

### Writing

- **`write_file`** - Create or replace files
- **`edit_file`** - Edit exact blocks
- **`delete_file`** - Delete files
- **`delete_directory`** - Delete directories

### Terminal

- **`run_terminal`** - Execute commands (approval based on mode)

### Images

- **`file_upload`** - Upload files
- **`drop`** - Drag and drop files

## 🧠 Skills

Skills are auto-discovered in:

- `skills/<skill-name>/`
- `.agents/skills/<skill-name>/`

### Built-in Skills

1. **project-investigation** - Investigate structure, errors, improvements
2. **minagent-workflow** - Project workflows

### Available Global Skills

- **systematic-debugging** - 4-phase debugging
- **test-driven-development** - TDD workflow
- **codebase-inspection** - Analysis with pygount
- **hermes-agent-skill-authoring** - Standards
- **requesting-code-review** - Pre-commit review
- **simplify-code** - Parallel cleanup

### Using Skills

```bash
# Mode: auto (automatic) or ask (with approval)
SKILLS_MODE=ask

# Load skill
/skill_load(project-investigation)
```

## 🎯 Modes

### Build Mode (Construction) ✅

- **Allows**: All tools
- **Actions**: Edit, write, run terminal, use skills/MCP
- **Status**: Green
- **Use**: Implement changes

### Plan Mode (Planning) 📝

- **Allows**: Read only (`list_directory`, `read_file`, `search_files`)
- **Actions**: Inspect, analyze, propose
- **Status**: Yellow
- **Use**: Plan, diagnose, investigate

### Toggle Modes

Press **Tab** or **Shift+Tab** to switch modes.

## 🧪 Testing

### Run Tests

```bash
# All tests
npm run test

# By type
npm run test:unit        # Unit tests
npm run test:integration # Integration
npm run test:e2e        # End-to-end
npm run test:cli        # CLI
npm run test:coverage   # With coverage
```

### Validation

```bash
# Linting
npm run lint

# Formatting
npm run format

# All
npm run check-all  # lint + format + test
```

### Evaluate Model

```bash
node scripts/evaluate.mjs --live
```

## 📁 Structure

```
minagent/
├── src/                    # Source code (37 modules)
│   ├── agent-mode.mjs     # Build/Plan permissions
│   ├── agent-runtime.mjs  # Tool validation
│   ├── mcp.mjs            # MCP configuration
│   ├── skills.mjs         # Skill discovery
│   ├── workspace.mjs      # File operations
│   └── ...
├── scripts/               # Utility scripts
│   ├── lint.mjs          # Dependency-free linting
│   ├── format.mjs        # Dependency-free formatting
│   ├── evaluate.mjs      # Model evaluation
│   └── install.mjs       # Installation script
├── tests/                 # Tests
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration
│   ├── e2e/              # End-to-end
│   ├── skills/           # Skills
│   └── helpers/          # Utilities
├── skills/               # Built-in skills
├── .minagent/            # MCP configuration
├── .env.example          # Configuration template
├── .nvmrc                # Node.js version
├── package.json          # Project configuration
├── README.md             # This documentation
├── INSTALLATION.md       # Installation guide
└── AGENTS.md             # Agent guide
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards

- **ESLint** - Syntax validation
- **Prettier** - Consistent formatting
- **Node.js --test** - Native tests

### Before Contributing

```bash
npm run check-all
```

## 📄 License

Distributed under the [MIT License](LICENSE).

---

**MinAgent** - Your CLI/TUI coding agent 🚀
