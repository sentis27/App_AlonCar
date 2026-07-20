---
id: DEC-007
tipo: decision
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Blindaje anti-alucinaciones en Set - PromptConfig vs. parches de post-procesamiento JS

## Contexto
Durante las pruebas de transcripción y parseo con `gpt-4o-mini`, el modelo demostró sensibilidad a la estructura del texto: alteraba su interpretación ante saltos de línea inusuales y confundía frases conectoras como "a cargo de Tobares/Lorenzi" (donde un operario es cedido temporalmente), interpretando erróneamente al contratista como el sujeto que realiza la acción o inventando variaciones de nombres. Se intentó solucionar esto aplicando parches y expresiones regulares de limpieza en scripts posteriores (`E3b` / `E4`).

## La duda
¿Es viable corregir alucinaciones semánticas y nombres mal interpretados del LLM mediante scripts de limpieza post-procesamiento en n8n, o debe resolverse directamente en las instrucciones raíz del prompt?

## La decisión
Abandonar los parches de limpieza post-procesamiento en JavaScript para alucinaciones semánticas y concentrar todo el control de restricciones en el nodo **`Set - PromptConfig`** (`prompt_astillero`, `prompt_contratistas`, `prompt_maquinistas` y `prompt_version`). Se introdujeron reglas explícitas de sistema que:
- Obligan al modelo a mapear cada sujeto exclusivamente a los nombres exactos presentes en la lista pre-filtrada del catálogo adjunto.
- Instruyen al modelo para interpretar conectores como "a cargo de / trabajando con" como modificadores de la tarea y no como el sujeto principal de imputación.
- Imponen el cumplimiento estricto del esquema JSON de salida sin invención de campos ni de personas.

## Por qué
Los parches de post-procesamiento en JavaScript son frágiles, difíciles de mantener y no pueden predecir todas las variantes creativas que un LLM pueda generar. Blindar la raíz en `Set - PromptConfig` fuerza al modelo a operar dentro de límites determinísticos claros desde la inferencia, logrando salidas limpias que luego `E4a` solo necesita auditar binariamente (existe / no existe).

## Consecuencia
`Set - PromptConfig` se consolida como el contrato único de instrucciones (`system prompt`) del sistema, versionado bajo `prompt_version`.
