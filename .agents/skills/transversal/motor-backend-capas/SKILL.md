---
name: motor-backend-capas
description: Arquitectura estándar para el motor lógico Backend en Node.js/Express + PostgreSQL (SQL/ORM). Impone separación estricta en 4 capas (Routes, Controllers, Services, Repositories/Models), contratos REST consistentes, serialización segura y manejo centralizado de errores.
---

# Motor Lógico Backend en Capas y Contratos REST (SKL-011)

## Problema general que resuelve

> **Cuando las rutas HTTP contienen consultas SQL y reglas de negocio mezcladas, cada endpoint devuelve errores con formato distinto, filtra columnas internas de la base de datos y se vuelve imposible reutilizar o probar la lógica.**

Esta skill toma los mejores patrones del estándar RealWorld (contratos REST predecibles, serializadores de salida, precarga de recursos y captura de errores de validación) y corrige su acoplamiento aplicando estrictamente los principios **P1 (Separación de responsabilidades)** y **P6 (Diseño defensivo)** de `SKL-009`.

---

## 0. Cuándo se activa

- Al diseñar, crear o modificar endpoints, servicios, modelos o consultas SQL en el backend.
- Al definir contratos de comunicación entre el frontend (`httpClient`) y el backend.
- Al auditar la seguridad, consistencia o manejo de errores de una API.

---

## 1. Los 8 principios del motor lógico

### P1. Arquitectura estricta de 4 capas unidireccionales (`SKL-009 P1`)
Toda funcionalidad se organiza por módulo de dominio (`src/modules/<recurso>/`) con dirección de dependencia estricta `Route → Controller → Service → Repository/Model`:

| Capa | Archivo | Qué tiene permitido hacer | Qué tiene PROHIBIDO hacer |
| :--- | :--- | :--- | :--- |
| **1. Ruta** | `<recurso>.routes.js` | Declarar verbo y URL, encadenar middlewares (`auth`, `validate`) y delegar al controlador con `asyncHandler`. | Contener lógica condicional, leer el body o tocar servicios/modelos. |
| **2. Controlador** | `<recurso>.controller.js` | Extraer `req.params`, `req.query`, `req.body` y `req.user`; llamar al servicio; devolver `res.status(X).json(...)`. | Escribir consultas SQL/ORM, abrir transacciones o evaluar reglas de negocio. |
| **3. Servicio** | `<recurso>.service.js` | Ejecutar reglas de negocio, verificar permisos de dominio, abrir transacciones (`withTransaction`) y lanzar `AppError`. | Recibir o conocer los objetos HTTP `req`, `res` o `next`. |
| **4. Repositorio / Modelo** | `<recurso>.repository.js` / `models/` | Ejecutar consultas SQL parametrizadas o llamadas al ORM, paginar (`findAndCountAll`) y transformar filas con `toDTO()`. | Tomar decisiones de flujo de negocio o devolver códigos HTTP. |

### P2. Aislamiento de consultas SQL y prohibición de `sync()` automático
- Ninguna cadena SQL ni operador del ORM (`Op.like`, `Sequelize.literal`, `pool.query`) puede aparecer fuera de `repositories/` o `models/`.
- Todas las consultas usan parámetros vinculados (`$1, $2` o bindings del ORM); prohibido interpolar variables con template strings en SQL.
- **Prohibido `sequelize.sync()` o alteración automática de tablas al levantar el servidor.** El esquema se modifica únicamente mediante archivos de migración numerados en `db/migrations/*.sql`.
- Toda consulta de listado aplica por defecto `limit` (con tope máximo, ej. `100`) y `offset` para cumplir con `SKL-007 P10` (escalabilidad a 10x datos).

### P3. Serialización obligatoria de salida (`toDTO`)
Nunca se devuelve al cliente la instancia cruda de la base de datos (`res.json(row)` está prohibido):
- Cada modelo o repositorio define un transformador explícito (`toDTO(entity, contextUser)`) que selecciona y formatea únicamente los campos públicos del contrato.
- Esto impide que nuevas columnas internas, hashes de contraseñas, tokens o metadatos de auditoría se filtren accidentalmente en la respuesta JSON.

### P4. Contrato único de respuestas HTTP
Todas las respuestas de la API respetan la misma estructura predecible para que el cliente frontend (`httpClient.js`) las procese con una sola lógica:
- **Recurso individual (`200 OK`, `201 Created`):**
  ```json
  { "data": { "id": "...", "..." : "..." } }
  ```
- **Colección paginada (`200 OK`):**
  ```json
  {
    "data": [ ... ],
    "meta": { "total": 396, "limit": 50, "offset": 0 }
  }
  ```
- **Eliminación o acción sin contenido (`204 No Content`):** cuerpo vacío.
- **Error en cualquier capa (`400`, `401`, `403`, `404`, `409`, `422`, `500`):**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Descripción clara para el usuario",
      "details": [{ "field": "trade", "issue": "El rubro es obligatorio" }],
      "traceId": "req-9f8a7b"
    }
  }
  ```

### P5. Barrera de validación en la puerta de entrada
Los datos sucios se rechazan **antes** de llegar al controlador o al servicio:
- Un middleware `validate(schema)` valida y normaliza `req.body`, `req.query` y `req.params` (recorte de espacios, conversión de tipos, formato en mayúsculas cuando aplique).
- Si falla, corta inmediatamente con `422 Unprocessable Entity` detallando campo por campo qué regla no se cumplió.

### P6. Manejo centralizado y defensivo de errores (`SKL-009 P6`)
- **Cero `try/catch` repetitivos en controladores:** todas las funciones asíncronas de ruta se envuelven en `asyncHandler(fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next))`.
- **Errores de negocio tipados:** los servicios lanzan `throw new AppError('RESOURCE_NOT_FOUND', 404, 'La orden de trabajo no existe')` o `new AppError('DUPLICATE_TRADE', 409, 'El rubro ya está registrado')`.
- **Traductor único (`errorHandler.js`):** un único middleware final en `app.js` intercepta cualquier error y lo convierte al contrato JSON del Principio 4:
  - `AppError` → usa su `status` y `code`.
  - Error de validación del ORM/Esquema → `422 VALIDATION_ERROR`.
  - Violación de clave única de PostgreSQL (`23505`) → `409 CONFLICT`.
  - Violación de clave foránea de PostgreSQL (`23503`) → `409 REFERENTIAL_INTEGRITY_ERROR` (explicando que el registro tiene datos asociados).
  - Token inválido o vencido → `401 UNAUTHORIZED`.
  - Cualquier otro error inesperado → registra el stack completo con su `traceId` en el log del servidor y responde `500 INTERNAL_ERROR` genérico en producción (nunca expone SQL ni rutas de archivos al cliente).

### P7. Autenticación declarativa en dos modos (`auth.required` / `auth.optional`)
Siguiendo el patrón probado del Repo 2:
- `auth.required`: exige token válido en `Authorization: Bearer <token>`, inyecta `req.user` y corta con `401` si falta o expiró.
- `auth.optional`: si viene token válido inyecta `req.user` (para personalizar vistas o permisos); si no viene, continúa con `req.user = null`.

### P8. Separación entre `app.js` y `server.js` (Testeabilidad pura)
- `app.js` construye la instancia de Express, registra middlewares, rutas y manejador de errores, y la exporta **sin llamar a `app.listen()`**. Esto permite ejecutar pruebas automáticas de integración sobre los endpoints en milisegundos sin abrir puertos de red.
- `server.js` importa `app`, verifica la conexión a PostgreSQL, abre el puerto y registra el apagado limpio (`SIGTERM`).
