import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Package, Flame, X, ZoomIn } from 'lucide-react'
import { isGasMaterial } from '../../lib/panolConstants'

/**
 * MaterialThumbnailZoom.jsx
 * Miniatura cuadrada de imagen del material para renglones de carga (Pañol / Canasta).
 * Al hacer clic amplía la imagen en un visor flotante de 5cm × 5cm (cerrable con clic o Escape).
 */
export default function MaterialThumbnailZoom({ material = null, size = 'md' }) {
  const [isZoomed, setIsZoomed] = useState(false)
  const isGas = isGasMaterial(material)
  const boxSizeCls = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  const hasImage = Boolean(material?.image_url)

  useEffect(() => {
    if (!isZoomed) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsZoomed(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isZoomed])

  if (!hasImage) {
    return (
      <div
        className={`${boxSizeCls} rounded-lg border flex items-center justify-center shrink-0 select-none ${
          isGas
            ? 'bg-amber-950/50 border-amber-500/40 text-amber-400'
            : 'bg-slate-950 border-slate-800 text-slate-600'
        }`}
        title={
          material
            ? `${material.name} — Sin foto cargada en el Catálogo`
            : 'Miniatura del material (se muestra al elegir un insumo)'
        }
      >
        {isGas ? <Flame className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation()
          setIsZoomed(true)
        }}
        className={`group relative ${boxSizeCls} rounded-lg overflow-hidden border border-slate-700 hover:border-cyan-400 bg-slate-950 shrink-0 cursor-zoom-in transition-all shadow-sm`}
        title={`Clic para ampliar foto (5 cm × 5 cm) — ${material.name}`}
      >
        <img
          src={material.image_url}
          alt={material.name || 'Material'}
          className="w-full h-full object-cover"
        />
        <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="w-3.5 h-3.5 text-cyan-300" />
        </span>
      </button>

      {isZoomed &&
        createPortal(
          <div
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4 cursor-pointer font-sans"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-cyan-500/60 rounded-2xl p-3 shadow-2xl shadow-black/80 flex flex-col items-center gap-2 cursor-default"
            >
              <div className="w-full flex items-center justify-between gap-2 max-w-[5cm]">
                <span className="text-[10px] font-black text-white uppercase truncate" title={material.name}>
                  {material.name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsZoomed(false)}
                  className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 cursor-pointer shrink-0"
                  title="Cerrar vista previa (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div
                style={{ width: '5cm', height: '5cm' }}
                className="rounded-xl overflow-hidden bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0"
              >
                <img
                  src={material.image_url}
                  alt={material.name || 'Material'}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[9px] font-mono text-slate-400">
                Vista 5 cm × 5 cm · Clic afuera o Esc para cerrar
              </span>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
