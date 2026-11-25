/**
 * panolStockHelp.js
 * Ayuda contextual Stepper para Entradas manuales, Salidas y Recuentos de Stock (M4 · GS-007).
 */

export const PANOL_STOCK_ADJUST_STEP_HELP = {
  1: {
    id: 'panol_stock_adjust_step_1',
    module: 'panol_stock_adjust',
    step: 1,
    title: 'PASO 1 · MATERIAL Y TIPO DE MOVIMIENTO',
    uiBullets: [
      {
        label: '+ Entrada / − Salida / ⚖️ Recuento',
        text: 'Usá Entrada para ingresos sin orden de compra, Salida para mermas/roturas o Recuento físico para fijar el saldo real contado.'
      },
      {
        label: 'Trazabilidad Única',
        text: 'Cada movimiento se guarda en Entradas & Ajustes y recalcula el stock físico al instante desde PostgreSQL.'
      }
    ],
    aiRuleContext:
      'Regla de Movimientos Manuales de Stock (GS-007): Toda entrada manual (+), salida/merma (-) o recuento físico se registra como fila inmutable en stock_adjustments y dispara el recálculo en PostgreSQL de materials.current_stock sin alterar retiros históricos ya congelados.'
  },
  2: {
    id: 'panol_stock_adjust_step_2',
    module: 'panol_stock_adjust',
    step: 2,
    title: 'PASO 2 · CANTIDAD, FECHA Y MOTIVO',
    uiBullets: [
      {
        label: 'Vista Previa Exacta',
        text: 'Antes de confirmar verificás el saldo previo, la variación (+ / −) y el stock resultante final en el sistema.'
      },
      {
        label: 'Condición del Insumo',
        text: 'Indicá si queda Disponible, En cuarentena, Obsoleto o Dañado y dejá observación respaldatoria para auditoría.'
      }
    ],
    aiRuleContext:
      'Regla de Auditoría y Motivo en Ajustes de Stock: Todo ajuste persiste reason_type (MANUAL_ENTRY, MANUAL_EXIT, AUDIT_CORRECTION, INITIALIZATION, DAMAGE, RECOVERY, OTHER), material_condition (DISPONIBLE, EN_CUARENTENA, OBSOLETO, DANADO), fecha efectiva ART y nota obligatoria en audit_logs.'
  }
}

export const PANOL_STOCK_AUDIT_STEP_HELP = {
  1: {
    id: 'panol_stock_audit_step_1',
    module: 'panol_stock_audit',
    step: 1,
    title: 'PASO 1 · ALCANCE, RUBRO Y AJUSTE AUTOMÁTICO',
    uiBullets: [
      {
        label: 'Control por Rubro o Lote',
        text: 'Filtrá por Rubro técnico (ej. Chapas, Soldadura) para auditar un sector del depósito en una sola planilla.'
      },
      {
        label: 'Ajuste Compensatorio',
        text: 'Activá la opción automática para generar ajustes (AUDIT_CORRECTION) sobre cada diferencia detectada.'
      }
    ],
    aiRuleContext:
      'Regla de Control Físico por Lotes (GS-007): Cada auditoría registra filas en stock_audits comparando system_quantity vs counted_quantity. Si applyAdjustments está activo, las diferencias generan filas compensatorias AUDIT_CORRECTION en stock_adjustments actualizando materials.current_stock.'
  },
  2: {
    id: 'panol_stock_audit_step_2',
    module: 'panol_stock_audit',
    step: 2,
    title: 'PASO 2 · RECUENTO FÍSICO POR MATERIAL',
    uiBullets: [
      {
        label: 'Solo Materiales Contados',
        text: 'Completá únicamente los materiales que verificaste en estantería; los casilleros vacíos se omiten del lote.'
      },
      {
        label: 'Indicador KPI Exactitud',
        text: 'Cada ítem contado alimenta los porcentajes históricos de % Datos Correctos y % Con Error.'
      }
    ],
    aiRuleContext:
      'Regla de Carga de Conteo Físico: Solo los materiales con valor numérico ingresado se registran como OK (|delta| <= 0.0005) o DISCREPANCY en stock_audits con auditoría en audit_logs.'
  }
}

