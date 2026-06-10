🗺️ Roadmap de Negocio - App_AlonCar

Este documento contiene la VISIÓN a largo plazo del proyecto.
Está aquí para referencia y contexto. La implementación real está en FASE 2+ (después de completar Fase 1).


📍 Ubicación en el Proyecto
FASE 1 (ACTUAL)        FASE 2 (PRÓXIMA)       FASE 3 (FINAL)
Infraestructura        Diseño de Negocio      Implementación
├─ Conexiones          ├─ 6 Módulos            ├─ APIs
├─ MCP                 ├─ Reglas de negocio    ├─ Frontend
├─ n8n                 └─ Esquema de datos     └─ Deployment
└─ Seguridad
                       ← TÚ ERES AQUÍ

ROADMAP_NEGOCIO.md = Mapa de qué viene después

🎯 Visión del Proyecto
App_AlonCar es un ERP Naval e Industrial diseñado para:

Gestionar barcos como activos centrales
Controlar costos operacionales en tiempo real
Automatizar facturación y auditoría
Integrar mano de obra, materiales y servicios terceros

Caso de uso: Astillero / Taller naval que repara/mantiene múltiples barcos de distintos propietarios.

🏗️ Los 6 Módulos del Negocio
1️⃣ Módulo de Activos y Clientes (CORE)
¿Qué es?
El corazón del sistema. Define qué es un barco, quién lo posee y cómo se organiza el trabajo.
Entidades Principales:
BARCO (Ship)
├─ Identificación: IMO, Nombre, Tipo
├─ Historial técnico
└─ Visitas / Proyectos (múltiples trabajos a lo largo del tiempo)

RAZÓN SOCIAL / PROPIETARIO (Owner)
├─ Datos legales y fiscales
└─ Múltiples barcos (relación 1:N)

CONTACTO (Contact)
├─ Persona de referencia
└─ Vinculado a Razón Social
Reglas Core:

✅ Cada OT se aplica a UN BARCO específico
✅ La facturación y deuda se asocian a la RAZÓN SOCIAL (no al barco)
✅ El historial del barco es indivisible (auditoría completa)

Diagrama:
Razón Social (Propietario)
    ├─ Barco 1
    │   └─ Visita 1 (2024-01-15 a 2024-02-10)
    │       ├─ OT-001 (Reparación de motor)
    │       └─ OT-002 (Pintura)
    │   └─ Visita 2 (2024-06-01 a 2024-06-15)
    │       └─ OT-003 (Mantenimiento general)
    │
    └─ Barco 2
        └─ Visita 1 (2024-03-20 a 2024-04-05)
            └─ OT-004 (Inspección)

2️⃣ Módulo de Recursos (Mano de Obra)
¿Qué es?
Quién trabaja, cuánto cobra y dónde.
Entidades Principales:
OPERARIO INTERNO (Internal Worker)
├─ Datos personales, DNI
├─ Categoría laboral (oficial, ayudante, especialista)
└─ Tarifa horaria base

OPERARIO EXTERNO (Contractor)
├─ Datos personales
├─ Categoría laboral
├─ Tarifa horaria
└─ ⚠️ OBLIGATORIAMENTE vinculado a TALLER EXTERNO

TALLER EXTERNO (External Workshop)
├─ Razón social / Empresa
├─ Homologación (sí/no)
├─ Lista de operarios que pueden asignar
└─ Contacto

PROVEEDOR (Supplier)
├─ Razón social
├─ CUIT
├─ Servicios que ofrece
└─ Tarifa de servicios

TARIFA / RATE CARD (RateCard)
├─ Categoría de trabajo
├─ Precio unitario (hora / tarea)
├─ Vigencia desde-hasta
└─ Divisiones (interno, externo, tercero)
Reglas Core:

✅ Operarios externos SIEMPRE dependen de un taller externo
✅ Cambio de tarifa = nueva RateCard (mantener historial)
✅ Validación: ¿el operario está autorizado para este taller?


3️⃣ Módulo de Operaciones y Control de Costos (EL MOTOR)
¿Qué es?
Dónde se ejecuta el trabajo y cómo se documenta.
Entidades Principales:
ORDEN DE TRABAJO (WorkOrder / OT)
├─ Identificación: OT-001, OT-002, etc.
├─ Barco asignado
├─ Descripción del trabajo
├─ Estado: Creada → En Progreso → Pausada → Completada → Facturada
├─ Fechas: inicio, fin, plazo
└─ Costo presupuestado vs. real

