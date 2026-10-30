# MinAgent Scripts

Scripts de utilidad para el mantenimiento y evaluación de MinAgent.

## 📦 Scripts Disponibles

### `lint.mjs` - Linter sin dependencias

Valida la sintaxis del código y aplica reglas de estilo.

**Características:**
- Verificación de sintaxis usando `node --check`
- Detección de declaraciones `debugger`
- Enforce de `const`/`let` sobre `var`
- Cubre `src/`, `tests/`, `scripts/`

**Uso:**
```bash
# Validación completa
npm run lint
node scripts/lint.mjs

# Solo sintaxis
npm run check
node scripts/lint.mjs --syntax-only
```

**Exit codes:**
- `0` - Todos los archivos limpios
- `1` - Errores encontrados

---

### `format.mjs` - Formateo sin dependencias

Verifica y corrige formato de archivos.

**Características:**
- Elimina espacios en blanco al final de líneas
- Asegura nueva línea final
- Auto-corrección con `--write`
- Cubre `src/`, `tests/`, `scripts/`

**Uso:**
```bash
# Verificar formato
npm run format
node scripts/format.mjs

# Auto-corregir
npm run format
node scripts/format.mjs --write
```

**Exit codes:**
- `0` - Todos los archivos limpios
- `1` - Archivos necesitan formato

---

### `evaluate.mjs` - Evaluación de modelo

Ejecuta pruebas aisladas contra el API configurado.

**Características:**
- 5 fixtures de evaluación:
  - Targeted editing
  - Read continuation
  - Plan boundaries
  - Recovery after external edit
  - /init command
- Salida JSON con métricas
- Sin modificar archivos del repositorio

**Uso:**
```bash
# Ejecutar evaluación en vivo
npm run evaluate
node scripts/evaluate.mjs --live
```

**Salida:**
```json
{
  "model": "gpt-4o",
  "total": 5,
  "passed": 5,
  "failed": 0,
  "elapsed": 12.5,
  "tokens": {
    "prompt": 1024,
    "completion": 512
  }
}
```

**Exit codes:**
- `0` - Todas las pruebas pasadas
- `1` - alguna prueba fallida

---

### `install.mjs` - Instalación automática

Verifica requisitos y configura el entorno.

**Características:**
- Verifica versión de Node.js (≥22.0.0)
- Verifica npm en PATH
- Crea `.env` si no existe
- Ejecuta health checks

**Uso:**
```bash
# Ejecutar instalación
npm run install
node scripts/install.mjs
```

**Exit codes:**
- `0` - Instalación exitosa
- `1` - Instalación fallida

---

## 🚀 Scripts de npm

```bash
# Instalación
npm run install

# Pruebas
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage

# Validación
npm run check-all       # lint + format + test
npm run check           # Solo lint
npm run format          # Solo format

# Evaluación
npm run evaluate        # Live evaluation

# Diagnostics
npm run doctor          # Health checks
```

---

## 📝 Notas

- Todos los scripts son **dependency-free** (sin dependencias externas)
- Usan solo módulos nativos de Node.js
- Funcionan en Node.js ≥22.0.0
- Soportan ES modules (`type: "module"` en package.json)
