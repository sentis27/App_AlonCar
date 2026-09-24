# 🗺️ Plan de Desarrollo Escalonado: Alon Car

Este plan detalla la hoja de ruta para transformar los diseños y reglas de negocio en la aplicación real, garantizando máxima autonomía de la IA.

## FASE 1: Infraestructura y "Cerebro" (Setup Base)
*El objetivo aquí es preparar el terreno para que yo (Antigravity) pueda programar rápido y sin trabas.*

*   **Paso 1: Setup del Servidor (Easypanel):**
    *   Crear un nuevo proyecto llamado `aloncar` en Easypanel.
    *   Definir si usamos **Supabase Cloud** (recomendado para delegar la gestión de contraseñas/archivos) y alojamos solo el Frontend en Easypanel, o si instalamos Supabase completo en Easypanel.
*   **Paso 2: Conexión MCP (Mi autonomía):**
    *   Configurar el **MCP de PostgreSQL** en tu entorno local. Esto me dará acceso directo para que yo pueda crear tablas y verificar datos sin pedirte que corras comandos por mí.
*   **Paso 3: Creación de Skills Iniciales:**
    *   Crear `Skill: Arquitectura_UI` (para forzar colores de branding y componentes estándar).
    *   Crear `Skill: Git_Workflow` (opcional, para estandarizar commits).
*   **Paso 4: Inicialización del Repositorio Real:**
    *   Montar la base del proyecto (Vite + React o Vanilla JS modular) e instalar dependencias.

---

## FASE 2: Base de Datos y Seguridad (Backend)
*Antes de pintar botones, necesitamos la estructura que guardará la información.*

*   **Paso 1: Tablas Core (M1, M2 y M3):**
    *   Crear tablas: `users` (roles), `ships` (Barcos), `work_orders` (OTs), `labor_logs` (Horas).
*   **Paso 2: Tablas Logística (M4 y M4c):**
    *   Crear tablas: `materials`, `inventory_transactions`, `purchase_orders` y `purchase_documents` (Gestor Documental).
*   **Paso 3: Políticas de Seguridad (RLS):**
    *   Programar las reglas estrictas de base de datos (Ej: "El Pañolero solo puede ver stock, no precios").
*   **Paso 4: Storage:**
    *   Crear el *bucket* (carpeta en la nube) para guardar los PDFs de las cotizaciones.

---

## FASE 3: Desarrollo del Frontend (Módulo a Módulo)
*Acá es donde conectamos las pantallas visuales (mockups) con la base de datos viva.*

*   **Sprint 1: Autenticación y Cascarón:**
    *   Pantalla de Login.
    *   Sistema de ruteo (Sidebar dinámico según el Rol del usuario).
*   **Sprint 2: Pañol y Compras (M4):**
    *   Pantalla de Retiro de Materiales (con carga múltiple).
    *   Pantalla del Pañolero para Pedidos.
    *   Bandeja de Compras (Gestor Documental 1-Clic).
*   **Sprint 3: Operaciones (M3):**
    *   Carga múltiple de Horas (UI).
    *   Automatización del tipo de cambio quincenal.
*   **Sprint 4: Activos y Personal (M1 y M2):**
    *   Ficha técnica dinámica del barco.
    *   Carga de operarios, terceros y tarifarios.
*   **Sprint 5: Gerencia y Analítica (M5 y M6):**
    *   Dashboard Centralizado.
    *   Comparador de Obras Canvas (Drag & Drop).
    *   Resumen Gerencial.

---

## FASE 4: Despliegue y Puesta en Marcha (CI/CD)
*Llevamos el código al servidor para que el astillero pueda usarlo.*

*   **Paso 1: Conexión GitHub ➔ Easypanel:**
    *   Vinculamos tu cuenta de GitHub con Easypanel. De esta forma, cada vez que yo termino de programar algo y hago *Push*, Easypanel actualiza la App en vivo automáticamente.
*   **Paso 2: Testing Real:**
    *   Carga de datos de prueba reales (1 barco, 1 OT, 5 materiales).
*   **Paso 3: Capacitación y Ajustes:**
    *   Se entrega al usuario final y corregimos fricciones sobre la marcha.
