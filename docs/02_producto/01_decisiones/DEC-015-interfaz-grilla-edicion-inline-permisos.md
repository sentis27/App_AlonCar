# DEC-015 — Interfaz de Grilla con Edición Inline Condicional por Permisos

> **Estado:** borrador
> **Fase:** 2
> **Fecha:** 2026-08-09
> **Origen:** Decisión del usuario basada en referencia visual de Zoho CRM

---

## Contexto

El usuario necesita una interfaz de observación y análisis de datos que replique la facilidad de uso de herramientas como Zoho CRM: vista tabular con filtros laterales, paginación, y la posibilidad de editar datos directamente en la fila.

## Decisión

La interfaz principal de consulta de datos del sistema adoptará el siguiente patrón:

### 1. Vista Tabular tipo Grilla (estilo Zoho CRM / Google Sheets)
- Presentación de datos en formato de tabla con columnas configurables
- Paginación (ej. "1 a 100 de 28,031 registros")
- Panel de filtros lateral izquierdo (filtros guardados, filtros por campo, filtros por módulo)
- Etiquetas de estado con colores para identificación rápida

### 2. Edición Inline Condicional por Nivel de Permiso
- **Usuarios con permiso `read`:** Ven la grilla en modo solo lectura. Sin íconos de edición.
- **Usuarios con permiso `write`:** Ven un ícono de edición (✏️) en cada fila. Al hacer clic, se abre un mini-formulario sobre los campos editables de esa fila específica.
- **Usuarios con permiso `admin`:** Pueden editar cualquier campo, incluyendo campos restringidos.

### 3. Auditoría Obligatoria
- Cada modificación inline dispara el `audit_trigger_fn` y se registra en `audit_logs`.
- El usuario NO puede guardar un cambio sin que el sistema registre: quién cambió, qué campo, valor anterior, valor nuevo, cuándo.

### 4. Patrón de Corrección Universal
Aplica a TODA tabla del sistema. El formulario de corrección sigue el flujo:
1. Filtrar: barco → OT → ítem específico
2. Localizar la fila exacta en la grilla
3. Clic en ✏️ → editar ESE dato puntual
4. Guardar → registro en audit_logs automático

## Referencia Visual
Interfaz de Zoho CRM (módulo Leads) con:
- Panel de filtros a la izquierda
- Grilla de datos central con columnas
- Badges de colores para estado
- Paginación inferior

## Impacto
- **Frontend:** Requiere componente de grilla reutilizable con soporte de edición inline
- **Backend:** Las vistas (Capa 2) alimentan la grilla. Las funciones RPC (Capa 3) procesan las ediciones. Los triggers (M6) registran los cambios.
- **Permisos:** El menú dinámico (`get_user_permissions()`) determina si el usuario ve los íconos de edición o solo la vista de lectura.

## Dependencias
- Tabla de Tablas v3 (Especificación Técnica Supabase)
- DEC-013 (Separación de horas tabuladas vs presupuestos)
- Matriz de permisos (`resource_permissions`)
