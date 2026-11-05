/**
 * exportEngine.js
 * 
 * Motor Canónico de Exportación de Datos para AlonCar ERP.
 * Permite descargar planillas filtradas o seleccionadas en formato CSV
 * compatible nativamente con Microsoft Excel y Google Sheets.
 */

/**
 * Convierte un arreglo de objetos o filas a un archivo CSV con formato estándar Excel (UTF-8 con BOM)
 * @param {Object} options
 * @param {string} options.filename - Nombre del archivo (sin extensión o con .csv)
 * @param {Array<Object>} options.rows - Lista de registros a exportar
 * @param {Array<{ key: string, label: string, formatter?: (val: any, row: any) => string }>} [options.columns] - Definición de columnas opcional
 */
export function exportToSpreadsheet({ filename = 'exportacion_aloncar', rows = [], columns = null }) {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar con los filtros actuales.')
    return
  }

  let headers = []
  let colKeys = []
  let formatters = {}

  if (columns && columns.length > 0) {
    headers = columns.map(c => c.label || c.key)
    colKeys = columns.map(c => c.key)
    columns.forEach(c => {
      if (typeof c.formatter === 'function') {
        formatters[c.key] = c.formatter
      }
    })
  } else {
    // Si no se pasan columnas, extraer todas las propiedades del primer registro excluyendo objetos complejos
    const firstRow = rows[0]
    colKeys = Object.keys(firstRow).filter(k => typeof firstRow[k] !== 'object' || firstRow[k] === null)
    headers = colKeys.map(k => k.replace(/_/g, ' ').toUpperCase())
  }

  // Escapar valores para CSV (comillas dobles, comas, saltos de línea)
  const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const csvRows = []
  // 1. Cabecera
  csvRows.push(headers.map(escapeCsvValue).join(';'))

  // 2. Filas de datos
  for (const row of rows) {
    const values = colKeys.map(key => {
      let val
      if (formatters[key]) {
        val = formatters[key](row[key], row)
      } else {
        val = row[key]
      }
      return escapeCsvValue(val)
    })
    csvRows.push(values.join(';'))
  }

  // Usar BOM \uFEFF para que Excel reconozca tildes, ñ y caracteres latinos
  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', cleanName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
