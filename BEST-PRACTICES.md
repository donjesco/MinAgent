# Mejores Prácticas para MinAgent

## 🚀 Uso de Skills

### Skills Esenciales

#### 1. project-investigation
**Usa cuando**: Comienzas a trabajar en un proyecto nuevo o necesitas entender el código.

```bash
# Inicia investigación
/project-investigation

# O delega a subagent
delegate_task(
    goal="Investigate project structure",
    context="Follow project-investigation skill"
)
```

**Fases**:
1. Discovery - Leer docs, analizar config
2. Analysis - Entry points, dependencies
3. Errors - Debugging sistemático
4. Improvements - Quality, coverage, security

#### 2. systematic-debugging
**Usa cuando**: Necesitas encontrar la causa raíz de un bug.

```bash
# Debugga un error
/systematic-debugging

# O delega
delegate_task(
    goal="Find root cause of [error]",
    context="Follow systematic-debugging skill"
)
```

**Fases**:
1. Root Cause Investigation
2. Pattern Analysis
3. Hypothesis and Testing
4. Implementation

#### 3. test-driven-development
**Usa cuando**: Vas a implementar una nueva funcionalidad.

```bash
# Escribe tests primero
/test-driven-development

# O delega
delegate_task(
    goal="Implement feature with TDD",
    context="Follow test-driven-development skill"
)
```

**Proceso**:
1. RED - Escribe test que falla
2. GREEN - Implementa mínimo para pasar
3. REFACTOR - Mejora código

#### 4. codebase-inspection
**Usa cuando**: Necesitas analizar el tamaño y composición del código.

```bash
# Analiza código
/codebase-inspection

# O ejecuta
pygount --folders-to-skip="node_modules,venv" .
```

**Output**:
- Language breakdown
- Lines of code
- File counts
- Code vs comment ratios

---

## 🔧 Configuración

### .env

```env
# Permisos - Primer uso (recomendado)
MCP_MODE=ask
TERMINAL_MODE=ask
SKILLS_MODE=ask

# Permisos - Producción
# MCP_MODE=auto
# TERMINAL_MODE=auto
# SKILLS_MODE=auto

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
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/ruta/a/archivos"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"]
    },
    "duckduckgo-mcp-server": {
      "command": "npx",
      "args": ["-y", "@ericthered926/duckduckgo-mcp-server@0.6.0"]
    }
  }
}
```

---

## 📋 Flujos de Trabajo Comunes

### Flujo 1: Nuevo Proyecto

```bash
# 1. Inicia investigación
/project-investigation

# 2. Habilita skills
SKILLS_MODE=ask

# 3. Instala dependencias
npm install

# 4. Ejecuta tests
npm run test

# 5. Verifica linting
npm run lint
```

### Flujo 2: Debugging

```bash
# 1. Systematic debugging
/systematic-debugging

# 2. Code inspection
/codebase-inspection

# 3. Verifica fix
npm run test
npm run lint
```

### Flujo 3: Mejoras

```bash
# 1. Analiza código
/codebase-inspection

# 2. Verifica tests
npm run test -- --coverage

# 3. Code review
/requesting-code-review

# 4. Simplifica
/simplify-code
```

---

## 🛠️ Comandos Útiles

### Verificar estado
```bash
npm run check      # Syntax check
npm run format     # Format check
npm run test       # Run tests
npm run doctor     # Health check
```

### Investigación
```bash
# Analizar proyecto
/search_files "*.md" target="files"
/read_file path="README.md"

# Analizar código
/search_files "*.js" target="files"
/search_files "*.ts" target="files"
```

### Debugging
```bash
# Ejecutar tests específicos
npm run test -- --testNamePattern="failing_test"

# Debug con terminal
terminal(command="npm run test", timeout=60)
```

---

## ⚠️ Pitfalls Comunes

### 1. Saltar investigación
❌ **Mal**: "Voy a arreglar esto directamente"
✅ **Bien**: "/project-investigation primero"

### 2. No usar skills
❌ **Mal**: SKILLS_MODE=off
✅ **Bien**: SKILLS_MODE=ask

### 3. Ignorar tests
❌ **Mal**: "Los tests los escribo después"
✅ **Bien**: TDD - tests primero

### 4. No verificar
❌ **Mal**: "Confío en que funciona"
✅ **Bien**: `npm run test`, `npm run lint`

---

## 📚 Recursos

### Documentation
- [README.md](README.md) - Overview completo
- [INSTALLATION.md](INSTALLATION.md) - Setup guide
- [INVESTIGATION.md](INVESTIGATION.md) - Análisis detallado
- [CONFIG-IMPROVEMENTS.md](CONFIG-IMPROVEMENTS.md) - Mejoras
- [EXECUTIVE-SUMMARY.md](EXECUTIVE-SUMMARY.md) - Resumen ejecutivo

### Skills
- `project-investigation` - Investigación de proyectos
- `systematic-debugging` - Debugging sistemático
- `test-driven-development` - TDD workflow
- `codebase-inspection` - Análisis de código

### Herramientas
- `search_files` - Buscar archivos
- `read_file` - Leer archivos
- `terminal` - Ejecutar comandos
- `delegate_task` - Delegar a subagents

---

## 🎯 Checklist Pre-Commit

- [ ] Tests pasan (`npm run test`)
- [ ] Linting limpio (`npm run lint`)
- [ ] Formatting correcto (`npm run format`)
- [ ] Code review solicitado
- [ ] Documentación actualizada
- [ ] No hay console.log en producción
- [ ] Tipos correctos (si aplica)
- [ ] Manejo de errores implementado

---

## 📊 Métricas de Calidad

### Code Quality
- **Coverage objetivo**: 80%+
- **Tests**: Cada función debe tener test
- **Docs**: Cada módulo debe estar documentado
- **Types**: Tipado completo (si aplica)

### Performance
- **Test suite**: < 30 segundos
- **Linting**: < 10 segundos
- **Build**: < 60 segundos
- **Memory leaks**: Ninguno

---

**Última actualización**: 2026-10-26  
**Versión**: 1.0.0  
**Autor**: Hermes Agent
