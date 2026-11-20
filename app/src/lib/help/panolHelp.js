/**
 * panolHelp.js
 * Registro de reglas de negocio y ayudas contextuales para los menús de carga de Pañol (M4).
 */

export const HIGH_VALUE_MATERIAL_USD_THRESHOLD = 4000
export const DEFAULT_SECURITY_FACTOR = 1.06
export const HIGH_VALUE_SECURITY_FACTOR = 1.02

export const PANOL_MATERIAL_STEP_HELP = {
  1: {
    id: 'panol_material_step_1',
    module: 'panol_catalogo',
    step: 1,
    title: 'PASO 1 · IDENTIFICACIÓN',
    uiBullets: [
      {
        label: 'Nombre Técnico (MAYÚSCULAS)',
        text: 'Usá el mismo nombre técnico del proveedor para agilizar futuras recompras.'
      },
      {
        label: 'Categorías (3 únicas)',
        text: 'MATERIALES (obra ➔ Cliente) · CONSUMIBLES (desgaste ➔ Cliente/Contratista según contrato) · ELEM. SEGURIDAD (EPP ➔ misma regla).'
      },
      {
        label: 'Rubro Técnico',
        text: 'Agrupa familias de insumos (ej. Chapas, Soldadura) para ordenar stock, búsquedas y compras.'
      }
    ],
    aiRuleContext:
      'Regla de Identificación de Materiales en Pañol AlonCar: El nombre técnico oficial debe escribirse siempre en MAYÚSCULAS y coincidir con la nomenclatura del proveedor para facilitar recompras sin ambigüedades. Existen únicamente 3 categorías oficiales: MATERIALES (insumos directos de obra imputados siempre al Cliente), CONSUMIBLES (insumos de desgaste como discos, electrodos o arena cuya imputación Cliente/Contratista depende del contrato del contratista según DEC-009) y ELEM.SEGURIDAD (EPP con igual lógica de imputación). El Rubro Técnico pertenece a la base 1:N material_rubros (hoja RUBRO.MAT).'
  },
  2: {
    id: 'panol_material_step_2',
    module: 'panol_catalogo',
    step: 2,
    title: 'PASO 2 · PRECIO Y % SEGURIDAD',
    uiBullets: [
      { label: 'Fórmula', text: 'Costo AR$ × % Seguridad ÷ Dólar = Costo US$' },
      { label: 'Por defecto', text: 'Dejar siempre cargado en 6%.' },
      { label: 'Atención', text: 'Si el material supera US$ 4.000, usar 2% de porcentaje de seguridad.' }
    ],
    aiRuleContext:
      'Regla de Precio y Porcentaje de Seguridad Naval en Pañol AlonCar: El costo en dólares se calcula mediante la fórmula (cost_ars * security_factor) / dolar_referencia_vigente, tomando el dólar de referencia desde macro_variables. El porcentaje de seguridad por defecto es 6% (factor 1.06). Regla fija de alto valor: si el valor del material supera US$ 4.000, debe utilizarse 2% de porcentaje de seguridad (factor 1.02). Solo el Administrador puede modificar el % de seguridad.'
  },
  3: {
    id: 'panol_material_step_3',
    module: 'panol_catalogo',
    step: 3,
    title: 'PASO 3 · UNIDAD DE MEDIDA',
    uiBullets: [
      {
        label: 'Unidad Oficial',
        text: 'Definí cómo se compra y despacha (ej. m² para chapas, kg para electrodos, Bolsón, Unidad).'
      },
      {
        label: 'Sincronización',
        text: 'Compras y el Asistente de Consumo (6 meses) heredan automáticamente esta unidad.'
      }
    ],
    aiRuleContext:
      'Regla de Unidad de Medida: La unidad oficial configurada en Catálogo & Stock (Pañol) es la fuente única de verdad para el módulo de Compras y los reportes de consumo de 6 meses. Las chapas navales se miden en m² (Lado x Lado), no en unidad "Chapa".'
  },
  4: {
    id: 'panol_material_step_4',
    module: 'panol_catalogo',
    step: 4,
    title: 'PASO 4 · CONTROL DE STOCK',
    uiBullets: [
      {
        label: 'Lleva Stock',
        text: 'Al tildarlo, el material entra en la planilla de control físico del pañolero con las mismas reglas que el resto del depósito.'
      },
      {
        label: 'Stock Mínimo',
        text: 'Marca el piso para alertas críticas de reposición. Tanto Lleva Stock como Mínimo son exclusivos del Administrador.'
      }
    ],
    aiRuleContext:
      'Regla de Control de Stock Físico: Tildar requires_stock_control (Lleva Stock) incorpora el material a la vista de Stock del Pañolero y activa las alertas cuando stock_actual <= stock_minimo. Solo el Administrador puede editar Lleva Stock y Stock Mínimo; el stock físico actual se ajusta por separado desde el botón Ajustar Stock.'
  }
}

