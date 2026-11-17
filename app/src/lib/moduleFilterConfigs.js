import {
  resolveShipFilterLabel,
  resolveOtFilterLabel
} from './filterThemeConstants.js'
import { buildGenericFilterSummary } from './filterViewsService.js'

const findOtRowLabel = (otRows = [], otId = '') => {
  if (!otId || otId === 'ALL') return ''
  const found = otRows.find((o) => String(o.id) === String(otId))
  return found?.otLabel || found?.otNumber || String(otId)
}

export const MODULE_FILTER_CONFIGS = {
  work_orders: {
    defaults: {
      searchQuery: '',
      selectedShipFilter: 'todos',
      selectedOtFilter: 'todas',
      selectedStatusFilter: 'todos',
      selectedForemanFilter: 'todos',
      selectedContractorFilter: 'todos'
    },
    buildSummary: (f, { ships = [], workOrders = [] } = {}) => {
      const lines = []
      if (f.searchQuery) lines.push(`Búsqueda: "${f.searchQuery}"`)
      if (f.selectedShipFilter && f.selectedShipFilter !== 'todos') lines.push(`Barco: ${resolveShipFilterLabel(ships, f.selectedShipFilter)}`)
      if (f.selectedOtFilter && f.selectedOtFilter !== 'todas') lines.push(`OT: ${resolveOtFilterLabel(workOrders, f.selectedOtFilter)}`)
      if (f.selectedStatusFilter && f.selectedStatusFilter !== 'todos') lines.push(`Estado: ${f.selectedStatusFilter}`)
      if (f.selectedForemanFilter && f.selectedForemanFilter !== 'todos') lines.push(`Jefe: ${f.selectedForemanFilter}`)
      if (f.selectedContractorFilter && f.selectedContractorFilter !== 'todos') lines.push(`Contratista: ${f.selectedContractorFilter}`)
      return lines
    }
  },
  compras_pedidos: {
    defaults: {
      searchQuery: '',
      filterShip: 'TODOS',
      filterOt: 'TODAS',
      filterSupplier: 'TODOS',
      filterStatus: 'TODOS',
      filterFortnight: 'TODAS',
      filterChargeType: 'TODOS',
      filterNewOnly: false,
      hideReconciled: false,
      activeKpiFilter: null
    },
    buildSummary: (f, { ships = [], workOrders = [], suppliers = [] } = {}) => {
      const lines = []
      if (f.searchQuery) lines.push(`Búsqueda: "${f.searchQuery}"`)
      if (f.filterChargeType && f.filterChargeType !== 'TODOS') lines.push(`Destino: ${f.filterChargeType}`)
      if (f.filterShip && f.filterShip !== 'TODOS') lines.push(`Barco: ${resolveShipFilterLabel(ships, f.filterShip)}`)
      if (f.filterOt && f.filterOt !== 'TODAS') lines.push(`OT: ${resolveOtFilterLabel(workOrders, f.filterOt)}`)
      if (f.filterSupplier && f.filterSupplier !== 'TODOS') {
        const sup = suppliers.find((s) => String(s.id) === String(f.filterSupplier))
        lines.push(`Proveedor: ${sup?.name || f.filterSupplier}`)
      }
      if (f.filterStatus && f.filterStatus !== 'TODOS') lines.push(`Estado: ${f.filterStatus}`)
      if (f.filterFortnight && f.filterFortnight !== 'TODAS') lines.push(`Quincena: ${f.filterFortnight}`)
      if (f.filterNewOnly) lines.push('Solo materiales nuevos')
      if (f.hideReconciled) lines.push('Ocultar conciliados')
      if (f.activeKpiFilter) lines.push(`Radar KPI: ${f.activeKpiFilter}`)
      return lines
    }
  },
  panol: {
    defaults: {
      searchQuery: '',
      filterPeriod: 'TODOS',
      filterCategory: 'TODAS',
      filterShip: 'TODOS',
      filterOt: 'TODAS',
      filterContractor: 'TODOS',
      filterStockOnly: false,
      activeKpiFilter: null,
      onlyWithShipFilter: false
    },
    buildSummary: (f, { ships = [], workOrders = [] } = {}) => {
      const lines = []
      if (f.searchQuery) lines.push(`Búsqueda: "${f.searchQuery}"`)
      if (f.filterPeriod && f.filterPeriod !== 'TODOS') lines.push(`Período: ${f.filterPeriod}`)
      if (f.filterShip && f.filterShip !== 'TODOS') lines.push(`Barco: ${resolveShipFilterLabel(ships, f.filterShip)}`)
      if (f.filterOt && f.filterOt !== 'TODAS') lines.push(`OT: ${resolveOtFilterLabel(workOrders, f.filterOt)}`)
      if (f.filterContractor && f.filterContractor !== 'TODOS') lines.push(`Contratista: ${f.filterContractor}`)
      if (f.filterCategory && f.filterCategory !== 'TODAS') lines.push(`Categoría: ${f.filterCategory}`)
      if (f.filterStockOnly) lines.push('Solo con Control de Stock')
      if (f.activeKpiFilter) lines.push(`Radar KPI: ${f.activeKpiFilter}`)
      return lines
    }
  },
  labor_carga: {
    defaults: {
      filterWorker: '',
      filterDate: '',
      filterShip: '',
      filterOt: 'todas',
      filterContractor: 'todos',
      filterRubro: 'todos',
      filterModality: 'todas',
      activeKpiFilter: 'todos'
    },
    buildSummary: (f, { ships = [], workOrders = [] } = {}) => {
      const lines = []
      if (f.filterWorker) lines.push(`Búsqueda: "${f.filterWorker}"`)
      if (f.filterDate) lines.push(`Fecha: ${f.filterDate}`)
      if (f.filterShip) lines.push(`Barco: ${resolveShipFilterLabel(ships, f.filterShip)}`)
      if (f.filterOt && f.filterOt !== 'todas') lines.push(`OT: ${resolveOtFilterLabel(workOrders, f.filterOt)}`)
      if (f.filterContractor && f.filterContractor !== 'todos') lines.push(`Operario/Contr.: ${f.filterContractor}`)
      if (f.filterRubro && f.filterRubro !== 'todos') lines.push(`Rubro: ${f.filterRubro}`)
      if (f.filterModality && f.filterModality !== 'todas') lines.push(`Modalidad: ${f.filterModality}`)
      if (f.activeKpiFilter && f.activeKpiFilter !== 'todos') lines.push(`Radar KPI: ${f.activeKpiFilter}`)
      return lines
    }
  },
  terceros: {
    defaults: {
      searchTerm: '',
      kpiFilter: 'todos',
      selectedShipFilter: 'todos',
      selectedOtFilter: 'todas',
      selectedContractorFilter: 'todos',
      selectedTradeFilter: 'todos',
      selectedVoucherFilter: 'todos'
    },
    buildSummary: (f, { ships = [], workOrders = [] } = {}) => {
      const lines = []
      if (f.searchTerm) lines.push(`Búsqueda: "${f.searchTerm}"`)
      if (f.selectedShipFilter && f.selectedShipFilter !== 'todos') lines.push(`Barco: ${resolveShipFilterLabel(ships, f.selectedShipFilter)}`)
      if (f.selectedOtFilter && f.selectedOtFilter !== 'todas') lines.push(`OT: ${resolveOtFilterLabel(workOrders, f.selectedOtFilter)}`)
      if (f.selectedContractorFilter && f.selectedContractorFilter !== 'todos') lines.push(`Contratista: ${f.selectedContractorFilter}`)
      if (f.selectedTradeFilter && f.selectedTradeFilter !== 'todos') lines.push(`Rubro: ${f.selectedTradeFilter}`)
      if (f.selectedVoucherFilter && f.selectedVoucherFilter !== 'todos') lines.push(`Comprobante: ${f.selectedVoucherFilter}`)
      if (f.kpiFilter && f.kpiFilter !== 'todos') lines.push(`Radar KPI: ${f.kpiFilter}`)
      return lines
    }
  },
  ships_buques: {
    defaults: { searchTerm: '', locationFilter: 'todos', requestFilter: 'todos', ownerFilter: 'todos', roleQuickFilter: 'todos' },
    buildSummary: (f, { owners = [] } = {}) => {
      const lines = []
      if (f.searchTerm) lines.push(`Búsqueda: "${f.searchTerm}"`)
      if (f.locationFilter && f.locationFilter !== 'todos') lines.push(`Locación: ${f.locationFilter}`)
      if (f.requestFilter && f.requestFilter !== 'todos') lines.push(`Estado: ${f.requestFilter}`)
      if (f.ownerFilter && f.ownerFilter !== 'todos') {
        const ownerObj = owners.find((o) => String(o.id) === String(f.ownerFilter))
        lines.push(`Armador: ${ownerObj?.name || f.ownerFilter}`)
      }
      if (f.roleQuickFilter && f.roleQuickFilter !== 'todos') lines.push(`Filtro rol: ${f.roleQuickFilter}`)
      return lines
    }
  },
  ships_estadias: {
    defaults: { searchTerm: '', locationFilter: 'todos' },
    labelMap: { searchTerm: 'Búsqueda', locationFilter: 'Locación' }
  },
  ships_armadores: {
    defaults: { searchTerm: '' },
    labelMap: { searchTerm: 'Búsqueda' }
  },
  personal_nomina: {
    defaults: { searchTerm: '', kpiFilter: null, filterCenter: 'todos', filterStatus: 'todos', filterGroup: 'todos', filterForemanOnly: false },
    labelMap: { searchTerm: 'Búsqueda', kpiFilter: 'Radar KPI', filterCenter: 'Centro', filterStatus: 'Estado', filterGroup: 'Grupo', filterForemanOnly: 'Solo Jefes de Obra' }
  },
  personal_tarifario: {
    defaults: { filterTableCenter: 'todos', rateTableSearch: '', rateTableScope: 'current' },
    labelMap: { filterTableCenter: 'Centro', rateTableSearch: 'Búsqueda', rateTableScope: 'Alcance' }
  },
  resumen_materiales: {
    defaults: { searchQuery: '', kpiFilter: 'ALL', otFilter: 'ALL', contractorFilter: 'ALL', showMateriales: true, showConsumibles: true, materialQuick: '', onlyKgPositive: false },
    buildSummary: (f, { otRows = [] } = {}) => {
      const lines = []
      if (f.searchQuery) lines.push(`Búsqueda: "${f.searchQuery}"`)
      if (f.otFilter && f.otFilter !== 'ALL') lines.push(`OT: ${findOtRowLabel(otRows, f.otFilter)}`)
      if (f.contractorFilter && f.contractorFilter !== 'ALL') lines.push(`Contratista: ${f.contractorFilter}`)
      if (f.showMateriales === false) lines.push('Materiales: Oculto')
      if (f.showConsumibles === false) lines.push('Consumibles: Oculto')
      if (f.materialQuick) lines.push(`Tipo rápido: ${f.materialQuick}`)
      if (f.onlyKgPositive) lines.push('Solo KG > 0')
      if (f.kpiFilter && f.kpiFilter !== 'ALL') lines.push(`Radar KPI: ${f.kpiFilter}`)
      return lines
    }
  },
  resumen_horas: {
    defaults: { searchQuery: '', kpiFilter: 'ALL', otFilter: 'ALL', workerFilter: 'ALL', rubroFilter: 'ALL' },
    buildSummary: (f, { otRows = [] } = {}) => {
      const lines = []
      if (f.searchQuery) lines.push(`Búsqueda: "${f.searchQuery}"`)
      if (f.otFilter && f.otFilter !== 'ALL') lines.push(`OT: ${findOtRowLabel(otRows, f.otFilter)}`)
      if (f.workerFilter && f.workerFilter !== 'ALL') lines.push(`Operario/Contr.: ${f.workerFilter}`)
      if (f.rubroFilter && f.rubroFilter !== 'ALL') lines.push(`Rubro: ${f.rubroFilter}`)
      if (f.kpiFilter && f.kpiFilter !== 'ALL') lines.push(`Radar KPI: ${f.kpiFilter}`)
      return lines
    }
  },
  resumen_terceros: {
    defaults: { searchQuery: '', kpiFilter: 'ALL', otFilter: 'ALL', contractorFilter: 'ALL', voucherFilter: 'ALL' },
    buildSummary: (f, { otRows = [] } = {}) => {
      const lines = []
      if (f.searchQuery) lines.push(`Búsqueda: "${f.searchQuery}"`)
      if (f.otFilter && f.otFilter !== 'ALL') lines.push(`OT: ${findOtRowLabel(otRows, f.otFilter)}`)
      if (f.contractorFilter && f.contractorFilter !== 'ALL') lines.push(`Contratista: ${f.contractorFilter}`)
      if (f.voucherFilter && f.voucherFilter !== 'ALL') lines.push(`Comprobante: ${f.voucherFilter}`)
      if (f.kpiFilter && f.kpiFilter !== 'ALL') lines.push(`Radar KPI: ${f.kpiFilter}`)
      return lines
    }
  },
  resumen_remito: {
    defaults: { searchQuery: '', kpiFilter: 'ALL', taxFilter: 'ALL' },
    labelMap: { searchQuery: 'Búsqueda', kpiFilter: 'Radar KPI', taxFilter: 'Alícuota' }
  },
  tesoreria_deducciones: {
    defaults: { searchTerm: '', categoryFilter: 'ALL', selectedContractor: 'ALL' },
    labelMap: { searchTerm: 'Búsqueda', categoryFilter: 'Categoría', selectedContractor: 'Contratista' }
  }
}

export function getModuleFilterConfig(moduleKey) {
  return MODULE_FILTER_CONFIGS[moduleKey] || { defaults: {}, labelMap: {} }
}

export function resolveConfiguredSummary(moduleKey, filters, summaryContext = {}) {
  const cfg = getModuleFilterConfig(moduleKey)
  if (typeof cfg.buildSummary === 'function') {
    const lines = cfg.buildSummary(filters, summaryContext)
    if (lines.length > 0) return lines
  }
  return buildGenericFilterSummary(filters, cfg.defaults || {}, cfg.labelMap || {})
}
