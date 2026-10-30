# MinAgent - Requisitos de instalación

## Requisitos previos

1. **Node.js 22+ instalado**
   - Descarga desde: https://nodejs.org/
   - Verifica: `node --version` y `npm --version`

2. **npm en PATH**
   - Debe poder ejecutar: `where npx` o `where npm`
   - Si no funciona, agrega Node.js a tu variable PATH

## Configuración de servidores MCP

### Para usuarios con Node.js en ruta estándar (C:\Program Files\nodejs)

El archivo `.minagent/mcp.json` ya está configurado para usar `npx`. Si tienes problemas, usa esta configuración:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/ruta/a/tus/archivos"]
    },
    "better-playwright-mcp3": {
      "command": "npx",
      "args": ["-y", "better-playwright-mcp3@v3.2.0"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "brave-search-mcp"],
      "env": {
        "BRAVE_API_KEY": "TU_API_KEY_AQUI"
      }
    },
    "duckduckgo-websearch": {
      "command": "npx",
      "args": ["-y", "duckduckgo-websearch"]
    }
  }
}
```

### Para usuarios con Node.js en ruta personalizada

Si `where npx` no funciona, necesitas configurar la ruta completa. Ejemplo:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "C:\\Ruta\\Completa\\a\\Node\\npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```

## Modos de permisos y límites (`.env`)

- `MCP_MODE=ask` - Pide aprobación antes de usar cada herramienta MCP (recomendado para primer uso)
- `MCP_MODE=auto` - Usa herramientas MCP automáticamente sin preguntar
- `MCP_MODE=off` - Deshabilita completamente las herramientas MCP
- `MCP_MAX_TOOLS=50` - Límite máximo de herramientas MCP cargadas simultáneamente (por defecto 50)

- `TERMINAL_MODE=ask` - Pide aprobación antes de ejecutar comandos de terminal
- `TERMINAL_MODE=auto` - Ejecuta comandos de terminal automáticamente
- `TERMINAL_MODE=off` - Deshabilita comandos de terminal

## Solución de problemas

### Error: "spawn npx ENOENT"
- Verifica que Node.js esté instalado: `node --version`
- Verifica que npx esté en PATH: `where npx`
- Si no funciona, agrega la ruta de Node.js a tu variable PATH de sistema

### Error: "MCP server could not be connected"
- Asegúrate de tener conexión a internet para la instalación automática
- Verifica que los paquetes se puedan instalar: `npx -y @playwright/mcp --help`

### Error: "Could not load MCP configuration"
- Verifica que el archivo `.minagent/mcp.json` exista y sea válido JSON
- Verifica la ruta del archivo en `.env` o configuración

## Configuración recomendada para usuarios nuevos

1. **Edita `.env`**:
   ```
   MCP_MODE=ask
   TERMINAL_MODE=ask
   SKILLS_MODE=ask
   ```

2. **Edita `.minagent/mcp.json`**:
   - Cambia `"C:/Users/Predator/Documents"` por tu ruta de archivos
   - Reemplaza `"BSArsZg6Baf3udBa4IhYhRxw8pk2Ghp"` con tu API key de Brave (o elimina esa línea si no la usas)

3. **Ejecuta MinAgent** y acepta las aprobaciones iniciales
