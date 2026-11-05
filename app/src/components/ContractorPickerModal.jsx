import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users,
  UserCheck,
  HardHat,
  Search,
  Check,
  X,
  AlertTriangle,
  FilePlus,
  UserPlus,
  Building2,
  Anchor,
  Filter
} from 'lucide-react'

/**
 * ContractorPickerModal
 * 
 * Modal estandarizado y canónico para seleccionar Operario o Contratista.
 * 
 * Reglas de Negocio aprobadas:
 * 1. Si la OT está en blanco (!workOrderId): Abre el padrón COMPLETO de operarios y contratistas
 *    habilitados para retirar materiales.
 * 2. Si hay una OT seleccionada: Muestra los operarios y contratistas asignados a esa OT/buque.
 *    Si no hay ninguno vinculado, aplica fallback automático al padrón completo para nunca bloquear la carga.
 * 3. Búsqueda instantánea en vivo por nombre, gremio o empresa.
 * 4. Atajos de teclado: Escape cierra, Enter selecciona, flechas arriba/abajo navegan.
 * 5. Acciones rápidas para solicitar apertura de OT o habilitación de operario.
 */
export default function ContractorPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentValue = '',
  shipName = '',
  workOrderTitle = '',
  isOtBlank = false,
  astilleroWorkers = [],
  contractorGroups = [],
  extraOptions = [],
  onRequestOt,
  onRequestWorkerPermission,
  title = 'Seleccionar Operario o Contratista'
}) {
  const [query, setQuery] = useState('')
  const [filterTab, setFilterTab] = useState('ALL') // 'ALL' | 'ASTILLERO' | 'CONTRATISTAS'
  const [selectedName, setSelectedName] = useState(currentValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedName(currentValue || '')
      setQuery('')
      setFilterTab('ALL')
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus()
      }, 50)
    }
  }, [isOpen, currentValue])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Normalizar búsqueda
  const q = query.trim().toLowerCase()

  // Filtrado de trabajadores de Astillero
  const filteredAstillero = useMemo(() => {
    if (!q) return astilleroWorkers
    return astilleroWorkers.filter((w) => {
      const nameMatch = (w.name || '').toLowerCase().includes(q)
      const tradeMatch = (w.trade || '').toLowerCase().includes(q)
      return nameMatch || tradeMatch
    })
  }, [astilleroWorkers, q])

  // Filtrado de Contratistas
  const filteredContractors = useMemo(() => {
    if (!q) return contractorGroups
    return contractorGroups.filter((grp) => {
      return (grp || '').toLowerCase().includes(q)
    })
  }, [contractorGroups, q])

  // Filtrado de Opciones Especiales / Áreas
  const filteredExtraOptions = useMemo(() => {
    if (!Array.isArray(extraOptions) || extraOptions.length === 0) return []
    if (!q) return extraOptions
    return extraOptions.filter((opt) => {
      const name = typeof opt === 'string' ? opt : opt.name || ''
      const label = typeof opt === 'string' ? opt : opt.label || ''
      return name.toLowerCase().includes(q) || label.toLowerCase().includes(q)
    })
  }, [extraOptions, q])

  // Lista unificada para selección por Enter
  const flatVisibleList = useMemo(() => {
    const list = []
    filteredExtraOptions.forEach((opt) => {
      const name = typeof opt === 'string' ? opt : opt.name
      list.push({ type: 'extra', name, extra: 'Área / Central' })
    })
    if (filterTab === 'ALL' || filterTab === 'ASTILLERO') {
      filteredAstillero.forEach((w) => list.push({ type: 'astillero', name: w.name, extra: w.trade }))
    }
    if (filterTab === 'ALL' || filterTab === 'CONTRATISTAS') {
      filteredContractors.forEach((c) => list.push({ type: 'contratista', name: c, extra: 'Contratista' }))
    }
    return list
  }, [filterTab, filteredExtraOptions, filteredAstillero, filteredContractors])

  if (!isOpen) return null

  const handleConfirm = (nameToSelect) => {
    const finalVal = nameToSelect || selectedName
    if (!finalVal) return
    onSelect(finalVal)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-sans flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-wide">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {shipName ? (
                  <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold">
                    <Anchor className="w-3 h-3 text-cyan-400" /> {shipName}
                  </span>
                ) : (
                  <span>Destino general</span>
                )}
                <span className="mx-1.5 text-slate-600">•</span>
                {isOtBlank || !workOrderTitle ? (
                  <span className="text-amber-400 font-semibold">⚠️ Orden en Blanco (Padrón Completo)</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">OT: {workOrderTitle}</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Búsqueda y Filtros Rápidos */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/30 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (flatVisibleList.length > 0) {
                    const match = selectedName
                      ? flatVisibleList.find((i) => i.name === selectedName) || flatVisibleList[0]
                      : flatVisibleList[0]
                    handleConfirm(match.name)
                  }
                }
              }}
              placeholder="Buscar por nombre, gremio o contratista..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder-slate-500 font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
            />
          </div>

          {/* Tabs rápidas */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-cyan-950 border border-cyan-500 text-cyan-300 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos ({filteredAstillero.length + filteredContractors.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ASTILLERO')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterTab === 'ASTILLERO'
                  ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>⭐ Astillero</span>
              <span className="text-[10px] opacity-80">({filteredAstillero.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('CONTRATISTAS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterTab === 'CONTRATISTAS'
                  ? 'bg-indigo-950 border border-indigo-500 text-indigo-300 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>🏗️ Contratistas</span>
              <span className="text-[10px] opacity-80">({filteredContractors.length})</span>
            </button>
          </div>
        </div>

        {/* Cuerpo de Opciones */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs divide-y divide-slate-800/40">
          {/* Opción Actual si no figura en los listados */}
          {selectedName &&
            !filteredAstillero.some((w) => w.name === selectedName) &&
            !filteredContractors.some((c) => c === selectedName) && (
              <div className="pb-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                  Selección Actual
                </span>
                <button
                  type="button"
                  onClick={() => handleConfirm(selectedName)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/60 text-white font-bold text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>{selectedName}</span>
                    <span className="text-[9px] text-cyan-300/80 bg-cyan-900/60 px-1.5 py-0.2 rounded font-normal">
                      Actual en fila
                    </span>
                  </div>
                  <Check className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
            )}

          {/* Opciones Especiales / Pañol Central / Áreas */}
          {filteredExtraOptions.length > 0 && (
            <div className="pb-2">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">
                🏢 Central / Áreas Comunes
              </span>
              <div className="grid grid-cols-1 gap-1">
                {filteredExtraOptions.map((opt) => {
                  const optName = typeof opt === 'string' ? opt : opt.name
                  const optLabel = typeof opt === 'string' ? opt : opt.label || opt.name
                  const isSelected = selectedName === optName
                  return (
                    <button
                      key={`extra_${optName}`}
                      type="button"
                      onClick={() => handleConfirm(optName)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/80 border border-amber-500 text-white font-bold shadow-md ring-1 ring-amber-500/40'
                          : 'bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 text-amber-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold">{optLabel}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Grupo 1: Personal Propio de Astillero */}
          {(filterTab === 'ALL' || filterTab === 'ASTILLERO') && (
            <div className="pt-2 first:pt-0 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-black text-emerald-400 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Personal Propio Astillero ({filteredAstillero.length})</span>
                </span>
                <span className="text-[10px] font-normal text-slate-500 normal-case">Habilitados para Pañol</span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {filteredAstillero.map((w) => {
                  const isSelected = selectedName === w.name
                  return (
                    <button
                      key={`ast_${w.id || w.name}`}
                      type="button"
                      onClick={() => handleConfirm(w.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/80 border border-emerald-500 text-white font-bold shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="font-semibold truncate">{w.name}</span>
                        {w.trade && (
                          <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                            {w.trade}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  )
                })}
                {filteredAstillero.length === 0 && (
                  <p className="text-slate-500 text-[11px] italic px-2 py-1">Sin coincidencias en personal propio.</p>
                )}
              </div>
            </div>
          )}

          {/* Grupo 2: Contratistas Externos */}
          {(filterTab === 'ALL' || filterTab === 'CONTRATISTAS') && (
            <div className="pt-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-black text-indigo-400 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Contratistas y Talleres Externos ({filteredContractors.length})</span>
                </span>
                <span className="text-[10px] font-normal text-slate-500 normal-case">Rubros autorizados</span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {filteredContractors.map((grp) => {
                  const isSelected = selectedName === grp
                  return (
                    <button
                      key={`cnt_${grp}`}
                      type="button"
                      onClick={() => handleConfirm(grp)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/80 border border-indigo-500 text-white font-bold shadow-md ring-1 ring-indigo-500/40'
                          : 'bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                        <span className="font-semibold truncate">{grp}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </button>
                  )
                })}
                {filteredContractors.length === 0 && (
                  <p className="text-slate-500 text-[11px] italic px-2 py-1">Sin coincidencias en contratistas.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Acciones Especiales al Pie */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            {onRequestOt && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRequestOt()
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 text-rose-300 text-[11px] font-bold transition-all cursor-pointer"
              >
                <FilePlus className="w-3.5 h-3.5 text-rose-400" />
                <span>Pedir Apertura OT</span>
              </button>
            )}

            {onRequestWorkerPermission && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRequestWorkerPermission()
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 text-[11px] font-bold transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Habilitar Operario</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
            >
              Cerrar (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
