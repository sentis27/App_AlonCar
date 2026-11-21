import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users,
  UserCheck,
  HardHat,
  Search,
  Check,
  FilePlus,
  UserPlus,
  Building2
} from 'lucide-react'
import { PICKER_CONTRACTOR_STEP_HELP } from '../lib/businessHelpRegistry.js'
import { CanonicalStepperModal, CanonicalStepperStep } from './canonical/CanonicalStepperModal.jsx'

/**
 * ContractorPickerModal
 * Selector canónico Zero-Scroll (Stepper Vertical 1 ➔ 2) para asignar Operario o Contratista
 * por doble clic en Pañol, Horas, Terceros y Compras (contrato blindado FL-006).
 *
 * Reglas preservadas:
 * 1. Si la OT está en blanco (`isOtBlank`) o sin vinculados: muestra el padrón completo
 *    (`astilleroWorkers` + `contractorGroups`) para nunca bloquear la carga.
 * 2. Búsqueda instantánea por nombre, gremio o contratista + Enter confirma / Escape cierra.
 * 3. Acciones rápidas opcionales para solicitar apertura de OT o habilitación de operario.
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
    if (!isOpen) return
    setSelectedName(currentValue || '')
    setQuery('')
    setFilterTab('ALL')
    const timer = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen, currentValue])

  const q = query.trim().toLowerCase()

  const filteredAstillero = useMemo(() => {
    if (!q) return astilleroWorkers
    return astilleroWorkers.filter((w) =>
      (w.name || '').toLowerCase().includes(q) || (w.trade || '').toLowerCase().includes(q)
    )
  }, [astilleroWorkers, q])

  const filteredContractors = useMemo(() => {
    if (!q) return contractorGroups
    return contractorGroups.filter((grp) => (grp || '').toLowerCase().includes(q))
  }, [contractorGroups, q])

  const filteredExtraOptions = useMemo(() => {
    if (!Array.isArray(extraOptions) || extraOptions.length === 0) return []
    if (!q) return extraOptions
    return extraOptions.filter((opt) => {
      const name = typeof opt === 'string' ? opt : opt.name || ''
      const label = typeof opt === 'string' ? opt : opt.label || ''
      return name.toLowerCase().includes(q) || label.toLowerCase().includes(q)
    })
  }, [extraOptions, q])

  const flatVisibleList = useMemo(() => {
    const list = []
    filteredExtraOptions.forEach((opt) => {
      list.push({ type: 'extra', name: typeof opt === 'string' ? opt : opt.name })
    })
    if (filterTab === 'ALL' || filterTab === 'ASTILLERO') {
      filteredAstillero.forEach((w) => list.push({ type: 'astillero', name: w.name }))
    }
    if (filterTab === 'ALL' || filterTab === 'CONTRATISTAS') {
      filteredContractors.forEach((c) => list.push({ type: 'contratista', name: c }))
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

  const showCurrentOrphan =
    Boolean(selectedName) &&
    !filteredAstillero.some((w) => w.name === selectedName) &&
    !filteredContractors.some((c) => c === selectedName) &&
    !filteredExtraOptions.some((o) => (typeof o === 'string' ? o : o.name) === selectedName)

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      icon={
        <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-300">
          <Users className="w-4 h-4" />
        </div>
      }
      title={title}
      subtitle={`${shipName || 'Destino general'} • ${isOtBlank || !workOrderTitle ? '⚠️ Orden en Blanco (Padrón Completo)' : `OT: ${workOrderTitle}`}`}
      footerLeft={
        <>
          {onRequestOt && (
            <button
              type="button"
              onClick={() => { onClose(); onRequestOt() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 text-rose-300 text-xs font-bold transition-all cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 text-rose-400" />
              <span>Pedir Apertura OT</span>
            </button>
          )}
          {onRequestWorkerPermission && (
            <button
              type="button"
              onClick={() => { onClose(); onRequestWorkerPermission() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Habilitar Operario</span>
            </button>
          )}
        </>
      }
      footerRight={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
        >
          Cerrar (Esc)
        </button>
      }
    >
      <CanonicalStepperStep
        step={1}
        helpEntry={PICKER_CONTRACTOR_STEP_HELP[1]}
        title="BUSCAR Y FILTRAR PADRÓN"
        subtitle="Escribí y presioná Enter para asignar rápido"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-2" />
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
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder-slate-500 font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-cyan-950 border border-cyan-500 text-cyan-300'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos ({filteredAstillero.length + filteredContractors.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ASTILLERO')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'ASTILLERO'
                  ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ⭐ Astillero ({filteredAstillero.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('CONTRATISTAS')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'CONTRATISTAS'
                  ? 'bg-indigo-950 border border-indigo-500 text-indigo-300'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              🏗️ Contratistas ({filteredContractors.length})
            </button>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={PICKER_CONTRACTOR_STEP_HELP[2]}
        title="OPERARIOS Y CONTRATISTAS HABILITADOS"
        subtitle="Clic directo sobre la persona o taller para aplicar"
        isLast={true}
      >
        <div className="max-h-[44vh] overflow-y-auto pr-1 space-y-3">
          {showCurrentOrphan && (
            <button
              type="button"
              onClick={() => handleConfirm(selectedName)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-cyan-950/60 border border-cyan-500/60 text-white font-bold text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>{selectedName}</span>
                <span className="text-[9px] text-cyan-300/80 bg-cyan-900/60 px-1.5 py-0.5 rounded font-normal">Actual en fila</span>
              </div>
              <Check className="w-4 h-4 text-cyan-400" />
            </button>
          )}

          {filteredExtraOptions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-black text-amber-400 tracking-wider px-1">
                🏢 Central / Áreas Comunes
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filteredExtraOptions.map((opt) => {
                  const optName = typeof opt === 'string' ? opt : opt.name
                  const optLabel = typeof opt === 'string' ? opt : opt.label || opt.name
                  const isSelected = selectedName === optName
                  return (
                    <button
                      key={`extra_${optName}`}
                      type="button"
                      onClick={() => handleConfirm(optName)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-950/80 border-amber-500 text-white font-bold'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-amber-300 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-bold truncate">{optLabel}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(filterTab === 'ALL' || filterTab === 'ASTILLERO') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-black text-emerald-400 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Personal Propio Astillero ({filteredAstillero.length})</span>
                </span>
                <span className="font-normal text-slate-500 normal-case">Habilitados</span>
              </div>
              {filteredAstillero.length === 0 ? (
                <p className="text-slate-500 text-[11px] italic px-2 py-1">Sin coincidencias en personal propio.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredAstillero.map((w) => {
                    const isSelected = selectedName === w.name
                    return (
                      <button
                        key={`ast_${w.id || w.name}`}
                        type="button"
                        onClick={() => handleConfirm(w.name)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                            : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-200 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-semibold truncate">{w.name}</span>
                          {w.trade && (
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                              {w.trade}
                            </span>
                          )}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(filterTab === 'ALL' || filterTab === 'CONTRATISTAS') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-black text-indigo-400 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Contratistas y Talleres Externos ({filteredContractors.length})</span>
                </span>
                <span className="font-normal text-slate-500 normal-case">Rubros autorizados</span>
              </div>
              {filteredContractors.length === 0 ? (
                <p className="text-slate-500 text-[11px] italic px-2 py-1">Sin coincidencias en contratistas.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredContractors.map((grp) => {
                    const isSelected = selectedName === grp
                    return (
                      <button
                        key={`cnt_${grp}`}
                        type="button"
                        onClick={() => handleConfirm(grp)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-950/80 border-indigo-500 text-white font-bold'
                            : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-200 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                          <span className="font-semibold truncate">{grp}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
