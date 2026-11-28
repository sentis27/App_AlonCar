---
name: chasis-docker-multiapp
description: Estándar de infraestructura autohospedable para aplicaciones React (Vite + Nginx) + Node/Express + PostgreSQL en Docker. Garantiza aislamiento total de puertos, redes y volúmenes para que múltiples aplicaciones convivan en un mismo VPS sin colisiones, con arranque verificado y configuración fail-fast.
---

# Chasis de Infraestructura y Docker Multi-App (SKL-010)

## Problema general que resuelve

> **Las plantillas Docker genéricas usan puertos fijos, volúmenes globales y variables sin validar, provocando que la segunda aplicación desplegada en el mismo servidor colisione o falle en silencio.**

Esta skill define cómo construir y operar el chasis físico de cualquier sistema del ecosistema para que levantar una nueva aplicación en el mismo VPS o entorno local tome minutos, sin pisar puertos, bases de datos ni redes de otras aplicaciones.

---

## 0. Cuándo se activa

- Al inicializar una nueva aplicación o plantilla base.
- Al crear o modificar `docker-compose.yml`, `Dockerfile`, `nginx.conf`, `vite.config.js`, `.env.example` o el arranque de servidor y base de datos.
- Al diagnosticar problemas de despliegue, puertos, proxies o conexión entre contenedores.

---

## 1. Los 7 principios del chasis multi-app

### P1. Identidad única por aplicación (`APP_SLUG`)
Toda aplicación define en su `.env` un identificador corto en minúsculas (`APP_SLUG`, por ejemplo `aloncar-erp`, `logistica-app`).
- `docker-compose.yml` declara `name: ${APP_SLUG}` en la primera línea.
- Todos los contenedores, redes y volúmenes llevan el prefijo `${APP_SLUG}` de forma explícita:
  - Red interna: `${APP_SLUG}_net`
  - Volumen de datos: `${APP_SLUG}_pgdata`
- Ningún recurso puede llamarse genéricamente `postgres-data`, `backend` o `default` a nivel global del host.

### P2. Cero colisión de puertos y aislamiento de red
En un VPS donde conviven múltiples sistemas:
- **PostgreSQL y Backend NUNCA publican sus puertos a internet (`0.0.0.0`).** Se comunican exclusivamente dentro de la red puente privada `${APP_SLUG}_net` usando sus nombres de servicio internos (`postgres:5432`, `backend:5000`).
- Solo el servidor web frontal (Nginx) publica un puerto en el host, atado a loopback (`127.0.0.1:${APP_PORT}:80`) para que el proxy inverso del VPS (Caddy / Nginx / Traefik) le enrute tráfico por dominio, o un puerto específico de desarrollo.
- Si en desarrollo local se necesita acceso directo a la base desde una herramienta externa, el puerto se parametriza y ata a loopback: `127.0.0.1:${DB_EXTERNAL_PORT}:5432`.

### P3. Simetría absoluta entre Desarrollo y Producción (`/api`)
El código del frontend **jamás** concatena URLs absolutas ni puertos para llamar a su propio backend (`prohibido fetch('http://localhost:5000/api/...')`). Siempre consume rutas relativas `/api/...`:
- **En Desarrollo (`vite.config.js`):** el servidor Vite enruta `/api` hacia el backend mediante `server.proxy['/api']`.
- **En Producción (`frontend/Dockerfile` + `nginx.conf`):** un build multi-etapa compila los estáticos con Node Alpine y los sirve con `nginx:alpine`. Nginx entrega la SPA con `try_files $uri $uri/ /index.html` y redirige `/api` mediante `proxy_pass http://backend:5000`.

### P4. Una sola fuente de entorno con validación Fail-Fast (`SKL-009 P6`)
- Prohibido escribir credenciales, secretos o cadenas de conexión literales dentro de `docker-compose.yml` o `Dockerfile`.
- Todo valor configurable vive en `.env` (documentado sin secretos reales en `.env.example`).
- El backend ejecuta al primer instante de arranque un módulo `config/env.js` que valida la presencia y formato de todas las variables obligatorias (`NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`). Si falta una sola, imprime exactamente cuál falta y termina con `process.exit(1)`.

### P5. Arranque determinista con Healthchecks reales
`depends_on` simple no garantiza que la base de datos esté lista para recibir consultas:
- El servicio `postgres` define un `healthcheck` con `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`.
- El servicio `backend` declara `depends_on: postgres: condition: service_healthy`.
- Además, el backend expone `GET /api/health` que ejecuta `SELECT 1` contra el pool de PostgreSQL y devuelve `200 { status: "ok", db: "connected" }` o `503` si la base cayó.

### P6. Imágenes inmutables, livianas y seguras
- Prohibido usar la etiqueta `:latest` en imágenes base (un cambio de versión mayor de Postgres rompe el formato del volumen de datos). Se fijan versiones menores estables (`postgres:16-alpine`, `node:20-alpine`, `nginx:1.27-alpine`).
- En `Dockerfile` se copia primero `package*.json` y se ejecuta `npm ci` antes de copiar el resto del código para aprovechar la caché de capas.
- En producción el proceso Node corre con usuario sin privilegios (`USER node`) y gestiona las señales `SIGTERM` / `SIGINT` cerrando el servidor HTTP y el pool de conexiones (`await pool.end()`) antes de apagarse.

### P7. Persistencia y respaldos predecibles
- Los datos de PostgreSQL residen únicamente en el volumen nombrado `${APP_SLUG}_pgdata`.
- El esquema inicial y sus evoluciones no dependen del estado manual de un contenedor: viven en archivos `.sql` numerados dentro de `db/migrations/` que pueden ejecutarse sobre un contenedor limpio para reconstruir el sistema desde cero en cualquier servidor.

---

## 2. Plantilla de referencia de aislamiento (`docker-compose.yml`)

```yaml
name: ${APP_SLUG}

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - internal_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 5000
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
    networks:
      - internal_net

  frontend:
    build: ./frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "127.0.0.1:${APP_PORT}:80"
    networks:
      - internal_net

networks:
  internal_net:
    name: ${APP_SLUG}_net
    driver: bridge

volumes:
  pgdata:
    name: ${APP_SLUG}_pgdata
```
