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

export const BUSINESS_HELP_REGISTRY = {
  panol_catalogo: PANOL_MATERIAL_STEP_HELP
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