export const PANOL_WITHDRAWAL_STEP_HELP = {
  1: {
    id: 'panol_withdrawal_step_1',
    module: 'panol_retiros',
    step: 1,
    title: 'PASO 1 · DESTINO E IMPUTACIÓN DE OBRA',
    uiBullets: [
      {
        label: 'Cascada Naval',
        text: 'Elegí Barco ➔ Operario/Contratista ➔ Orden de Trabajo (OT). Solo aparecen operarios habilitados con permiso de Pañol (P).'
      },
      {
        label: 'Texto flotante de OT',
        text: 'Pasá el mouse sobre cualquier OT del desplegable (o sobre la OT elegida) para ver su alcance completo y tareas sin expandir la pantalla.'
      },
      {
        label: 'Sin OT / Solicitudes',
        text: 'Si el contratista aún no tiene OT abierta en el buque, tildá (⚠️ Sin OT) o solicitá apertura/alta a Jorge Sentis.'
      }
    ],
    aiRuleContext:
      'Regla de Imputación de Retiros de Pañol (Cascada Naval): Todo retiro se imputa en orden Barco -> Operario/Contratista -> OT. Las OTs muestran su alcance consolidado únicamente mediante tooltip flotante canónico (CanonicalOtBadge / formatWorkOrderTooltipCanonical). Si el operario/contratista no posee OT activa en ese barco, se permite imputación provisoria con Sin OT y solicitud de apertura a Administración.'
  },
  2: {
    id: 'panol_withdrawal_step_2',
    module: 'panol_retiros',
    step: 2,
    title: 'PASO 2 · INSUMOS Y MATERIALES RETIRADOS',
    uiBullets: [
      {
        label: 'Buscador Canónico',
        text: 'Escribí nombre, rubro o categoría (sin tildes ni mayúsculas) y elegí con ↑↓ + Enter.'
      },
      {
        label: 'Miniatura 5×5 cm',
        text: 'A la izquierda de cada renglón ves la foto del material; hacé clic para ampliarla a 5 cm × 5 cm.'
      },
      {
        label: 'Tubos de Gas',
        text: 'Al elegir un gas se despliega en línea el control de Primera Entrega o Recambio 1×1 con marca entregada/devuelta.'
      }
    ],
    aiRuleContext:
      'Regla de Carga Multi-Material en Pañol: Cada renglón usa el selector canónico CanonicalMaterialPicker con miniatura ampliable a 5cm x 5cm, cantidad en unidad oficial, peso calculado y centro de costo (CLIENTE o CONTRATISTA). Si el material corresponde a gases industriales, requiere trazabilidad de proveedor entregado/devuelto.'
  },
  3: {
    id: 'panol_withdrawal_step_3',
    module: 'panol_retiros',
    step: 3,
    title: 'PASO 3 · FECHA Y OBSERVACIONES',
    uiBullets: [
      {
        label: 'Fecha real',
        text: 'Se precarga la fecha de hoy; ajustala si estás registrando un vale físico de una jornada anterior.'
      },
      {
        label: 'Trazabilidad',
        text: 'Anotá ubicación en buque o aclaración útil para facturación y control de obra (se audita en audit_logs).'
      }
    ],
    aiRuleContext:
      'Regla de Fecha y Notas en Retiros de Pañol: La fecha del retiro impacta en el control de stock diario y reportes de consumo de 6 meses; las observaciones generales quedan asociadas a todos los renglones creados en el lote.'
  }
}

