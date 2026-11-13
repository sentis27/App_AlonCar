import { useState, useMemo } from 'react'
import {
  Truck,
  Flame,
  Plus,
  Trash2,
  Check,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  PackageCheck,
  Sparkles
} from 'lucide-react'
import { GAS_SUPPLIER_OPERATION_TYPES } from '../../lib/panolConstants'

function createLine(operationType = 'DEVOLUCION_PROVEEDOR', defaultMaterialId = '') {
  const defaultCond = operationType === 'DEVOLUCION_PROVEEDOR' ? 'VACIO' : 'LLENO'
  return {
    rowKey: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operationType,
    materialId: defaultMaterialId,
    condition: defaultCond,
    quantity: 1,
    notes: ''
  }
}

/**
 * Modal modular para registrar Saldo Inicial, Ingresos por Remito o Devoluciones (Vacíos/Llenos)
 * entre el Pañol del Astillero y Empresas Gaseras (Air Liquide, Praxair Linde, Atlántica Gas, etc.).
 */
export function GasSupplierMovementModal({
  isOpen,
  initialSupplierId = '',
  suppliers = [],
  materials = [],
  gasStats = null,
  onClose,
  onConfirm,
  onCreateQuickGas
}) {
  const sortedGasMaterials = useMemo(
    () => [...(materials || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [materials]
  )

  const [supplierId, setSupplierId] = useState(
    () => initialSupplierId || suppliers?.[0]?.id || ''
  )
  const [movementDate, setMovementDate] = useState(
    () => new Date().toISOString().split('T')[0]
  )
  const [remitoNumber, setRemitoNumber] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [lines, setLines] = useState(() => [
    createLine('DEVOLUCION_PROVEEDOR', sortedGasMaterials[0]?.id || '')
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Alta rápida de nuevo tipo de gas en catálogo (ej: CO2, Argón) si aún no existe
  const [showQuickGasForm, setShowQuickGasForm] = useState(false)
  const [quickGasName, setQuickGasName] = useState('')
  const [creatingGas, setCreatingGas] = useState(false)

  const currentSupplierStats = supplierId ? gasStats?.patioStock?.[supplierId] || null : null

  const updateLine = (rowKey, patch) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.rowKey !== rowKey) return l
        const updated = { ...l, ...patch }
        if (patch.operationType && patch.operationType !== l.operationType) {
          updated.condition = patch.operationType === 'DEVOLUCION_PROVEEDOR' ? 'VACIO' : 'LLENO'
        }
        return updated
      })
    )
  }

  const applyPresetMixed = () => {
    const firstMat = sortedGasMaterials[0]?.id || ''
    const secondMat = sortedGasMaterials[1]?.id || firstMat
    setLines([
      createLine('DEVOLUCION_PROVEEDOR', firstMat),
      createLine('INGRESO_PROVEEDOR', secondMat)
    ])
  }

  const applyPresetInitial = () => {
    const firstMat = sortedGasMaterials[0]?.id || ''
    setLines([createLine('SALDO_INICIAL_PATIO', firstMat)])
  }

  const handleQuickCreateGas = async () => {
    if (!quickGasName.trim() || !onCreateQuickGas || creatingGas) return
    try {
      setCreatingGas(true)
      const created = await onCreateQuickGas(quickGasName.trim())
      if (created?.id) {
        setLines((prev) =>
          prev.map((l, idx) =>
            idx === prev.length - 1 || !l.materialId ? { ...l, materialId: created.id } : l
          )
        )
      }
      setQuickGasName('')
      setShowQuickGasForm(false)
    } finally {
      setCreatingGas(false)
    }
  }

  const impactPreview = useMemo(() => {
    const matMap = new Map(sortedGasMaterials.map((m) => [m.id, m.name]))
    const summary = []
    lines.forEach((l) => {
      const q = Math.round(Number(l.quantity) || 0)
      if (!l.materialId || q <= 0) return
      const name = matMap.get(l.materialId) || 'Gas'
      const isOut = l.operationType === 'DEVOLUCION_PROVEEDOR'
      const sign = isOut ? '-' : '+'
      summary.push({
        key: l.rowKey,
        name,
        opType: l.operationType,
        isOut,
        label: `${sign}${q} ${l.condition === 'VACIO' ? 'Vacío(s)' : 'Lleno(s)'}`
      })
    })
    return summary
  }, [lines, sortedGasMaterials])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!supplierId) {
      return alert('Seleccioná la Empresa Gasera (ej. Air Liquide, Praxair Linde).')
    }
    if (lines.length === 0) {
      return alert('Agregá al menos un renglón.')
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!l.materialId) {
        return alert(`Seleccioná el Tipo de Gas en el renglón #${i + 1}.`)
      }
      if (!Number.isFinite(Number(l.quantity)) || Number(l.quantity) < 1) {
        return alert(`La cantidad en el renglón #${i + 1} debe ser mayor o igual a 1.`)
      }
    }

    try {
      setIsSubmitting(true)
      await onConfirm({
        supplierId,
        movementDate,
        remitoNumber: remitoNumber.trim(),
        notes: generalNotes.trim(),
        lines: lines.map((l) => ({
          operationType: l.operationType,
          materialId: l.materialId,
          condition: l.condition,
          quantity: Math.round(Number(l.quantity)),
          notes: l.notes
        }))
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-4xl">
        {/* Header */}
        <div className="alon-modal-header">
          <div className="flex items-center gap-2.5 text-white font-black text-sm min-w-0">
            <Truck className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <span className="block leading-tight truncate">
                REMITO Y MOVIMIENTOS CON EMPRESA GASERA (PATIO ASTILLERO)
              </span>
              <span className="text-[11px] font-normal text-slate-400 block truncate">
                Registrá saldos iniciales, devoluciones de vacíos/llenos e ingresos en un mismo remito multi-renglón.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="alon-modal-body space-y-3.5">
            {/* ZONA 1: EMPRESA GASERA Y DATOS DEL REMITO */}
            <div className="alon-chunk-sky space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 pb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-sky-400" />
                  <span>1. Empresa Gasera y Datos del Remito</span>
                </span>
                {currentSupplierStats && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                      Patio Llenos: {currentSupplierStats.full}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 font-bold">
                      Patio Vacíos: {currentSupplierStats.empty}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold">
                      En Contratistas: {currentSupplierStats.withContractors || 0}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-200 font-black">
                      Total Envases: {currentSupplierStats.totalCompanyCylinders ?? (currentSupplierStats.full + currentSupplierStats.empty)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">
                    Empresa Proveedora <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">Seleccionar Empresa...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">
                    Fecha del Movimiento <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={movementDate}
                    onChange={(e) => setMovementDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">
                    N° Remito / Comprobante
                  </label>
                  <input
                    type="text"
                    value={remitoNumber}
                    onChange={(e) => setRemitoNumber(e.target.value.toUpperCase())}
                    placeholder="Ej: 0001-00458210"
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 font-mono uppercase focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {currentSupplierStats?.byGas?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                  <span className="text-slate-400 font-semibold">Detalle actual por gas:</span>
                  {currentSupplierStats.byGas.map((g) => (
                    <span
                      key={g.materialId || g.materialName}
                      className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-slate-200"
                    >
                      <strong className="text-white">{g.materialName}:</strong>{' '}
                      <span className="text-emerald-300 font-mono">{g.full} Llenos</span> ·{' '}
                      <span className="text-rose-300 font-mono">{g.empty} Vacíos</span>
                      {g.withContractors > 0 && (
                        <span className="text-amber-300 font-mono"> · {g.withContractors} en obra</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ZONA 2: MATRIZ MULTI-RENGLÓN DE TUBOS */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/40 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Renglones del Remito ({lines.length})</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={applyPresetMixed}
                    className="px-2 py-1 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-500/50 text-sky-200 font-bold text-[10px] cursor-pointer transition-colors"
                    title="Carga plantilla de remito mixto: Devolver tubos + Recibir otros"
                  >
                    🚚 Plantilla: Devolver + Pedir
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetInitial}
                    className="px-2 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-bold text-[10px] cursor-pointer transition-colors"
                    title="Cargar saldo físico inicial en patio"
                  >
                    📦 Plantilla: Saldo Inicial
                  </button>
                  {onCreateQuickGas && (
                    <button
                      type="button"
                      onClick={() => setShowQuickGasForm((v) => !v)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[10px] cursor-pointer flex items-center gap-1"
                      title="Si falta un tipo de gas (ej: CO2, Argón) crealo en segundos"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>+ Alta Tipo de Gas</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        createLine('INGRESO_PROVEEDOR', sortedGasMaterials[0]?.id || '')
                      ])
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Agregar Renglón</span>
                  </button>
                </div>
              </div>

              {showQuickGasForm && (
                <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-200">
                    Nuevo Gas en Catálogo (Stock inicial 0):
                  </span>
                  <input
                    type="text"
                    value={quickGasName}
                    onChange={(e) => setQuickGasName(e.target.value.toUpperCase())}
                    placeholder="Ej: GAS CO2 TUBO o GAS ARGON TUBO"
                    className="flex-1 min-w-[200px] px-2.5 py-1 rounded bg-slate-950 border border-amber-500/50 text-white uppercase focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateGas}
                    disabled={!quickGasName.trim() || creatingGas}
                    className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer disabled:opacity-50"
                  >
                    {creatingGas ? 'Creando...' : 'Crear Gas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickGasForm(false)}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {lines.map((line, idx) => {
                  const isReturn = line.operationType === 'DEVOLUCION_PROVEEDOR'
                  return (
                    <div
                      key={line.rowKey}
                      className={`p-2.5 rounded-xl border grid grid-cols-1 md:grid-cols-12 gap-2 items-center ${
                        isReturn
                          ? 'bg-rose-950/20 border-rose-500/40'
                          : 'bg-emerald-950/20 border-emerald-500/40'
                      }`}
                    >
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                          #{idx + 1} · Tipo de Movimiento
                        </label>
                        <select
                          value={line.operationType}
                          onChange={(e) => updateLine(line.rowKey, { operationType: e.target.value })}
                          className={`w-full px-2 py-1.5 rounded-lg bg-slate-950 border font-bold focus:outline-none focus:border-cyan-400 ${
                            isReturn
                              ? 'border-rose-500/60 text-rose-200'
                              : 'border-emerald-500/60 text-emerald-200'
                          }`}
                        >
                          {GAS_SUPPLIER_OPERATION_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.value === 'DEVOLUCION_PROVEEDOR' ? '📤 ' : opt.value === 'INGRESO_PROVEEDOR' ? '📥 ' : '📦 '}
                              {opt.shortLabel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                          Tipo de Gas <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={line.materialId}
                          onChange={(e) => updateLine(line.rowKey, { materialId: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
                        >
                          <option value="">Seleccionar Gas...</option>
                          {sortedGasMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                          Estado Envase
                        </label>
                        <select
                          value={line.condition}
                          onChange={(e) => updateLine(line.rowKey, { condition: e.target.value })}
                          className={`w-full px-2 py-1.5 rounded-lg bg-slate-950 border font-black focus:outline-none focus:border-cyan-400 ${
                            line.condition === 'VACIO'
                              ? 'border-rose-500/60 text-rose-300'
                              : 'border-emerald-500/60 text-emerald-300'
                          }`}
                        >
                          <option value="VACIO">VACÍO</option>
                          <option value="LLENO">LLENO</option>
                        </select>
                      </div>

                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                          Cant.
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.rowKey, { quantity: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-black text-center focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="md:col-span-1 flex items-end justify-end pt-3 md:pt-4">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((item) => item.rowKey !== line.rowKey))}
                          disabled={lines.length === 1}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Quitar renglón"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ZONA 3: OBSERVACIONES Y VISTA PREVIA DE IMPACTO */}
            <div className="p-3 rounded-xl bg-slate-900/70 border border-indigo-500/35 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">
                    Observaciones / Motivo del Remito
                  </label>
                  <input
                    type="text"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Ej: Camión semanal Air Liquide, entrega vacíos y recarga CO2..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase text-indigo-300">
                    Resumen del movimiento en Patio:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {impactPreview.length === 0 ? (
                      <span className="text-[11px] text-slate-500">Completá gas y cantidad para ver el impacto.</span>
                    ) : (
                      impactPreview.map((p) => (
                        <span
                          key={p.key}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${
                            p.isOut
                              ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                          }`}
                        >
                          {p.isOut ? (
                            <ArrowUpRight className="w-3 h-3 text-rose-400" />
                          ) : (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                          )}
                          <span className="font-mono">{p.label}</span>
                          <span className="text-slate-300">· {p.name}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Nota: Este registro actualiza exclusivamente la trazabilidad de envases en Control de Gases (el stock general del Catálogo de Materiales continúa ingresando por Compras).
              </p>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || impactPreview.length === 0}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : `Confirmar Movimiento (${lines.length} renglón${lines.length === 1 ? '' : 'es'})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
