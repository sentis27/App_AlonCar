# Skill 01: Mapeo Legacy de Sheets

## 1. Identidad de la Skill
- **Nombre:** Mapeo Legacy
- **Propósito:** Realizar ingeniería inversa a las planillas actuales de Google Sheets para documentar su lógica y estructura de cara a la migración a Supabase.
- **Trigger Típico:** *"Quiero mapear la planilla de X."*

## 2. Herramientas MCP Requeridas (Tools)
- `read_sheet_logic`: Herramienta que descarga el rango `A1:ZZ50` con la opción `valueRenderOption="FORMULA"`, para poder ver las fórmulas ocultas y los valores reales.
- `read_app_script`: Herramienta que descarga el código `.gs` atado a la planilla (requiere Google Apps Script API).

## 3. Protocolo de Ejecución (Instrucciones para el Agente)
Cuando se invoque esta skill, el Agente debe seguir **estrictamente** estos pasos:

1. **Recepción del Contexto:** Escuchar la descripción del usuario sobre cómo se usa la planilla. Si falta contexto, preguntar antes de continuar.
2. **Ejecución MCP:** Ejecutar `read_sheet_logic` en la planilla indicada.
3. **Análisis:** Inferir los tipos de datos, buscar la fila real de encabezados (la más densa), y detectar fórmulas/validaciones de estado (ej: `=IF(ISBLANK...)`).
4. **Instanciación de la Plantilla:** Tomar la estructura vacía ubicada en [00_plantilla_mapeo_sheets.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/docs/03_negocio/00_plantilla_mapeo_sheets.md).
5. **Generación del Borrador:** Rellenar la plantilla con la información combinada (MCP + Usuario) y presentarla en el chat (Anteproyecto).
6. **Regla de Cero Vacíos:** Si el agente no tiene información para un campo (ej: "¿Quiénes son los Usuarios Principales?"), DEBE dejar la ejecución en pausa y preguntarle al usuario. **Está prohibido dejar campos con "[Falta Dato]" y dar la tarea por terminada.**
7. **Guardado:** Una vez aprobado el borrador por el usuario, guardar el archivo en la carpeta correspondiente de `docs/03_negocio/`.
