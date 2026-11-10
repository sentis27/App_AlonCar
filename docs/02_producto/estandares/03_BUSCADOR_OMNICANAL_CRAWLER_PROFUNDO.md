# 🔍 Buscador Omnicanal Profundo (Crawler Universal de Registros)

El buscador de la Zona 3 no debe acotarse a 3 o 4 columnas arbitrarias. Si un módulo añade nuevas columnas, comprobantes, submenús de fletes o archivos adjuntos, el buscador debe encontrarlos automáticamente sin requerir mantenimiento de código.

---

## 1. Principio del Crawler Universal (`buildUniversalSearchCorpus`)

Para cada registro de la grilla, el motor de búsqueda construye un `corpus` de texto unificado extrayendo recursivamente:
1. **Todas las propiedades nativas del registro:** Valores de tipo `string` o `number` (excluyendo únicamente UUIDs técnicos de 36 caracteres con guiones y marcas booleanas).
2. **Entidades Hijas y Submenús Vinculados:**
   - **Logística y Fletes:** Nombre del transporte, chofer, número de guía, estado del flete.
   - **Documentos Adjuntos y PDFs:** Nombre de archivo, tipo de documento y **texto indexado extraído de PDFs** (vía `pdfTextExtractor`).
   - **Observaciones y Notas Técnicas:** Textos libres de cualquier sub-formulario vinculado.

---

## 2. Implementación Canónica en `/lib/searchEngine.js`

```javascript
/**
 * Genera el corpus de búsqueda para un registro evaluando todas sus columnas y datos adjuntos.
 */
export function buildUniversalSearchCorpus(record, options = {}) {
  const parts = []

  // 1. Barrido recursivo de propiedades del registro
  for (const [key, val] of Object.entries(record)) {
    if (val === null || val === undefined) continue
    if (typeof val === 'string') {
      const trimmed = val.trim()
      // Ignorar UUIDs técnicos puros
      if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) continue
      if (trimmed) parts.push(trimmed)
    } else if (typeof val === 'number') {
      parts.push(String(val))
    }
  }

  // 2. Entidades hijas vinculadas (Fletes, Comprobantes, Terceros)
  if (record.freight_transport_name) parts.push(record.freight_transport_name)
  if (record.freight_guide_number) parts.push(record.freight_guide_number)
  if (record.invoice_number) parts.push(record.invoice_number)

  // 3. Documentos y PDFs adjuntos vinculados
  if (Array.isArray(options.documents)) {
    options.documents.forEach((doc) => {
      if (doc.file_name) parts.push(doc.file_name)
      if (doc.extracted_text) parts.push(doc.extracted_text)
    })
  }

  return normalizeSearchText(parts.join(' '))
}

export function normalizeSearchText(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
```

---

## 3. Regla de Visibilidad Permanente y Ubicación en Nivel 1 de Zona 3

1. **Prohibición Absoluta de Ocultar el Buscador:** El `CrawlerSearchBar` **nunca** debe desaparecer de la vista del operario cuando este hace scroll hacia las filas inferiores de cualquier tabla.
2. **Estructura de 2 Niveles en `.alon-zone-toolbar`:**
   - **Nivel 1 (Arriba):** `<CrawlerSearchBar />` dedicado en la primera fila de la Zona 3 (nunca desplazado ni comprimido al costado de otros selectores).
   - **Nivel 2 (Abajo):** Píldoras de segmentación rápida (`Todos`, `Astillero`, `Contratistas`, etc.), selectores de filtro y botones de `Deshacer / Rehacer`.
3. **Bloque Operativo Unificado (`.alon-workspace-block` + `.alon-grid-scroll`):** Al envolver `.alon-zone-toolbar` y `.alon-zone-grid` dentro de `.alon-workspace-block` (`sticky top-0 z-20 flex flex-col gap-2.5`) y dimensionar el scroll de la tabla con `.alon-grid-scroll` (`max-h-[calc(100vh-260px)]`), la Zona 3 jamás se superpone sobre la Zona 4 y el operario ve simultáneamente en todo momento:
   - **Nivel 1 de Zona 3:** Buscador `CrawlerSearchBar`
   - **Nivel 2 de Zona 3:** Píldoras/selectores compactos de filtro activo + `Undo/Redo`
   - **Zona 4:** Borde esmeralda superior + `GridRibbon` + Títulos de columnas (`thead sticky`) + Filas de datos en scroll.

---

## 4. Componente Canónico: `CrawlerSearchBar.jsx`

En lugar de crear inputs HTML repetidos en cada módulo, toda la interfaz del buscador de la Zona 3 está encapsulada en `app/src/components/CrawlerSearchBar.jsx`:

```jsx
import CrawlerSearchBar from '../components/CrawlerSearchBar'

<CrawlerSearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  onClear={clearAllFilters}
  placeholder="Buscar por material, proveedor, buque, OT... (Ctrl+F | Esc limpia todo)"
/>
```
* **Ventaja Arquitectónica:** Si se cambia el diseño, color, bordes o animaciones del buscador en `CrawlerSearchBar.jsx`, impacta en todos los módulos de inmediato sin tocar archivos individuales.
- **Atajo `Ctrl+F`:** Pone el foco inmediatamente en el input del buscador (`inputRef.current.focus()`).
- **Atajo `Escape`:** Si el buscador tiene foco o texto, limpia la búsqueda y restablece la grilla al estado general.
- **Resaltado Visual de Coincidencias (`HighlightText`):**  
  Cualquier celda que contenga el fragmento buscado debe envolver la coincidencia con:
  ```jsx
  <mark className="bg-yellow-400/80 text-slate-950 font-bold px-0.5 rounded shadow-sm">
    {matchingSubstring}
  </mark>
  ```
- **Alerta de Fletes o Documentos Coincidentes:** Si la coincidencia provino de un archivo PDF o dato de flete, el ícono correspondiente (`Paperclip` o `Truck`) se ilumina en ámbar con animación de pulso (`animate-pulse`).
