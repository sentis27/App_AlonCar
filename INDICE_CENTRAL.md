# 🗺️ Índice Central — App_AlonCar

> Brújula de navegación hacia los puntos de entrada reales del repositorio. Para tabla máquina completa de archivos activos, usar [INDICE_METADATOS.md](INDICE_METADATOS.md).

## 📍 Estado Actual
- **Fase:** `3` — Aplicación Web ERP Naval Activa (React + Vite + Tailwind + Supabase + n8n + IA)
- **Módulos activos:** Flota (`/barcos`), Personal (`/personal`), Horas (`/horas`), Compras (`/compras`), Pañol y Gases (`/panol`), OTs (`/ots`), Terceros (`/terceros`), Tesorería (`/tesoreria`), Resumen Gerencial GS-004 (`/resumen-gerencial`), Admin (`/admin`)
- **Backlog activo:** [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) · **Plan IA actual:** [PLAN_OPTIMIZACION_IA.md](PLAN_OPTIMIZACION_IA.md)

---

## 🧭 Gobernanza, Constitución y Skills

| Documento | Rol / Entry-Point | Para Quién |
| :--- | :--- | :--- |
| [GEMINI.md](GEMINI.md) | Protocolo de Gobernanza Unificado (`v1.4`) — Fuente Única de Verdad | Todos / Agentes IA |
| [CLAUDE.md](CLAUDE.md) | Puntero de compatibilidad hacia `GEMINI.md` | Claude Code |
| [README.md](README.md) | Portada del proyecto, stack actual y arranque rápido | Todos |
| [INDICE_METADATOS.md](INDICE_METADATOS.md) | Tabla máquina con 100% de archivos activos y dependencias | Agentes IA |
| [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) | Pendientes `[ ]` activos y últimos 5 cierres (`docs/archivo/`) | Todos / Agentes IA |
| [.agents/skills/SKILLS_REGISTRY.md](.agents/skills/SKILLS_REGISTRY.md) | Catálogo maestro de Skills (`SKL-001`..`SKL-017`) | Agentes IA |

---

## 🏗️ Estándares ERP, Arquitectura y Auditorías

| Documento | Contenido | Uso |
| :--- | :--- | :--- |
| [00_INDICE_DE_MODULOS_Y_CLASIFICACION.md](docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md) | Padrón "Gallo o Gallina" (`CARGA_EDICION` vs `METRICAS_ANALISIS`), rutas y tablas Supabase | Pre-Flight obligatorio |
| [docs/02_producto/estandares/](docs/02_producto/estandares/01_CLASIFICACION_FUNCIONAL_GALLO_O_GALLINA.md) | Estándares `01..07` (4/5 Zonas, Crawler, Grilla, Barra Inferior, Modales, `audit_logs`) | UI / Grillas / Auditoría |
| [docs/00_ARQUITECTURA_TABLAS_Y_FOLIOS.md](docs/00_ARQUITECTURA_TABLAS_Y_FOLIOS.md) | Padrón maestro de folios monótonos (`#` DNI de Fila inviolable) | Grillas ERP |
| [docs/02_producto/05_auditorias/README.md](docs/02_producto/05_auditorias/README.md) | Línea base (`LINEA_BASE_ARQUITECTURA.md`) y ledger diario (`BITACORA_DELTAS_SESION.md`) | Auditorías SKL-017 |
| [docs/02_producto/README.md](docs/02_producto/README.md) | Bitácora de producto (`DEC-001..026`, `ERR-001..005`, `CON`, `PRO`) | Producto / Agentes IA |

---

## ⚙️ Infraestructura, Negocio, Planillas y App

| Documento | Contenido | Estado |
| :--- | :--- | :--- |
| [docs/01_infraestructura/README.md](docs/01_infraestructura/README.md) | Stack técnico, `.env`, seguridad Zero Trust, MCP y n8n (`01..05`) | ✅ Activo |
| [workflows/_meta/INDEX.md](workflows/_meta/INDEX.md) | Índice maestro y SDD obligatorio (`PLANTILLA.md`) de workflows n8n | ✅ Activo |
| [docs/03_negocio/README.md](docs/03_negocio/README.md) | Reglas de negocio, RACI, Tarifario Nivel Alfa y Sistema de Revisión | ✅ Activo |
| [docs/spec_tabla_de_tablas_v7.md](docs/spec_tabla_de_tablas_v7.md) | Especificación técnica de tablas Supabase v7 | ✅ Activo |
| [docs/MATRIZ_RESPONSABILIDAD_DATOS.md](docs/MATRIZ_RESPONSABILIDAD_DATOS.md) | Matriz de responsabilidad de datos y alertas proactivas WhatsApp / In-App | ✅ Activo |
| [INDICE_PLANILLAS.md](INDICE_PLANILLAS.md) | Inventario y dependencias de planillas Google Sheets legacy (`docs/planillas/`) | ✅ Activo |
| [ROADMAP_NEGOCIO.md](ROADMAP_NEGOCIO.md) | Visión funcional de los 6 pilares del ERP | ✅ Referencia |
| [app/README.md](app/README.md) | Guía local del frontend Vite + React (`app/src/`) | ✅ Activo |

---

## 🔍 Regla de Mantenimiento

- Todo archivo `.md` nuevo o movido debe indexarse en [INDICE_METADATOS.md](INDICE_METADATOS.md).
- Las pantallas y tablas nuevas de la App se indexan en [00_INDICE_DE_MODULOS_Y_CLASIFICACION.md](docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md) (no duplicar listas de `app/src/` aquí).
- Última actualización: `2026-11-13` (Saneamiento documental E4).
