---
id: DEC-010
tipo: decision
fase: [2]
estado: borrador
fecha: 2026-07-21
---

# Terminal de Pañol con Verificación Visual y Ocultamiento de Costos por Rol

## Contexto
En el proceso de despacho de materiales del depósito, el pañolero debe cargar manualmente cada retiro en el sistema. Para minimizar errores de imputación (confusión de materiales similares) y agilizar la entrega, se requiere una interfaz dedicada que reemplace a Google Sheets.

## La duda
¿Qué información debe visualizar el pañolero en su pantalla operativa y cómo garantizar la seguridad de la información financiera?

## La decisión
1. **Verificación Visual por Imagen:** Incorporar la columna `imagen_url` / `foto_producto` en el catálogo de materiales (`B.D MATERIALES` / `Material`). La interfaz de la **Terminal de Pañol** desplegará de inmediato la foto del producto al seleccionar o escanear un item para validación visual instantánea antes de registrar la salida.
2. **Restricción Estricta de Costos (RBAC por Rol):** Ocultar completamente precios unitarios, costos totales y datos monetarios en la vista del pañolero. La información de costos queda reservada exclusivamente para roles con permisos específicos (Supervisores, Compras, Administración y Gerencia).
3. **Contenido de la Vista Pañolero:** Exclusivamente operativo (Barco, OT, Contratista, Material, Cantidad, Foto de Referencia, Stock Físico, Locación en Depósito y Alerta de Stock Mínimo).

## Por qué
- Evita entregas incorrectas mediante la confirmación visual de fotos reales del material.
- Protege información confidencial de costos e impositiva de la empresa frente a roles operativos no autorizados.
- Simplifica la interfaz del operario de pañol eliminando datos no relevantes para su función.

## Consecuencia
El frontend implementará control de acceso basado en roles (RBAC). Si el usuario logueado posee rol `panolero`, los componentes y columnas de costos monetarios se omiten del DOM y los endpoints correspondientes no devuelven campos financieros.
