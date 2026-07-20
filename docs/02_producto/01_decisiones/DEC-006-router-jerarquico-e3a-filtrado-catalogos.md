---
id: DEC-006
tipo: decision
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Lógica determinística en 4 reglas para E3a (Router v2.3) y filtrado quirúrgico de catálogos

## Contexto
El sistema procesa reportes provenientes de operarios generales del astillero, especialistas en maquinaria y contratistas externos. Cuando se adjuntaban todos los catálogos combinados al prompt de OpenAI (`personal_astillero` + `grupos_contratistas` + `maquinistas`), el modelo sufría confusión cruzada y alucinaba asignando tareas o personal a rubros incorrectos.

## La duda
¿Cómo clasificar de forma confiable el canal del mensaje (`astillero_general`, `maquinista` o `contratista`) antes de llamar al LLM y cómo estructurar los catálogos que se le envían?

## La decisión
Establecer un clasificador jerárquico determinístico en `E3a - PrepararPrompt` basado en 4 reglas ordenadas por prioridad absoluta:
1. **Rubro explícito (`astillero_general`)**: Si el mensaje contiene palabras clave explícitas de rubro (`raschines`, `mecánicos`, `caldereros`, `carpinteros`, `albañiles`, `pintores`, `electricistas`), se clasifica incondicionalmente como `astillero_general` (señal más fuerte).
2. **Inicio con Máquina (`maquinista`)**: Si no hay rubro explícito pero hay líneas que inician con tipos de maquinaria (`pala`, `grúa`, `retroexcavadora`), se clasifica como `maquinista`.
3. **Contratista en Sujeto (`contratista`)**: Si no aplican las anteriores y el mensaje inicia con un nombre de grupo contratista (`grupos_contratistas`) o con la palabra `contratista(s)`, se clasifica como `contratista`.
4. **Default (`astillero_general`)**: Cualquier otro caso recae en `astillero_general`.

Una vez detectado el canal (`canal_detectado`), `E3a` inyecta un catálogo quirúrgicamente filtrado en la configuración: si es `astillero_general`, se excluyen roles de maquinaria y estadísticas; si es `maquinista`, solo se envía el personal de maquinaria.

## Por qué
Aísla el contexto del LLM al subconjunto estrictamente necesario de operarios, reduciendo el consumo de tokens, eliminando alucinaciones cruzadas entre canales y garantizando que el `tipo_reporte` devuelto por el modelo concuerde perfectamente con la realidad operativa.

## Consecuencia
El prompt (`E3a`) transmite a `Set - PromptConfig` solo los catálogos pertinentes y pasa el `canal_detectado` como variable global hacia `E4a - ValidarOperario`.
