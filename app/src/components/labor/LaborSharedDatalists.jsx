import { useMemo } from 'react'
import { buildLaborEligibleCatalog } from '../../lib/laborWorkerCatalog.js'
import { OFFICIAL_RUBROS_CATALOG } from '../../lib/tradesCatalog.js'
import { RUBROS_SUGERIDOS } from '../../lib/laborConstants.js'

/**
 * Datalists globales compartidos para edición inline de grillas y modales de Horas
 * (LaborLogsTableRow, LaborControlDiarioPanel, EditLaborLogModal, QuickLogModal).
 */
export default function LaborSharedDatalists({ dbWorkers = [] }) {
  const workerNames = useMemo(() => {
    const catalog = buildLaborEligibleCatalog(dbWorkers)
    const set = new Set()
    catalog.astilleroWorkers.forEach((w) => set.add(w.name))
    catalog.contractorGroups.forEach((g) => set.add(g))
    catalog.externalWorkers.forEach((w) => set.add(w.name))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [dbWorkers])

  const rubroNames = useMemo(() => {
    const set = new Set(OFFICIAL_RUBROS_CATALOG.map((c) => c.label))
    RUBROS_SUGERIDOS.forEach((r) => set.add(r))
    return Array.from(set)
  }, [])

  return (
    <>
      <datalist id="all-workers-datalist">
        {workerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <datalist id="rubros-list-carga">
        {rubroNames.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </>
  )
}
