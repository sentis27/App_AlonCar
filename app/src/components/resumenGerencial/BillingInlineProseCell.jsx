import React, { useEffect, useRef, useState } from 'react'

const FONT_SIZES = [10, 11, 12, 13, 14]

function sanitizeSimpleProseHtml(raw = '') {
  const str = String(raw ?? '')
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
}

/**
 * Celda de prosa editable 100% In-Situ al hacer doble clic:
 * - Sin popup externo ni campos separados de título/subtítulos.
 * - Barra flotante mínima: Negrita (B), Subrayado (U) y Tamaño de letra (A- / A+), siempre misma fuente.
 * - Al salir (`onBlur`) o cambiar de barco (`registerFlush`), sella y persiste directo al ID bloqueado.
 */
export default function BillingInlineProseCell({
  blockId,
  shipId,
  htmlValue = '',
  fontSizePx = 12,
  placeholder = 'Doble clic para redactar en prosa...',
  autoFocus = false,
  onCommit,
  registerFlush
}) {
  const [editing, setEditing] = useState(Boolean(autoFocus))
  const [currentSize, setCurrentSize] = useState(Number(fontSizePx) || 12)
  const editorRef = useRef(null)
  const lockedRef = useRef({ shipId, blockId, initialHtml: htmlValue })

  useEffect(() => {
    setCurrentSize(Number(fontSizePx) || 12)
  }, [fontSizePx])

  useEffect(() => {
    if (editing && editorRef.current) {
      lockedRef.current = { shipId, blockId, initialHtml: htmlValue }
      editorRef.current.innerHTML = sanitizeSimpleProseHtml(htmlValue || '')
      editorRef.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const commitCurrent = () => {
    if (!editing || !editorRef.current) return
    const nextHtml = sanitizeSimpleProseHtml(editorRef.current.innerHTML).trim()
    const locked = lockedRef.current
    setEditing(false)
    if (nextHtml !== sanitizeSimpleProseHtml(locked.initialHtml).trim() || currentSize !== (Number(fontSizePx) || 12)) {
      onCommit?.({
        shipId: locked.shipId,
        blockId: locked.blockId,
        nextHtml,
        fontSizePx: currentSize
      })
    }
  }

  useEffect(() => {
    if (!editing || !registerFlush) return undefined
    return registerFlush(() => commitCurrent())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, currentSize])

  const applyFormat = (e, cmd) => {
    e.preventDefault()
    e.stopPropagation()
    document.execCommand(cmd, false, null)
    editorRef.current?.focus()
  }

  const stepFontSize = (e, delta) => {
    e.preventDefault()
    e.stopPropagation()
    const idx = FONT_SIZES.indexOf(currentSize)
    const baseIdx = idx === -1 ? 2 : idx
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, baseIdx + delta))
    const nextSize = FONT_SIZES[nextIdx]
    setCurrentSize(nextSize)
    editorRef.current?.focus()
  }

  if (editing) {
    return (
      <div className="relative pt-1">
        {/* Barra mínima flotante: Negrita, Subrayado y Tamaño de letra */}
        <div
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mb-1 rounded-md bg-white border border-sky-400 shadow-md text-slate-800 select-none"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onMouseDown={(e) => applyFormat(e, 'bold')}
            className="px-1.5 py-0.5 rounded hover:bg-slate-200 font-black text-xs cursor-pointer"
            title="Negrita (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => applyFormat(e, 'underline')}
            className="px-1.5 py-0.5 rounded hover:bg-slate-200 underline font-semibold text-xs cursor-pointer"
            title="Subrayado (Ctrl+U)"
          >
            U
          </button>
          <span className="w-px h-3.5 bg-slate-300 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => stepFontSize(e, -1)}
            className="px-1 py-0.5 rounded hover:bg-slate-200 text-[11px] font-bold cursor-pointer"
            title="Achicar letra"
          >
            A-
          </button>
          <span className="text-[10px] font-mono text-slate-600 px-0.5">{currentSize}px</span>
          <button
            type="button"
            onMouseDown={(e) => stepFontSize(e, 1)}
            className="px-1 py-0.5 rounded hover:bg-slate-200 text-[11px] font-bold cursor-pointer"
            title="Agrandar letra"
          >
            A+
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={() => commitCurrent()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              commitCurrent()
            }
          }}
          style={{ fontSize: `${currentSize}px`, lineHeight: 1.4 }}
          className="w-full min-h-[54px] p-2 rounded-md bg-white text-slate-950 border-2 border-sky-500 shadow-inner outline-none whitespace-pre-wrap break-words font-sans"
        />
      </div>
    )
  }

  const hasContent = Boolean(String(htmlValue || '').replace(/<[^>]+>/g, '').trim())

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      style={{ fontSize: `${currentSize}px`, lineHeight: 1.4 }}
      title="Doble clic para editar en prosa (Negrita, Subrayado y Tamaño)"
      className="w-full min-h-[34px] py-1 px-1 rounded cursor-text hover:bg-sky-50/80 transition-colors text-slate-950 whitespace-pre-wrap break-words font-sans"
    >
      {hasContent ? (
        <div dangerouslySetInnerHTML={{ __html: sanitizeSimpleProseHtml(htmlValue) }} />
      ) : (
        <span className="text-slate-400 italic text-xs">{placeholder}</span>
      )}
    </div>
  )
}
