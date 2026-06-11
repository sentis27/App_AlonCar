---
id: DEC-003
tipo: decision
fase: [1]
estado: borrador
fecha: 2026-06-10
---
# Separación de Índice Humano vs Tabla Máquina

## Contexto
El archivo `INDICE_CENTRAL.md` contenía tablas con metadatos mezcladas con texto narrativo para que los humanos y la IA pudieran navegar el proyecto. A medida que crecían los requerimientos de auditoría, las tablas se volvieron complejas y difíciles de mantener.

## La duda
¿Cómo mantenemos metadatos complejos (tipo, comportamiento, dependencias, orden de lectura) sin destruir la legibilidad del índice para los humanos ni consumir tokens innecesarios en la IA?

## La decisión
Separar el índice en dos archivos con roles estrictos: `INDICE_CENTRAL.md` como brújula narrativa (solo lectura humana y referencia general de la IA), e `INDICE_METADATOS.md` como tabla plana y estricta (consumo máquina para la skill session-audit).

## Por qué
Combinar narrativa y metadatos estructurados en Markdown siempre termina en tablas rotas o ilegibles para editores humanos. Esta separación permite versionar el "schema" de los metadatos sin romper la navegación del proyecto, y permite a la IA ejecutar sin heurísticas frágiles.

## Consecuencia
Toda nueva documentación del proyecto debe registrarse en la tabla de metadatos con vocabulario controlado. El Agente IA ahora cuenta con "certeza matemática" al auditar, basándose en la columna `Comportamiento-IA`.
