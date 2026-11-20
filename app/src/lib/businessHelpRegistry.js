/**
 * businessHelpRegistry.js
 * Registro Centralizado de Reglas de Negocio y Ayudas Contextuales (UI + IA de Fondo).
 * Fuente Única de Verdad para:
 * 1) Tarjetas emergentes simples en los circulitos de pasos (UI guiada).
 * 2) Contexto estructurado consumible por el Asistente / Copiloto IA de AlonCar ERP.
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
      {
        label: 'Fórmula',
        text: 'Costo AR$ × % Seguridad ÷ Dólar = Costo US$'
      },
      {
        label: 'Por defecto',
        text: 'Dejar siempre cargado en 6%.'
      },
      {
        label: 'Atención',
        text: 'Si el material supera US$ 4.000, usar 2% de porcentaje de seguridad.'
      }
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
      'Regla de Control de Stock Físico: Tildar requires_stock_control (Lleva Stock) incorpora el material a la vista de Stock del Pañolero y activa las alertas cuando stock_actual <= stock_minimo. Los materiales sin control de stock no ensucian la vista de Stock del pañolero y se consultan desde la Planilla de Retiros. Solo el Administrador puede editar Lleva Stock y Stock Mínimo; el stock físico actual se ajusta por separado desde el botón Ajustar Stock.'
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

export const BUSINESS_HELP_REGISTRY = {
  panol_catalogo: PANOL_MATERIAL_STEP_HELP,
  panol_retiros: PANOL_WITHDRAWAL_STEP_HELP
}

/**
 * Serializa las reglas de negocio ordenadas para inyección en el Asistente / Copiloto IA.
 */
export function exportBusinessHelpForAI(moduleKey = null) {
  const modules = moduleKey ? { [moduleKey]: BUSINESS_HELP_REGISTRY[moduleKey] || {} } : BUSINESS_HELP_REGISTRY
  const entries = []
  for (const [mod, steps] of Object.entries(modules)) {
    for (const item of Object.values(steps)) {
      entries.push({
        id: item.id,
        module: mod,
        step: item.step,
        title: item.title,
        rule: item.aiRuleContext
      })
    }
  }
  return entries
}
