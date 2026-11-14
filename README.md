# App_AlonCar — ERP Naval e Industrial

## FASE ACTUAL: 3 — Aplicación Web ERP Activa (React + Supabase + n8n + IA)

Sistema integral de gestión para astillero naval bajo arquitectura **Spec Driven Development (SDD)** y protocolo unificado de gobernanza IA.

### Stack Técnico
- **Frontend Web (`app/`):** React 19 + Vite + Tailwind CSS v4 + `lucide-react` (`useSpreadsheetGrid` estilo Excel/Sheets, 5 Zonas cromáticas)
- **Base de Datos y Auth:** Supabase (PostgreSQL, migraciones SQL `0001`–`0040`, RLS, Edge Functions)
- **Orquestador y Alertas:** n8n (`workflows/`) + Evolution API (WhatsApp)
- **Servidor MCP Local:** `mcp-server/` (Model Context Protocol sobre Node.js)
- **Asistencia IA:** OpenAI `gpt-4o-mini` (tabulador de partes, OCR/extracción de comprobantes y gobernanza en `/admin`)

### Estado Actual
- ✅ Infraestructura, credenciales Zero Trust, servidor MCP y workflows n8n SDD (`docs/01_infraestructura/`, `workflows/`)
- ✅ Módulos operativos `CARGA_EDICION` y `METRICAS_ANALISIS` activos: Flota (`/barcos`), Personal (`/personal`), Horas (`/horas`), Compras (`/compras`), Pañol y Gases (`/panol`), OTs (`/ots`), Terceros (`/terceros`), Tesorería (`/tesoreria`), Resumen Gerencial GS-004 (`/resumen-gerencial`) y Admin (`/admin`)
- ⏳ Optimización IA y saneamiento estructural (`PLAN_OPTIMIZACION_IA.md`)

### Cómo empezar
1. Clonar el repositorio e instalar dependencias del frontend: `cd app && npm install`.
2. Configurar `.env` (raíz/MCP) y `app/.env.local` siguiendo [docs/01_infraestructura/02_configuracion_env.md](docs/01_infraestructura/02_configuracion_env.md) y [docs/01_infraestructura/03_seguridad_credenciales.md](docs/01_infraestructura/03_seguridad_credenciales.md).
3. Levantar el entorno local: `cd app && npm run dev` (ver detalles en [app/README.md](app/README.md)).

---

## 📚 Mapa de Documentación

```text
App_AlonCar/
├── README.md                  ← Portada del proyecto (este archivo)
├── GEMINI.md                  ← Protocolo de Gobernanza Unificado (Fuente Única de Verdad)
├── CLAUDE.md                  ← Puntero de compatibilidad hacia GEMINI.md
├── INDICE_CENTRAL.md          ← Brújula humana y entry-points del repo
├── INDICE_METADATOS.md        ← Tabla máquina (100% de archivos activos indexados)
├── INDICE_PLANILLAS.md        ← Estado y dependencias de planillas legacy mapeadas
├── TAREAS_PENDIENTES.md       ← Backlog activo y últimos cierres
├── ROADMAP_NEGOCIO.md         ← Visión de módulos y reglas de negocio
├── app/                       ← Frontend React + Vite + Tailwind + servicios Supabase
├── supabase/                  ← Migraciones SQL y Edge Functions
├── workflows/                 ← Workflows n8n gobernados por SDD (_meta/INDEX.md)
├── mcp-server/                ← Servidor MCP local
├── .agents/skills/            ← Skills transversales y por módulo (SKILLS_REGISTRY.md)
└── docs/
    ├── 01_infraestructura/    ← Stack, .env, Zero Trust, MCP y n8n
    ├── 02_producto/           ← Decisiones (DEC), Errores (ERR), Estándares y Auditorías
    ├── 03_negocio/            ← Reglas de negocio, RACI, Tarifario Alfa y Spec v7
    ├── modulos/               ← Especificaciones funcionales por módulo
    ├── planillas/             ← Mapeos de Google Sheets legacy
    └── archivo/               ← Históricos rotados de tareas, bitácora y estándares
```

---

## 🤖 Para Agentes IA

1. **Constitución:** Leer y cumplir [GEMINI.md](GEMINI.md) en cada turno (incluye Router `SKL-016`, Pipeline F1–F4 y Regla de Oro de Disco).
2. **Navegación:** Consultar [INDICE_CENTRAL.md](INDICE_CENTRAL.md) y [docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md](docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md) antes de asumir módulos o tablas.
3. **Auditorías e Inventario:** Usar [INDICE_METADATOS.md](INDICE_METADATOS.md), [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) y [.agents/skills/SKILLS_REGISTRY.md](.agents/skills/SKILLS_REGISTRY.md).
