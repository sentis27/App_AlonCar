import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Star, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { WorkOrderScopeHoverCard } from './WorkOrderScopeHoverCard.jsx'

/**
 * Selector Canónico Estandarizado de Orden de Trabajo con Previsualización Hover.
 * 
 * Reemplaza los menús select estándar con cadenas grotescas horizontales.
 * Muestra una lista limpia y compacta: [OT-X] Título de la OT (+ badge asignada / N tareas).
 * Al pasar el mouse (hover) o al tener una OT seleccionada, despliega la tarjeta canónica
 * idéntica a la vista de planilla (Imagen 2) con tareas finalizadas tachadas (❌) y activas en verde.
 */
export function WorkOrderSelectorWithHover({
  value = '',
  onChange,
  availableWos = [],
  ship = null,
  workItems = [],
  allWorkOrders = [],
  contractorName = '',
  disabled = false,
  isSinOt = false,
  placeholder = '-- Seleccionar OT --',
  showPreviewCard = true,
  onHoverChange = null,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredWo, setHoveredWo] = useState(null)
  const [showFinalized, setShowFinalized] = useState(false)
  const containerRef = useRef(null)

  const handleSetHovered = (wo) => {
    setHoveredWo(wo)
    if (typeof onHoverChange === 'function') {
      onHoverChange(wo)
    }
  }

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        handleSetHovered(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Buscar la OT actualmente seleccionada
  const selectedWo = useMemo(() => {
    if (!value || isSinOt) return null
    return (
      availableWos.find((w) => String(w.id) === String(value)) ||
      allWorkOrders.find((w) => String(w.id) === String(value)) ||
      null
    )
  }, [value, isSinOt, availableWos, allWorkOrders])

  // Contratista set para matching
  const normContractor = String(contractorName || '').trim().toUpperCase()

  // Separar OTs activas vs finalizadas
  const { activeList, finalizedList } = useMemo(() => {
    const active = []
    const finalized = []
    availableWos.forEach((w) => {
      if (w.isActiveForImputation === false) {
        finalized.push(w)
      } else {
        active.push(w)
      }
    })
    return { activeList: active, finalizedList: finalized }
  }, [availableWos])

  const displayedList = showFinalized ? [...activeList, ...finalizedList] : activeList

  // La OT a mostrar en la tarjeta de previsualización
  const activePreviewWo = hoveredWo || selectedWo

  const selectedOtNum = selectedWo?.ot_number || (selectedWo?.id ? String(selectedWo.id).slice(0, 4) : '')
  const selectedOtTitle = selectedWo?.title || selectedWo?.description || ''

  return (
    <div ref={containerRef} className={`relative space-y-2 ${className}`}>
      {/* Botón Gatillo / Selector */}
      <button
        type="button"
        disabled={disabled || isSinOt}
        onClick={() => !disabled && !isSinOt && setIsOpen((prev) => !prev)}
        className={`w-full px-2.5 py-1.5 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
          disabled || isSinOt
            ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
            : isOpen
            ? 'bg-slate-900 border-cyan-400 text-white shadow-md shadow-cyan-950/20'
            : selectedWo
            ? 'bg-slate-900 border-slate-700 text-white font-semibold hover:border-slate-600'
            : 'bg-slate-900 border-slate-700 text-amber-300 font-bold hover:border-slate-600'
        }`}
      >
        <span className="truncate">
          {isSinOt
            ? '(⚠️ Sin OT)'
            : selectedWo
            ? `OT #${selectedOtNum}: ${selectedOtTitle}`
            : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-cyan-400' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable con Hover Preview */}
      {isOpen && !disabled && !isSinOt && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden p-1 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          {/* Opción (⚠️ Sin OT) */}
          <button
            type="button"
            onClick={() => {
              onChange('')
              setIsOpen(false)
              handleSetHovered(null)
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-300 hover:bg-amber-950/40 border border-transparent hover:border-amber-600/40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>(⚠️ Sin OT / Dejar en blanco)</span>
          </button>

          {/* Lista de OTs */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
            {displayedList.map((wo) => {
              const otNum = wo.ot_number || (wo.id ? String(wo.id).slice(0, 4) : 'OT')
              const otTitle = wo.title || wo.description || 'Sin título'
              const isSelected = String(wo.id) === String(value)
              const isHovered = hoveredWo?.id === wo.id
              const isClosed = wo.isActiveForImputation === false

              // Coincidencia con contratista
              const isContractorMatch = normContractor
                ? (wo.consolidatedTasks || []).some((t) =>
                    (t.contractors || []).some((c) => String(c).trim().toUpperCase() === normContractor)
                  )
                : false

              return (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => {
                    onChange(wo.id)
                    setIsOpen(false)
                    handleSetHovered(null)
                  }}
                  onMouseEnter={() => handleSetHovered(wo)}
                  onMouseLeave={() => handleSetHovered(null)}
                  className={`w-full text-left p-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-400 text-white font-bold shadow-sm'
                      : isHovered
                      ? 'bg-slate-800 border-cyan-400 text-cyan-200'
                      : isClosed
                      ? 'bg-slate-900/30 border-slate-800 text-slate-500 opacity-60'
                      : 'bg-slate-900/70 border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                        isSelected
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                          : 'bg-slate-950 text-slate-400 border-slate-700'
                      }`}
                    >
                      OT #{otNum}
                    </span>
                    <span className="font-semibold text-xs truncate">{otTitle}</span>
                    {isContractorMatch && (
                      <span className="text-[9px] text-amber-300 font-bold flex items-center gap-0.5 shrink-0 bg-amber-950/70 px-1 py-0.2 rounded border border-amber-600/60">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span>Asignada</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isClosed ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 text-slate-500 border border-slate-800 font-bold">
                        Finalizada
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                        {wo.consolidatedTasks?.length || 0} tareas
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                </button>
              )
            })}

            {displayedList.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                No hay OTs activas habilitadas para este buque y contratista.
              </div>
            )}
          </div>

          {/* Toggle para ver finalizadas si existen */}
          {finalizedList.length > 0 && (
            <div className="pt-1 border-t border-slate-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFinalized(!showFinalized)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-900 cursor-pointer"
              >
                {showFinalized ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>
                  {showFinalized ? 'Ocultar finalizadas' : `Ver finalizadas (${finalizedList.length})`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta Canónica Hover / Seleccionada (Imagen 2) */}
      {showPreviewCard && activePreviewWo && !isSinOt && (
        <WorkOrderScopeHoverCard
          wo={activePreviewWo}
          ship={ship}
          workItems={workItems}
          allWorkOrders={allWorkOrders}
          contractorFilter={contractorName}
          isHoverPreview={Boolean(hoveredWo && hoveredWo.id !== value)}
        />
      )}
    </div>
  )
}
export default WorkOrderSelectorWithHover
