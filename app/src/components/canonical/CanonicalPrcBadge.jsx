/**
 * CanonicalPrcBadge.jsx
 * Pieza Visual Única (Capa 3 · SKL-019): Check / badge de PRC oficial con ventana flotante
 * mostrando el número asignado (#2000+), estado (ACTIVO/TERMINADO/ANULADO) y adicionales.
 */
import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Ban, CheckCircle2, FileSpreadsheet, GitBranchPlus, Lock } from 'lucide-react'
import HighlightText from '../HighlightText'
import { formatDateAr } from '../../lib/dateTimeCanonical'
import { formatPrcAdditionalLabel, formatPrcNumberLabel } from '../../lib/prcRegistryRules'

function computePopoverCoords(rect) {
  const width = 340
  const estHeight = 230
  const margin = 12
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = rect.left
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin)
  if (left < margin) left = margin

  const spaceBelow = vh - rect.bottom - margin
  const openUp = spaceBelow < estHeight && rect.top > estHeight
  return openUp
    ? { position: 'fixed', left, bottom: Math.max(margin, vh - rect.top + 8), width, zIndex: 9999 }
    : { position: 'fixed', left, top: Math.min(vh - margin - 80, rect.bottom + 8), width, zIndex: 9999 }
}

export default function CanonicalPrcBadge({
  prc = null,
  additionals = [],
  legacyNumber = '',
  variant = 'check', // 'check' (Unificado) | 'pill' (Terceros)
  searchQuery = '',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState(null)
  const anchorRef = useRef(null)

  if (!prc && !legacyNumber) return null

  const isAnnulled = prc?.status === 'ANULADO'
  const isTerminated = prc?.status === 'TERMINADO'
  const displayNum = prc ? formatPrcNumberLabel(prc.prc_number) : `PRC ${legacyNumber}`

  const openPopover = () => {
    if (!anchorRef.current) return
    setCoords(computePopoverCoords(anchorRef.current.getBoundingClientRect()))
    setIsOpen(true)
  }

  const handleTogglePin = (e) => {
    e.stopPropagation()
    if (!isOpen || !pinned) {
      openPopover()
      setPinned(true)
    } else {
      setPinned(false)
      setIsOpen(false)
    }
  }

  const chipColor = isAnnulled
    ? 'bg-rose-950/90 text-rose-300 border-rose-500/60 line-through'
    : isTerminated
    ? 'bg-emerald-950/85 text-emerald-300 border-emerald-500/60'
    : prc
    ? 'bg-amber-950/90 text-amber-300 border-amber-500/60'
    : 'bg-slate-900 text-amber-300 border-amber-700/60'

  const showFloating = (isOpen || pinned) && Boolean(coords) && typeof document !== 'undefined'

  return (
    <span
      ref={anchorRef}
      onMouseEnter={openPopover}
      onMouseLeave={() => { if (!pinned) setIsOpen(false) }}
      onClick={handleTogglePin}
      className={`inline-flex items-center cursor-help ${className}`.trim()}
      title={prc ? `${displayNum} (${prc.status}) — Apoyá o hacé clic para ver detalle` : `Presupuesto legado ${legacyNumber}`}
    >
      {variant === 'check' ? (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border text-[9px] font-black leading-tight ${chipColor}`}>
          {isAnnulled ? <Ban className="w-2.5 h-2.5 shrink-0" /> : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
          <span>PRC</span>
        </span>
      ) : (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold leading-tight ${chipColor}`}>
          {isAnnulled ? <Ban className="w-3 h-3 shrink-0" /> : prc ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <FileSpreadsheet className="w-3 h-3 shrink-0" />}
          <span><HighlightText text={displayNum} query={searchQuery} /></span>
          {additionals.length > 0 && (
            <span className="text-[9px] px-1 rounded bg-purple-950 text-purple-300 border border-purple-500/50 font-sans">
              +{additionals.length}
            </span>
          )}
        </span>
      )}

      {showFloating && createPortal(
        <div
          style={coords}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => { if (!pinned) setIsOpen(false) }}
          className="pointer-events-auto rounded-2xl bg-slate-900/98 border border-amber-500/50 shadow-2xl p-3.5 text-xs text-slate-200 font-sans space-y-2 backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md font-mono font-black text-xs border ${chipColor}`}>
                {displayNum}
              </span>
              {prc ? (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${isAnnulled ? 'bg-rose-950 text-rose-300 border-rose-500/60' : isTerminated ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' : 'bg-amber-950 text-amber-300 border-amber-500/50'}`}>
                  {prc.status}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">REFERENCIA LEGADA</span>
              )}
            </div>
            {prc?.issue_date && <span className="text-[10px] font-mono text-slate-400">{formatDateAr(prc.issue_date)}</span>}
          </div>

          {prc ? (
            <div className="space-y-1.5 text-[11px]">
              {prc.parent_prc_number && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40 font-bold text-[10px]">
                  <GitBranchPlus className="w-3 h-3" />
                  <span>{formatPrcAdditionalLabel(prc)}</span>
                </div>
              )}
              <div><span className="text-slate-500">Contratista:</span> <strong className="text-white">{prc.contractor_name}</strong></div>
              <div>
                <span className="text-slate-500">Importe:</span>{' '}
                <strong className="font-mono text-emerald-300">AR$ {Number(prc.amount_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                {Number(prc.amount_usd || 0) > 0 && <span className="text-slate-400 font-mono"> · US$ {Number(prc.amount_usd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
              </div>
              {prc.description && <div className="text-slate-300 line-clamp-2">{prc.description}</div>}
              {isAnnulled && prc.annulled_reason && (
                <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-200 text-[10px] font-semibold">
                  Motivo de anulación: {prc.annulled_reason}
                </div>
              )}
              {additionals.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Adicionales:</span>
                  {additionals.map((ad) => (
                    <span key={ad.id} className={`px-1.5 py-0.2 rounded font-mono text-[10px] border ${ad.status === 'ANULADO' ? 'bg-rose-950 text-rose-300 border-rose-600/50 line-through' : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'}`}>
                      #{ad.prc_number}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Comprobante con número anterior al registro digital (#2000+).</p>
          )}

          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500">
            <span className="inline-flex items-center gap-1"><Lock className="w-2.5 h-2.5 text-amber-400" /> Base de datos oficial de PRC</span>
            {pinned && <button type="button" onClick={() => { setPinned(false); setIsOpen(false) }} className="text-cyan-300 font-bold cursor-pointer">Cerrar</button>}
          </div>
        </div>,
        document.body
      )}
    </span>
  )
}