REGISTRO DE ASISTENCIA (Attendance / Reloj)
├─ Operario
├─ Fecha y hora de entrada/salida
├─ OT asociada
└─ Validación automática (¿horarios lógicos?)

IMPUTACIÓN DE HORAS (TimeImput / Asignación)
├─ Operario
├─ OT
├─ Horas trabajadas
├─ Categoría de trabajo
├─ Tarifa aplicada
└─ Costo generado

CENTRO DE COSTO (CostCenter)
├─ Código del área (Mecanizado, Carpintería, etc.)
└─ Acumulador de costos
El "Triángulo del Costo":
┌────────────────────────────┐
│   MANO DE OBRA             │ ← Imputación de horas × Tarifa
│  (Operarios)               │
│                            │
│  +  MATERIALES             │ ← Consumos de Logística
│                            │
│  +  SERVICIOS TERCEROS     │ ← Facturas de proveedores
└────────────────────────────┘
         ↓
    COSTO TOTAL OT
Reglas Core:

✅ n8n concilia automáticamente Reloj vs. Imputación

Si un operario entra a las 8:00 y sale a las 17:00, n8n lo detecta
Si solo imputó 4 horas, genera ALERTA (auditoría)
Esto evita fraude y errores humanos


✅ Soporta carga en bloque por cuadrillas

Ejemplo: "Equipo A trabajó 8 horas en OT-001"
Se expande a cada integrante automáticamente


✅ Edición limitada: después de 72 horas, solo lectura


4️⃣ Módulo de Logística y Suministros (STOCK)
¿Qué es?
Qué materiales se usan, de dónde vienen y cuánto queda.
Entidades Principales:
MATERIAL / CATÁLOGO (Material)
├─ Código único
├─ Descripción
├─ Unidad de medida (metro, kilo, unidad)
├─ Precio unitario
└─ Categorización (eléctrica, mecánica, etc.)

INVENTARIO (Inventory)
├─ Material
├─ Stock físico (en el pañol)
├─ Stock virtual (reservado pero no entregado)
├─ Stock comprometido (OC abierta)
└─ Alertas de mínimos

ORDEN DE COMPRA (PurchaseOrder / OC)
├─ Proveedor
├─ Ítems (material + cantidad)
├─ Fecha de entrega esperada
├─ Estado: Solicitada → Confirmada → Entregada → Facturada
└─ Costo total

CONSUMO (Consumption)
├─ OT asociada
├─ Material
├─ Cantidad salida de pañol
├─ Fecha
├─ Operario responsable
└─ ✅ Automático: resta stock
Reglas Core:

✅ Cada salida de pañol resta stock automáticamente

Consumo: Material A, -10 unidades
Inventario: antes 50, después 40
Sin auditoría manual


✅ Compras directas a obra

Si traes material que NO pasa por pañol
Impacta DIRECTO en costo vivo de la OT
No afecta el stock del pañol


✅ Alertas de stock mínimo

Material A tiene mínimo 20 unidades
Stock cae a 15 → Alerta automática




5️⃣ Módulo Comercial (PRESUPUESTOS Y FACTURACIÓN)
¿Qué es?
Cómo prometés el precio y cómo cobras.
Entidades Principales:
PRESUPUESTO / COTIZACIÓN (Quote)
├─ Razón Social cliente
├─ Ítems (descripción, cantidad, precio)
├─ Clasificación: "Mano de Obra" (exento IVA) o "Material" (gravado)
├─ Total sin IVA
├─ IVA calculado automáticamente
├─ Total con IVA
└─ Estado: Borrador → Enviado → Aceptado → Rechazado

ANEXO DE FACTURA / LIQUIDACIÓN (InvoiceAttachment)
├─ Clonación inteligente del Presupuesto aceptado
├─ Ajustes por cambios reales (ítems adicionales, descuentos)
├─ Mismo sistema de clasificación MO/Materiales
└─ Genera PDF para enviar

ITEM FACTURA (BillingItem)
├─ Descripción
├─ Cantidad
├─ Precio unitario
├─ Subtotal
├─ ¿Es MO o Material?
│   ├─ SI MO → IVA = 0%
│   └─ SI Material → IVA = 21% (Argentina)
└─ Total con IVA
Regla Core: Switch Inteligente
Ítem: "Reparación de motor"
  ├─ Si tipo = "Mano de Obra"
  │   └─ IVA = 0%, Total = Cantidad × Precio
  │
  └─ Si tipo = "Material"
      └─ IVA = 21%, Total = (Cantidad × Precio) × 1.21
