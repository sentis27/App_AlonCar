# Módulo 4c: Gestor Documental de Compras

## El Problema
En el flujo legacy, vincular una cotización en formato PDF o Word implica 5 pasos manuales y propensos a error humano:
1. Recibir/crear el documento PDF o DOC.
2. Navegar por el árbol de carpetas de Google Drive (`cotizaciones/2026/electricidad/`).
3. Renombrar el archivo manualmente siguiendo convenciones frágiles.
4. Subir el archivo y generar un link para compartir.
5. Pegar el link en la celda correspondiente de la planilla de compras.

Esto genera enlaces rotos, archivos perdidos, inconsistencia de nombres y pérdida de trazabilidad si alguien comete un error en el tipeo del rubro o año.

## La Solución: Adjunto Inteligente

Se introduce un **Gestor Documental** integrado directamente a la grilla del Módulo M4b (Compras).

### Flujo de Usuario (1 paso)
En cada fila de pedido de compra existe el botón **"📎 Adjuntar Cotización"**. Al hacer clic:
1. El usuario selecciona el archivo (PDF, DOC, DOCX, JPG, PNG).
2. Escribe una descripción breve (ej. "Cables varios").
3. El sistema asume por defecto el Rubro (heredado del M4 Materiales) y el Proveedor (asignado en M4b).
4. Guarda y listo.

### Automatización Interna (Backend)
1. **Nomenclatura:** El sistema genera un nombre de archivo normalizado usando el formato: `{descripcion}-{proveedor}.{extension}`.
2. **Organización en Bucket (Supabase Storage):** El archivo se sube automáticamente a la ruta estructurada: `cotizaciones/{YYYY}/{rubro}/{archivo_normalizado}`.
3. **Persistencia Relacional:** Se crea un registro en la tabla `purchase_documents` que vincula el archivo físico con la lógica de negocio (FK a `purchase_order_id`, `supplier_id`).

## Base de Datos (`purchase_documents`)

```sql
CREATE TABLE purchase_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    supplier_id UUID REFERENCES suppliers(id),
    category TEXT NOT NULL, -- Ej: 'Electricidad', hereda de M4
    description TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    normalized_filename TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Ruta en Storage
    file_size_bytes INTEGER,
    year INTEGER NOT NULL, -- Calculado auto
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- Soft delete
);
```

## Beneficios Secundarios: Archivo Histórico y Buscador
Dado que los documentos ahora están indexados relacionalmente y no "sueltos" en Drive, se habilita una nueva vista: **Archivo de Cotizaciones**.
- **Motor de Búsqueda:** Permite buscar cotizaciones antiguas filtrando por año, rubro, proveedor o texto libre en la descripción.
- Esto alimenta de información valiosa al Comparador de Precios, ya que permite recuperar rápidamente los comprobantes de precios históricos cargados en el sistema sin depender de la memoria humana.