export const PANOL_GAS_SUPPLIER_STEP_HELP = {
  1: {
    id: 'panol_gas_supplier_step_1',
    module: 'panol_gases',
    step: 1,
    title: 'PASO 1 · EMPRESA GASERA Y REMITO',
    uiBullets: [
      { label: 'Proveedor Gasero', text: 'Elegí la firma (Air Liquide, Praxair Linde, Atlántica Gas) para ver el saldo actual en patio y en contratistas.' },
      { label: 'Fecha y N° Remito', text: 'Cargá la fecha real y el número del remito físico para cruzar la factura mensual de alquiler de envases.' }
    ],
    aiRuleContext:
      'Regla de Remitos con Gaseras: Toda entrada, devolución o saldo inicial de cilindros se registra contra un proveedor gasero con fecha y número de remito para conciliación de envases.'
  },
  2: {
    id: 'panol_gas_supplier_step_2',
    module: 'panol_gases',
    step: 2,
    title: 'PASO 2 · RENGLONES DEL REMITO',
    uiBullets: [
      { label: 'Remitos Mixtos', text: 'Podés combinar en un mismo remito devoluciones de tubos vacíos y recepción de tubos llenos.' },
      { label: 'Plantillas Rápidas', text: 'Usá "Devolver + Pedir" o "Saldo Inicial" para precargar la estructura habitual del camión semanal.' }
    ],
    aiRuleContext:
      'Regla de Renglones de Gases: Cada renglón discrimina tipo de operación (DEVOLUCION_PROVEEDOR, INGRESO_PROVEEDOR, SALDO_INICIAL_PATIO), tipo de gas, estado físico (VACIO/LLENO) y cantidad entera.'
  },
  3: {
    id: 'panol_gas_supplier_step_3',
    module: 'panol_gases',
    step: 3,
    title: 'PASO 3 · OBSERVACIONES E IMPACTO EN PATIO',
    uiBullets: [
      { label: 'Vista Previa', text: 'Confirmá los saldos (+Llenos / -Vacíos) que se van a impactar en el patio del astillero.' },
      { label: 'Separación Contable', text: 'Este registro controla trazabilidad física de envases; las compras valorizadas siguen ingresando por Compras.' }
    ],
    aiRuleContext:
      'Regla de Impacto en Patio de Gases: El remito actualiza únicamente la trazabilidad de envases en gas_cylinder_movements y se audita en audit_logs.'
  }
}

export const PANOL_GAS_CONTRACTOR_STEP_HELP = {
  1: {
    id: 'panol_gas_contractor_step_1',
    module: 'panol_gases_contratista',
    step: 1,
    title: 'PASO 1 · OPERACIÓN Y CONTRATISTA',
    uiBullets: [
      { label: '3 Movimientos Canónicos', text: 'Primera Entrega (+1 deuda) · Recambio 1×1 (+1 vacío devuelto, -1 lleno) · Devolución Final (-1 deuda).' },
      { label: 'Destino', text: 'Indicá contratista y barco (o dejá Sin Barco si el tubo trabaja en taller/astillero).' }
    ],
    aiRuleContext:
      'Regla de Gases a Contratista: Controla deuda de cilindros por contratista mediante PRIMERA_ENTREGA, RECAMBIO_1X1 y DEVOLUCION_FINAL.'
  },
  2: {
    id: 'panol_gas_contractor_step_2',
    module: 'panol_gases_contratista',
    step: 2,
    title: 'PASO 2 · TUBO, MARCAS Y CANTIDAD',
    uiBullets: [
      { label: 'Cruce de Marcas', text: 'Registrá qué marca se entregó llena y, si hubo recambio, qué marca volvió vacía para evitar diferencias con gaseras.' }
    ],
    aiRuleContext:
      'Regla de Marcas de Envases: En recambios cruzados es obligatorio registrar supplier_delivered_id y supplier_returned_id.'
  },
  3: {
    id: 'panol_gas_contractor_step_3',
    module: 'panol_gases_contratista',
    step: 3,
    title: 'PASO 3 · OBSERVACIONES',
    uiBullets: [
      { label: 'Trazabilidad', text: 'Anotá grada, sector o responsable que retira el tubo para auditar reclamos futuros.' }
    ],
    aiRuleContext:
      'Regla de Observaciones en Gases: Las notas quedan persistidas junto al movimiento de cilindro en gas_cylinder_movements.'
  }
}

export const PANOL_QUICK_PURCHASE_STEP_HELP = {
  1: {
    id: 'panol_quick_purchase_step_1',
    module: 'panol_pedido_compras',
    step: 1,
    title: 'PASO 1 · MATERIAL A REPONER',
    uiBullets: [
      { label: 'Unidad Oficial', text: 'La cantidad se pide automáticamente en la unidad oficial configurada en el Catálogo de Pañol.' }
    ],
    aiRuleContext:
      'Regla de Pedido Directo Pañol -> Compras: Se crea en purchase_orders con estado PEDIR, destino VIA_PANOL y observaciones en observations.'
  },
  2: {
    id: 'panol_quick_purchase_step_2',
    module: 'panol_pedido_compras',
    step: 2,
    title: 'PASO 2 · CANTIDAD Y URGENCIA',
    uiBullets: [
      { label: 'Prioridad Compras', text: 'SIN APURO (reposición normal) · URGENTE (prioridad diaria) · BLOQUEANTE (frena obra en curso).' }
    ],
    aiRuleContext:
      'Regla de Urgencia en Pedidos Directos: El nivel de urgencia ordena las alertas de Compras sin perder la fecha del pedido.'
  }
}