Flujo:
1. Usuario crea PRESUPUESTO
   └─ "Reparación de motor: 1000 ARS"
   └─ "Materiales consumidos: 500 ARS"

2. Trabajo se ejecuta en OT
   ├─ Costo real mano de obra: 1200 ARS
   └─ Costo real materiales: 450 ARS

3. Usuario crea ANEXO (liquidación final)
   ├─ Mano de Obra: 1200 (sin IVA)
   ├─ Materiales: 450 (con 21% IVA = 544.50)
   └─ Total: 1744.50 ARS

4. PDF se genera automáticamente
   └─ Listo para imprimir y firmar

6️⃣ Módulo de Cierre, Auditoría y Archivo Histórico
¿Qué es?
Cómo cierras el trabajo y lo guardas para auditoría.
Entidades Principales:
CIERRE (Closure)
├─ Conjunto de OTs a cerrar (por barco, por período, etc.)
├─ Validación: todas las OTs tienen datos completos
├─ Estado: Abierto → En Revisión → Cerrado → Facturado
└─ Bloqueo automático después de "Facturado"

REGISTRO DE AUDITORÍA (AuditTrail)
├─ Quién hizo qué
├─ Cuándo lo hizo
├─ Qué cambió (antes/después)
├─ IP y dispositivo
└─ Firma digital (si requiere)

DATOS HISTÓRICOS (HistoricalData)
├─ Snapshot de OT después de cierre
├─ Incluye: Costos finales, cambios, imputaciones
├─ Separado por año/período
└─ Solo lectura
Jerarquía de Cierre:
[BARCO]
  └─ [VISITA / PROYECTO] (período de tiempo)
      └─ [ORDEN DE TRABAJO] (tarea específica)
          └─ [ÍTEMS FACTURADOS]

Ejemplo:
"Barco Libertad"
  └─ "Visita 2024-01 (15 Ene - 10 Feb)"
      ├─ OT-001: Reparación motor (Costo real: 5,000 ARS)
      ├─ OT-002: Pintura casco (Costo real: 3,500 ARS)
      └─ OT-003: Revisión eléctrica (Costo real: 1,200 ARS)
           = SUBTOTAL VISITA: 9,700 ARS
           = FACTURADO: 9,700 ARS + IVA
Reglas Core:

✅ Data Locking automático por n8n

Cuando OT pasa a "Facturada"
Sistema bloquea cualquier intento de carga posterior
Error: "OT Bloqueada - No se puede editar"


✅ Separación Costo Vivo vs. Histórico

Dashboard "Costo Vivo": Obra en progreso del barco actual
Dashboard "Costo Histórico": Auditoría anual por barco
Útil para barcos recurrentes (reparaciones anuales)


✅ Auditoría completa

Quién creó cada OT
Quién cambió el estado
Quién imputó horas
Quién facturó




🔄 Flujos Principales (Casos de Uso)
Flujo 1: Crear y Ejecutar una Orden de Trabajo
1. Gerente crea OT-001 (Reparación motor)
   └─ Barco: Libertad
   └─ Descripción: "Revisar y reparar motor principal"
   └─ Presupuesto inicial: 5,000 ARS

2. Operarios se presentan
   ├─ Juan (Oficial) → Reloj marca entrada
   ├─ Carlos (Ayudante) → Reloj marca entrada

3. Trabajo en progreso
   ├─ 8:00 - Entrada
   ├─ 12:00 - Salida a almuerzo
   ├─ 13:00 - Entrada
   ├─ 17:00 - Salida
   └─ Total en reloj: 8 horas

4. Gerente imputa horas (dentro de 24 horas)
   ├─ Juan: 8 horas × Tarifa oficial = 800 ARS
   ├─ Carlos: 8 horas × Tarifa ayudante = 400 ARS
   └─ Subtotal MO: 1,200 ARS

5. Materiales se consumen
   ├─ Material A: 10 unidades → Stock baja de 50 a 40
   ├─ Material B: 5 unidades → Stock baja de 20 a 15
   └─ Subtotal Materiales: 500 ARS

6. OT se completa
   └─ Total costo real: 1,700 ARS (vs. presupuesto 5,000 ARS)

