# Guía de Estilos y Formato para la Presentación (HTML/Reveal.js)

Este documento centraliza las reglas de formato que deben respetarse al modificar o agregar nuevas filminas en `presentation.html` para garantizar que la visualización y el diseño no se rompan, y que se mantenga el estándar de calidad empresarial.

## 1. Reglas de Dimensionamiento de Imágenes (Mockups)
Debido a la naturaleza responsive de Reveal.js, las imágenes grandes (como los mockups de interfaces) tienden a desbordar (salirse de la pantalla por debajo) si no se restringen correctamente.

Para insertar un nuevo mockup de interfaz, usar SIEMPRE este formato HTML:
```html
<img src="mockups_ui/tu_imagen.jpg" class="mockup-img r-stretch">
```

### ¿Por qué?
- **Clase `.mockup-img`:** Contiene la regla CSS `max-height: 400px !important;` además de `height: auto`, bordes redondeados y sombras (glassmorphism). Esto garantiza que la imagen *nunca* tape u obligue a la filmina a recortarse por abajo.
- **Clase `.r-stretch`:** Es una clase nativa de Reveal.js que le indica al motor de la presentación que la imagen debe expandirse solo hasta ocupar el espacio *restante* después de renderizar el título (`<h2>`), evitando desbordes en monitores chicos o proyectores.

## 2. Reglas de Idioma (Cero Spanglish)
Tal como está documentado en las reglas de negocio globales:
- Todo el texto dentro de la presentación, **incluidos los mockups de interfaces generados por IA**, debe estar estrictamente en español.
- Si se genera un mockup nuevo que contiene texto en inglés (ej. "Dashboard", "Submit"), debe rechazarse y regenerarse en español (ej. "Panel de Control", "Enviar").

## 3. Uso de Grillas (Grid / Flexbox)
Cuando se necesite dividir una filmina en columnas (por ejemplo, para mostrar iconos y descripciones cortas):
- Utilizar `<div class="glass-card">` para envolver los contenidos y dar la estética moderna del astillero (fondos oscuros translúcidos, bordes tenues).
- Para tablas de comparación, evitar agregar demasiadas columnas, Reveal.js escalará las fuentes hacia abajo volviéndolas ilegibles.

## 4. Estructura de Secciones (Tramos)
La presentación se divide en:
- **TRAMO 1:** Visión General y Problema Actual (Diapositivas cortas, poco texto, impacto gerencial).
- **TRAMO 2:** Profundidad Técnica por Módulo (M1 a M7). Cada módulo debe tener:
  1. Una filmina de diagnóstico / texto (El Problema vs La Solución).
  2. Una filmina visual (UI Mockup) utilizando `.r-stretch` para ilustrar la solución.
