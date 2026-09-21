# Diseño de Arquitectura: Ficha Técnica Dinámica del Barco (Módulo M1)

## 1. El Problema de la No-Estandarización
En la industria naval comercial, cada barco es un activo único. Intentar forzar un modelo de base de datos relacional estricto con cientos de columnas (ej: `cant_valvulas_1_2`, `cant_valvulas_3_6`, `capacidad_tanque_combustible_1`) resulta en una interfaz saturada para el Jefe de Obra, tablas gigantes llenas de valores nulos, y la incapacidad de adaptarse cuando aparece un barco con un componente que no estaba previsto.

## 2. La Solución: Híbrido Estructurado + JSONB (EAV)

La tabla `Ship` (Barcos) implementará un modelo híbrido dividiendo la información en dos grandes grupos: **Datos Core** y **Componentes Dinámicos**.

### A. Datos Core (Fijos y Calculables)
Campos estrictos y numéricos que el sistema utiliza matemáticamente para proyectar presupuestos, consumos de pintura, andamiaje, etc.
- `eslora_mts` (Decimal)
- `manga_mts` (Decimal)
- `superficie_casco_m2` (Decimal)

### B. Componentes Dinámicos (JSONB)
Se utilizará una columna `technical_specs` de tipo `JSONB` en PostgreSQL (Supabase) para almacenar las variaciones no estandarizadas. 
En la interfaz de usuario (App_AlonCar), el Jefe de Obra verá una lista de componentes comunes (Tanques de combustible, Válvulas, Pocetes). Si indica que la cantidad es > 0, se habilita un campo de texto amplio para las observaciones de ese componente en particular.

**Estructura del JSONB (Ejemplo práctico):**
```json
{
  "tanques_combustible": {
    "cantidad": 4,
    "observaciones": "2 bodega 10m3\n1 popa boyante 15m3\n1 Tanque diario 2m3"
  },
  "tanques_agua": {
    "cantidad": 2,
    "observaciones": "Proa 5m3 c/u"
  },
  "valvulas_casco_1_a_2_5": {
    "cantidad": 12,
    "observaciones": "6 estribor, 6 babor. Requieren mecanizado de asientos."
  },
  "valvulas_casco_3_a_6": {
    "cantidad": 4,
    "observaciones": "Tomas de mar principales."
  },
  "valvulas_intermediarias_3_a_6": {
    "cantidad": 2,
    "observaciones": ""
  },
  "pocetes_achique": {
    "cantidad": 2,
    "observaciones": "Ubicados en sala de máquinas, muy sucios con aceite pesado."
  }
}
```

## 3. Beneficios del Modelo
1. **UX Simple:** El Jefe de Obra no se enfrenta a un formulario infinito. Solo detalla lo que el barco realmente tiene, y lo hace en sus propias palabras.
2. **Consultas Rápidas:** Supabase permite consultar JSONB de forma eficiente. Podemos buscar rápidamente: "Mostrame todos los barcos con más de 10 válvulas de casco".
3. **Alimentación de IA (Contexto Futuro):** En el Módulo M7, el Comparador de Obras o el Asistente IA pueden leer este JSONB libre y cruzarlo con el historial de OTs: *"Noté que este barco tiene pocetes de achique sucios con aceite pesado, sugiero aumentar un 15% las horas estimadas de limpieza basadas en la OT del mes pasado."*
4. **Escalabilidad Inmediata:** Si mañana el astillero necesita empezar a registrar especificaciones de "Líneas de Eje" o "Hélices", no se requiere migrar la base de datos (ALTER TABLE); simplemente se agrega un nuevo nodo al JSONB.
