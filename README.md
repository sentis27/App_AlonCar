# App_AlonCar - ERP Naval e Industrial

## FASE ACTUAL: 1 - Infraestructura y Conexiones

Este proyecto se construye bajo la metodología **Spec Driven Development (SDD)**.

### Stack Técnico
- **Entrada de datos:** Google Sheets
- **Orquestador:** n8n (instancia local/Docker)
- **Servidor de procesamiento:** MCP (Model Context Protocol)
- **Base de datos:** Supabase / PostgreSQL
- **Asesor técnico:** Antigravity (Claude MCP)

### Estado Actual
- ✅ Estructura de conexiones (Fase 1)
- ✅ Servidor MCP base y dependencias locales (Fase 1)
- ⏳ Integración de herramientas MCP (en progreso)
- 🔜 Lógica de negocio (Fase 2 - ver [ROADMAP_NEGOCIO.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/ROADMAP_NEGOCIO.md))
- 🔜 Módulos de datos (Fase 3)

### Cómo empezar
1. Clonar el repo.
2. Leer el índice central del proyecto: [INDICE_CENTRAL.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/INDICE_CENTRAL.md).
3. Configurar el entorno local `.env` siguiendo [docs/01_infraestructura/02_configuracion_env.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/docs/01_infraestructura/02_configuracion_env.md).

---

## 📚 Documentación

La estructura completa del proyecto está distribuida de la siguiente manera:

```text
App_AlonCar/
├── README.md                  ← Resumen del proyecto
├── INDICE_CENTRAL.md          ← Empieza aquí (Mapa de navegación)
├── TAREAS_PENDIENTES.md       ← Backlog central y checklist
├── ROADMAP_NEGOCIO.md         ← Visión de Fase 2+
├── GUIA_ANTIGRAVITY.md        ← Reglas de comportamiento del agente
└── docs/
    ├── 01_infraestructura/    ← FASE 1 (Actual)
    │   ├── README.md          ← Índice de infraestructura
    │   ├── 01_stack_tecnico.md
    │   ├── 02_configuracion_env.md
    │   ├── 03_seguridad_credenciales.md
    │   └── 04_servidor_mcp.md
    │
    ├── 02_producto/           ← Referencia educativa/comercial
    │   ├── README.md          ← Índice de producto
    │   └── registro_paso_a_paso.md
    │
    └── 03_negocio/            ← FASE 2+ (Futuro)
        └── README.md          ← Esqueleto de lógica de negocio
```

---

## 👥 Para Agentes IA (Antigravity)

Antes de procesar cualquier solicitud, debes leer y cumplir estrictamente las siguientes instrucciones:
1. **Consulta del Índice:** Revisa de manera obligatoria [INDICE_CENTRAL.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/INDICE_CENTRAL.md) antes de procesar tareas complejas.
2. **Optimización de Contexto:** No leas documentos completos si no están listados en el índice central o si están fuera de tu ámbito técnico.
3. **Control del Backlog:** Si necesitas verificar tareas o archivos faltantes, consulta [TAREAS_PENDIENTES.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/TAREAS_PENDIENTES.md).
4. **Rol de Asesor:** Tu rol es de **asesor técnico crítico** durante la Fase 1; posteriormente serás colaborador en el diseño lógico de negocio durante las Fases 2 y 3. Debes actuar con criterio analítico desafiando supuestos incorrectos. Ver normas detalladas en [GUIA_ANTIGRAVITY.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/GUIA_ANTIGRAVITY.md).

---

## 📖 Visión a Futuro (Fase 2+)

El proyecto implementará progresivamente 6 módulos funcionales centrales:
* **Módulo de Activos y Clientes:** Gestión unificada de Barcos y razones sociales.
* **Módulo de Recursos:** Tarifarios de operarios internos/externos y talleres.
* **Módulo de Operaciones y Control de Costos:** Órdenes de Trabajo y asistencia.
* **Módulo de Logística y Suministros:** Inventario y compras imputadas a OTs.
* **Módulo Comercial:** Presupuestos dinámicos y facturación estructurada.
* **Módulo de Cierre y Auditoría:** Cierre contable y archivo histórico bloqueado.
