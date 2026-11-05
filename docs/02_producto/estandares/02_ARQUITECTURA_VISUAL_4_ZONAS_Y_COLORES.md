# 🎨 Arquitectura Visual de 4 Zonas y Sistema Cromático

Toda pantalla del ERP AlonCar adopta la estética naval oscura de alta legibilidad, enmarcada en 4 zonas delimitadas por bordes laterales de color específicos.

---

## 1. Mapa de Bordes Cromáticos por Zona

| Zona | Clase Base | Color de Acento | Identidad Visual y Rol |
| :--- | :--- | :--- | :--- |
| **Zona 1: Contexto** | `.alon-zone-context` | Azul Cielo (`border-l-sky-400`) | Título principal del módulo, migas de pan (`Breadcrumbs`), conmutador de modo y botón de alta principal. |
| **Zona 2: Radar de KPIs** | `.alon-zone-kpis` | Ámbar Cálido (`border-l-amber-400`) | Monitoreo en vivo de métricas críticas y alertas operativas. *(Opcional: si un módulo funcionalmente no requiere KPIs, esta zona se omite por completo)*. |
| **Zona 3: Toolbar de Control** | `.alon-zone-toolbar` | Cian Eléctrico (`border-l-cyan-400`) | Buscador omnicanal profundo, selectores rápidos de filtrado, botones Deshacer (`Ctrl+Z`) y Rehacer (`Ctrl+Y`). |
| **Zona 4: Planilla Sheets** | `.alon-zone-grid` | Borde Superior Esmeralda (`border-t-emerald-500/60`) | Hoja de cálculo interactiva con cabecera sticky, celdas interactivas y fill-down. |

---

## 2. Reglas Mandatorias para la Zona 2: Radar de KPIs y Alertas

Cuando un módulo requiere Zona de KPIs (como Compras o Pañol):

### A. Cromatismo Único por Tarjeta (Prohibido Repetir Colores)
Cada tarjeta debe tener su propio acento cromático para que el usuario identifique el estado de un vistazo:
- **Alerta Crítica / Falta OT:** Rojo Carmín (`border-rose-500/50 bg-rose-950/30 text-rose-300`)
- **Estado Inicial / Por Emitir:** Amarillo Ámbar (`border-amber-500/50 bg-amber-950/30 text-amber-300`)
- **Evaluaciones / Cotizaciones:** Violeta Eléctrico (`border-purple-500/50 bg-purple-950/30 text-purple-300`)
- **En Proveedor / Logística:** Azul Cobalto (`border-blue-500/50 bg-blue-950/30 text-blue-300`)
- **En Consulta / Se Compra?:** Rosa Fucsia (`border-pink-500/50 bg-pink-950/30 text-pink-300`)
- **Alta Catálogo / Faltantes:** Magenta (`border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-300`)
- **Completados / Recibidos:** Verde Esmeralda (`border-emerald-500/50 bg-emerald-950/30 text-emerald-300`)
- **Auditoría / Costos:** Bordo / Terracota (`border-red-600/50 bg-red-950/30 text-red-300`)

### B. Jerarquía y Tipografía Extragrande
- El número métrico debe ser el elemento más visible (`text-xl font-black font-mono`).
- Título conciso arriba (`text-xs font-bold uppercase tracking-wider`).
- Padding vertical contenido (`p-3` o `py-2.5 px-3.5`) para no robar espacio a la planilla.

### C. Prohibición de la Palabra "Filtrar"
- **PROHIBIDO** incluir badges o textos que digan "Filtrar". Toda la tarjeta es un botón interactivo. Al hacer clic se ilumina con `ring-2 ring-current` y filtra la planilla en 1 toque.