7. Facturación
   ├─ Anexo: "MO: 1,200 | Materiales: 500 × 1.21 = 605"
   ├─ Total: 1,805 ARS
   └─ PDF generado

8. Cierre
   ├─ OT-001 → Estado "Facturada"
   ├─ n8n BLOQUEA ediciones posteriores
   └─ Datos guardados en "Histórico 2024"
Flujo 2: Auditoría (Conciliación Reloj ↔ Imputación)
1. n8n ejecuta cada medianoche:
   "¿Hay discrepancias entre Reloj e Imputación?"

2. Datos del día anterior:
   ├─ Reloj dice: Juan 8 horas, Carlos 8 horas
   └─ Imputación dice: Juan 6 horas, Carlos 4 horas
        └─ DISCREPANCIA DETECTADA

3. n8n genera ALERTA
   ├─ A: Gerente
   ├─ Asunto: "Discrepancia OT-001: Juan 2 horas sin imputar"
   └─ Acción: Revisar y corregir

4. Investigación
   ├─ Posibilidad 1: Error de entrada (corregir imputación)
   ├─ Posibilidad 2: Fraude (horas de reloj falsas)
   └─ Posibilidad 3: Pausa de trabajo (legítima)

5. Resolución
   ├─ Gerente corrige imputación (si fue error)
   ├─ O archiva alerta (si fue pausa legítima)
   └─ Sistema registra todo en AuditTrail

📊 Datos e Informes Clave
Dashboard: Costo Vivo (Obra en Progreso)
Barco: Libertad
Visita: 2024-06 (1 Junio - Hoy)

OT-001: Reparación motor
├─ Estado: En Progreso
├─ Presupuesto: 5,000 ARS
├─ Costo acumulado: 1,700 ARS
├─ Proyección: 1,900 ARS (si continúa así)
└─ Variación: -74% (por debajo del presupuesto)

OT-002: Pintado
├─ Estado: Completada
├─ Presupuesto: 3,000 ARS
├─ Costo real: 3,200 ARS
└─ Variación: +7% (sobre presupuesto)

RESUMEN VISITA:
├─ Total Presupuestado: 8,000 ARS
├─ Total Ejecutado: 4,900 ARS
├─ Total Proyectado: 5,100 ARS
└─ % Progreso: 61%
Informe: Costo Histórico (Auditoría Anual)
Barco: Libertad
Período: 2024

Visita 1 (Ene-Feb):
├─ OTs: 3 (todas facturadas)
└─ Costo total: 9,700 ARS

Visita 2 (Jun-Hoy):
├─ OTs: 2 (1 en progreso)
└─ Costo acumulado: 4,900 ARS

TOTAL 2024:
├─ Costo: 14,600 ARS
├─ Ciclos de reparación: 2
└─ Costo promedio por visita: 7,300 ARS

🔗 Integraciones Requeridas
SistemaIntegraciónFrecuenciaGoogle SheetsEntrada manual (hogar temporal)Diarian8nOrquestación de flujosReal-timeMCPLógica de negocioReal-timeSupabasePersistencia de datosReal-timeReloj BiométricoMarca de asistenciaEn tiempo realPDF GeneratorFacturas y reportesOn-demand

🚀 Transición Fase 1 → Fase 2
Cuando termines Fase 1 (infraestructura):

Tendrás: n8n, MCP, Google Sheets, Supabase, todo conectado
Falta: La lógica de negocio (los 6 módulos)
Siguiente: Diseñar el esquema de datos + flujos

Checklist para iniciar Fase 2:

 MCP server corre sin errores
 n8n conecta con Supabase
 Google Sheets → n8n → validación funciona
 Antigravity puede consultar el MCP
 Tests de conectividad pasan


📚 Documentación a Crear (Fase 2)
Cuando pases a Fase 2, crearás:

docs/03_negocio/01_modulo_activos_clientes.md
docs/03_negocio/02_modulo_recursos.md
docs/03_negocio/03_modulo_operaciones.md
docs/03_negocio/04_modulo_logistica.md
docs/03_negocio/05_modulo_comercial.md
docs/03_negocio/06_modulo_cierre.md
docs/03_negocio/00_reglas_negocio.md (transversales)
docs/03_negocio/diagrama_er.md (base de datos)
db/schema.sql (tablas)


Este roadmap fue creado el 2026-06-10.
Próxima revisión: Cuando Fase 1 esté completa.
