# 🏛️ Sistema Central de Auditorías Arquitectónicas y Trazabilidad — AlonCar ERP

Este directorio constituye el repositorio oficial e inmutable del historial de salud estructural, modularidad y auditorías de código del proyecto AlonCar ERP, gobernado por la habilidad **`SKL-017` (`architectural-modularity-auditor`)**.

---

## Estructura del Repositorio de Auditorías

```
docs/02_producto/05_auditorias/
│
├── README.md                      # Este índice: objetivos, protocolo y convenciones.
├── LINEA_BASE_ARQUITECTURA.md     # 🗺️ MODO 1: Diagnóstico maestro (Cuadrantes A, B, C, D).
├── BITACORA_DELTAS_SESION.md      # ⏱️ MODO 2: Libro mayor (Ledger) acumulativo de cierres de sesión.
└── planes/                        # 🛠️ Planes de refactorización quirúrgica gobernados por SKL-008.
```

---

## Convenciones de Uso

### 1. Diagnóstico Maestro (`LINEA_BASE_ARQUITECTURA.md`)
- Se genera y actualiza a través de la **Auditoría Cero por Cuadrantes** (Modo 1 de `SKL-017`).
- Clasifica la deuda técnica en 4 niveles de severidad: `CRÍTICA`, `ALTA`, `MEDIA`, `MEJORA`.
- Al resolverse una deuda mediante refactorización quirúrgica (`SKL-008`), se marca su estado como `RESUELTO` enlazando al commit o plan correspondiente.

### 2. Libro Mayor de Cierres (`BITACORA_DELTAS_SESION.md`)
- Funciona como un **Ledger acumulativo cronológico** (las entradas más recientes se insertan arriba).
- Cada fin de jornada de trabajo donde se modifique o cree código, el agente ejecuta el Modo 2 de `SKL-017` y anexa su bloque de verificación.
- **Regla:** Ningún commit debe enviarse a remoto si la entrada correspondiente en la bitácora arroja `🔴 DETENERSE POR RIESGO`.

### 3. Planes Quirúrgicos (`planes/`)
- Todo refactor que requiera más de 1 paso o que modifique módulos centrales se planifica con formato `PLAN-XXX-[descripcion].md`.
- No se toca el código sin la aprobación del usuario sobre la tabla de etapas de `SKL-008`.
