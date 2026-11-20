/**
 * plateCutsExport.js
 * Generador canónico de Reporte Trazado de Cortes / Parches de Chapa (Candado #2).
 * Reutilizable desde Resumen Gerencial (Hoja Materiales -> [Chapa]) y Pañol (Movimientos -> [Chapa]).
 * Cruza Fecha de Reporte, Fecha de Carga, Barco, OT, Medidas (=1*0.5), Área (m²), Peso (kg) y Ubicación (Observaciones).
 */
import { exportToSpreadsheet } from './exportEngine.js'
import { describeFormula, formatFormulaNumericDisplay } from './formulaEngine.js'

function cleanDateOnly(val) {
  if (!val) return ''
  return String(val).slice(0, 10)
}

export function buildPlateCutsReportRows(rows = [], { fallbackShipName = '' } = {}) {
  const validRows = Array.isArray(rows) ? rows : []
  let totalArea = 0
  let totalKg = 0

  const mapped = validRows.map((r, idx) => {
    const qty = Number(r.qty ?? r.quantity_withdrawn ?? 0) || 0
    const weightKg = Number(r.weightKg ?? r.weight_total ?? 0) || 0
    totalArea += qty
    totalKg += weightKg

    const formula = r.qtyFormula || r.cell_formulas?.quantity_withdrawn || ''
    const meta = describeFormula(formula)
    const cutDims = r.cutDimensionsLabel || meta?.dimensionsLabel || ''

    return {
      nro: idx + 1,
      barco: r.shipName || fallbackShipName || 'SIN BUQUE',
      ot: r.otLabel || r.otNumber || 'Sin OT',
      fecha_reporte: cleanDateOnly(r.date || r.transaction_date),
      fecha_carga: cleanDateOnly(r.createdAt || r.created_at || r.date || r.transaction_date),
      material: r.materialName || 'Chapa / Material',
      medidas_corte: cutDims || '—',
      formula: formula || '',
      area_cant: Number(qty.toFixed(4)),
      unidad: r.unitMeasure || 'm²',
      peso_kg: Number(weightKg.toFixed(2)),
      ubicacion_observaciones: r.notes || '',
      solicitante: r.workerName || r.contractorLabel || ''
    }
  })

  if (mapped.length > 0) {
    mapped.push({
      nro: 'TOTAL',
      barco: `${mapped.length} ${mapped.length === 1 ? 'parche/corte' : 'parches/cortes'}`,
      ot: '',
      fecha_reporte: '',
      fecha_carga: '',
      material: 'RESUMEN TOTAL',
      medidas_corte: '',
      formula: '',
      area_cant: Number(totalArea.toFixed(4)),
      unidad: mapped[0]?.unidad || 'm²',
      peso_kg: Number(totalKg.toFixed(2)),
      ubicacion_observaciones: `Área acumulada: ${formatFormulaNumericDisplay(totalArea, { maxDecimals: 3 })}`,
      solicitante: ''
    })
  }

  return mapped
}

export function exportPlateCutsReport({ rows = [], shipName = 'buque' } = {}) {
  const reportRows = buildPlateCutsReportRows(rows, { fallbackShipName: shipName })
  if (reportRows.length === 0) {
    alert('No hay movimientos de chapa / cortes para exportar con los filtros actuales.')
    return
  }

  const safeShip = String(shipName || 'buque')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .toLowerCase()
  const today = new Date().toISOString().slice(0, 10)

  exportToSpreadsheet({
    filename: `reporte_parches_chapa_${safeShip}_${today}.csv`,
    rows: reportRows,
    columns: [
      { key: 'nro', label: '#' },
      { key: 'barco', label: 'Barco' },
      { key: 'ot', label: 'O.T.' },
      { key: 'fecha_reporte', label: 'Fecha Reporte' },
      { key: 'fecha_carga', label: 'Fecha Carga' },
      { key: 'material', label: 'Material (Chapa)' },
      { key: 'medidas_corte', label: 'Corte / Medidas' },
      { key: 'formula', label: 'Fórmula' },
      { key: 'area_cant', label: 'Área / Cant.' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'peso_kg', label: 'Peso (kg)' },
      { key: 'ubicacion_observaciones', label: 'Ubicación / Observaciones' },
      { key: 'solicitante', label: 'Solicitante / Contratista' }
    ]
  })
}
