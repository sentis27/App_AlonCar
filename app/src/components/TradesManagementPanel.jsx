import { useState, useEffect, useMemo } from 'react'
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  HardHat,
  ArrowRight,
  RefreshCw,
  Check,
  Briefcase
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TradesManagementPanel() {
  const [workers, setWorkers] = useState([])
  const [masterTrades, setMasterTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState(null)

  // Modales
  const [newTradeName, setNewTradeName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [editingTrade, setEditingTrade] = useState(null)
  const [editedName, setEditedName] = useState('')

  const [deletingTrade, setDeletingTrade] = useState(null)
  const [reassignTrade, setReassignTrade] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  function showFeedback(type, text) {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function fetchData() {
    setLoading(true)
    try {
      // 1. Cargar workers para conteo de operarios por rubro
      const { data: workersData, error: workersErr } = await supabase
        .from('workers')
        .select('id, first_name, last_name, trade, admin_center, status')
      if (workersErr) throw workersErr
      setWorkers(workersData || [])

      // 2. Cargar catálogo de rubros maestros desde system_settings
      const { data: settingsData, error: settingsErr } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'master_trades')
        .maybeSingle()

      if (settingsErr) throw settingsErr

      // Extraer los rubros de los trabajadores existentes
      const tradesFromWorkers = new Set()
      ;(workersData || []).forEach(w => {
        if (w.trade) {
          String(w.trade).split(/[,;/|]+/).forEach(t => {
            const clean = t.trim().toUpperCase()
            if (clean) tradesFromTrades(tradesFromWorkers, clean)
          })
        }
      })

      // Rubros base canónicos indispensables del astillero
      const baseTrades = [
        'CALDERERIA', 'CARPINTERIA', 'PINTURA', 'FLETE', 'MECANICA', 
        'MATERIALES', 'TORNERIA', 'CORTE/PLEGADO', 'SERVICIOS', 'RASCHINAJE',
        'MISCELANEOS', 'ELECTRICIDAD', 'HIDRAULICA', 'FIBRA VIDRIO', 'FRIGORISTA',
        'GASISTA', 'PAÑOLERO', 'SERENO', 'SOLDADURA', 'TECNICOS'
      ]
      baseTrades.forEach(t => tradesFromWorkers.add(t))

      // Combinar con los guardados en base de datos
      const savedList = Array.isArray(settingsData?.value) ? settingsData.value : []
      savedList.forEach(t => {
        if (typeof t === 'string' && t.trim()) tradesFromWorkers.add(t.trim().toUpperCase())
      })

      const combined = Array.from(tradesFromWorkers).sort()
      setMasterTrades(combined)

      // Si no existía el registro en system_settings, persistirlo para inicializarlo
      if (!settingsData?.value) {
        await supabase
          .from('system_settings')
          .upsert({
            key: 'master_trades',
            value: combined,
            updated_at: new Date().toISOString(),
            updated_by: 'Administrador (Init)'
          }, { onConflict: 'key' })
      }
    } catch (err) {
      console.error('Error cargando rubros:', err)
      showFeedback('error', 'Error al cargar catálogo de rubros: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function tradesFromTrades(set, clean) {
    if (clean) set.add(clean)
  }

  // Métricas agregadas por rubro
  const tradeStats = useMemo(() => {
    const stats = new Map()

    masterTrades.forEach(trade => {
      stats.set(trade, {
        trade,
        total: 0,
        astillero: 0,
        contratista: 0,
        taller: 0,
        activos: 0
      })
    })

    workers.forEach(w => {
      const wTrade = (w.trade || '').trim().toUpperCase()
      if (stats.has(wTrade)) {
        const item = stats.get(wTrade)
        item.total += 1
        if (w.status === 'ACTIVO') item.activos += 1
        if (w.admin_center === 'ASTILLERO') item.astillero += 1
        else if (w.admin_center === 'CONTRATISTA') item.contratista += 1
        else if (w.admin_center === 'TALLER') item.taller += 1
      }
    })

    return Array.from(stats.values())
  }, [masterTrades, workers])

  // Filtrado para búsqueda rápida
  const filteredTradeStats = useMemo(() => {
    if (!searchTerm.trim()) return tradeStats
    const term = searchTerm.trim().toUpperCase()
    return tradeStats.filter(s => s.trade.includes(term))
  }, [tradeStats, searchTerm])

  // Resumen general
  const totalAssignedWorkers = useMemo(() => {
    return workers.filter(w => w.trade && w.trade.trim()).length
  }, [workers])

  const tradesWithZeroWorkers = useMemo(() => {
    return tradeStats.filter(s => s.total === 0).length
  }, [tradeStats])

  // ============================================================================
  // ACCIONES: CREAR, EDITAR (PROPAGACIÓN MASIVA) Y ELIMINAR (CON REASIGNACIÓN)
  // ============================================================================

  async function handleCreateTrade(e) {
    e?.preventDefault()
    const clean = newTradeName.trim().toUpperCase()

    if (!clean) {
      showFeedback('error', 'El nombre del rubro no puede estar vacío.')
      return
    }

    if (masterTrades.includes(clean)) {
      showFeedback('error', `El rubro "${clean}" ya existe en el catálogo.`)
      return
    }

    setSaving(true)
    try {
      const updatedList = Array.from(new Set([...masterTrades, clean])).sort()

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'master_trades',
          value: updatedList,
          updated_at: new Date().toISOString(),
          updated_by: 'Administrador'
        }, { onConflict: 'key' })

      if (error) throw error

      setMasterTrades(updatedList)
      setNewTradeName('')
      setShowCreateModal(false)
      showFeedback('success', `Rubro "${clean}" creado exitosamente en el catálogo maestro.`)
    } catch (err) {
      console.error('Error creando rubro:', err)
      showFeedback('error', 'Error al guardar el nuevo rubro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateTrade(e) {
    e?.preventDefault()
    if (!editingTrade) return

    const oldName = editingTrade.trade
    const newName = editedName.trim().toUpperCase()

    if (!newName) {
      showFeedback('error', 'El nombre del rubro no puede quedar vacío.')
      return
    }

    if (oldName === newName) {
      setEditingTrade(null)
      return
    }

    if (masterTrades.includes(newName) && newName !== oldName) {
      showFeedback('error', `El rubro "${newName}" ya existe. Para fusionarlos, usa la opción de reasignación.`)
      return
    }

    setSaving(true)
    try {
      // 1. Propagación masiva a todos los trabajadores con ese rubro
      const countAffected = editingTrade.total
      if (countAffected > 0) {
        const { error: updateWorkersErr } = await supabase
          .from('workers')
          .update({ trade: newName })
          .eq('trade', oldName)

        if (updateWorkersErr) throw updateWorkersErr
      }

      // 2. Actualizar lista maestra en system_settings
      const updatedList = masterTrades.map(t => t === oldName ? newName : t).sort()
      const { error: settingsErr } = await supabase
        .from('system_settings')
        .upsert({
          key: 'master_trades',
          value: updatedList,
          updated_at: new Date().toISOString(),
          updated_by: 'Administrador'
        }, { onConflict: 'key' })

      if (settingsErr) throw settingsErr

      // 3. Registrar auditoría
      try {
        await supabase.from('audit_logs').insert({
          action: 'RENAME_TRADE',
          entity: 'trades',
          entity_id: newName,
          details: { oldName, newName, affectedWorkers: countAffected },
          created_at: new Date().toISOString()
        })
      } catch (logErr) {
        console.warn('No se pudo registrar log de auditoría:', logErr)
      }

      // 4. Actualizar estado local
      setWorkers(prev => prev.map(w => w.trade === oldName ? { ...w, trade: newName } : w))
      setMasterTrades(updatedList)
      setEditingTrade(null)
      setEditedName('')
      showFeedback('success', `Rubro renombrado a "${newName}". Se actualizaron ${countAffected} operarios automáticamente.`)
    } catch (err) {
      console.error('Error al renombrar rubro:', err)
      showFeedback('error', 'Error al renombrar rubro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTrade() {
    if (!deletingTrade) return

    const tradeToDelete = deletingTrade.trade
    const workersCount = deletingTrade.total

    // Si tiene operarios, se exige un rubro de reasignación válido
    if (workersCount > 0 && (!reassignTrade || reassignTrade === tradeToDelete)) {
      showFeedback('error', 'Debes seleccionar un rubro de destino para reasignar a los operarios asignados.')
      return
    }

    setSaving(true)
    try {
      // 1. Reasignar operarios si correspondía
      if (workersCount > 0) {
        const { error: reassignErr } = await supabase
          .from('workers')
          .update({ trade: reassignTrade })
          .eq('trade', tradeToDelete)

        if (reassignErr) throw reassignErr
      }

      // 2. Remover del catálogo maestro en system_settings
      const updatedList = masterTrades.filter(t => t !== tradeToDelete)
      const { error: settingsErr } = await supabase
        .from('system_settings')
        .upsert({
          key: 'master_trades',
          value: updatedList,
          updated_at: new Date().toISOString(),
          updated_by: 'Administrador'
        }, { onConflict: 'key' })

      if (settingsErr) throw settingsErr

      // 3. Auditoría
      try {
        await supabase.from('audit_logs').insert({
          action: 'DELETE_TRADE',
          entity: 'trades',
          entity_id: tradeToDelete,
          details: { tradeToDelete, reassignTo: reassignTrade || null, affectedWorkers: workersCount },
          created_at: new Date().toISOString()
        })
      } catch (logErr) {
        console.warn('No se pudo registrar log:', logErr)
      }

      // 4. Actualizar estado local
      if (workersCount > 0) {
        setWorkers(prev => prev.map(w => w.trade === tradeToDelete ? { ...w, trade: reassignTrade } : w))
      }
      setMasterTrades(updatedList)
      setDeletingTrade(null)
      setReassignTrade('')
      showFeedback('success', workersCount > 0 
        ? `Rubro "${tradeToDelete}" eliminado. ${workersCount} operarios fueron reasignados a "${reassignTrade}".`
        : `Rubro "${tradeToDelete}" eliminado del catálogo maestro.`
      )
    } catch (err) {
      console.error('Error al eliminar rubro:', err)
      showFeedback('error', 'Error al eliminar rubro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* NOTIFICACIÓN / FEEDBACK */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold shadow-lg ${
          feedback.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
            : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CABECERA Y RESUMEN KPI */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Wrench className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Catálogo Maestro de Rubros & Oficios</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono">
                  {masterTrades.length} Rubros
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Estandarización de especialidades laborales para personal propio, contratistas y cuadrillas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Refrescar catálogo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                setNewTradeName('')
                setShowCreateModal(true)
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Nuevo Rubro</span>
            </button>
          </div>
        </div>

        {/* TARJETAS DE CONTROL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Rubros Registrados
              </span>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                {masterTrades.length}
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Personal con Rubro Asignado
              </span>
              <span className="text-xl font-black font-mono text-emerald-400 mt-1 block">
                {totalAssignedWorkers} / {workers.length}
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Rubros sin Operarios Asignados
              </span>
              <span className="text-xl font-black font-mono text-amber-400 mt-1 block">
                {tradesWithZeroWorkers}
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* BUSCADOR Y LISTA DE RUBROS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar rubro u oficio..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Mostrando <strong>{filteredTradeStats.length}</strong> de {masterTrades.length} rubros
          </span>
        </div>

        {/* TABLA DE RUBROS */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-4">Nombre del Rubro</th>
                <th className="py-2.5 px-4 text-center">Operarios Asignados</th>
                <th className="py-2.5 px-4">Distribución por Centro</th>
                <th className="py-2.5 px-4 text-center">Estado</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Cargando rubros...
                  </td>
                </tr>
              ) : filteredTradeStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No se encontraron rubros con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredTradeStats.map((stat, idx) => {
                  const inUse = stat.total > 0
                  return (
                    <tr key={stat.trade} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-extrabold text-white text-xs tracking-wide">
                          {stat.trade}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                          inUse 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' 
                            : 'bg-slate-950 text-slate-500 border border-slate-800'
                        }`}>
                          <Users className="w-3 h-3" />
                          <span>{stat.total}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {inUse ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {stat.astillero > 0 && (
                              <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                                {stat.astillero} Astillero
                              </span>
                            )}
                            {stat.contratista > 0 && (
                              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold">
                                {stat.contratista} Contratista
                              </span>
                            )}
                            {stat.taller > 0 && (
                              <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-semibold">
                                {stat.taller} Taller
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Sin asignación actual</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          inUse
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {inUse ? 'En Uso' : 'Disponible'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTrade(stat)
                              setEditedName(stat.trade)
                            }}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
                            title="Renombrar y propagar masivamente"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingTrade(stat)
                              // Sugerir primer rubro alternativo distinto
                              const other = masterTrades.find(t => t !== stat.trade) || 'MISCELANEOS'
                              setReassignTrade(other)
                            }}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-700/60 transition-all cursor-pointer"
                            title="Eliminar rubro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREAR NUEVO RUBRO */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-extrabold text-white">Nuevo Rubro / Oficio</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTrade} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nombre del Rubro (Se guardará automáticamente en MAYÚSCULAS)
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newTradeName}
                  onChange={(e) => setNewTradeName(e.target.value.toUpperCase())}
                  placeholder="EJ. MECANICA NAVAL, ELECTRICIDAD..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white uppercase focus:outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Una vez creado, estará disponible inmediatamente en los desplegables de Personal, Pañol y Horas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTradeName.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{saving ? 'Guardando...' : 'Crear Rubro'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RENOMBRAR CON PROPAGACIÓN MASIVA A WORKERS.TRADE */}
      {/* ========================================================================= */}
      {editingTrade && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-extrabold text-white">Renombrar Rubro</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrade(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTrade} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nuevo Nombre del Rubro
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white uppercase focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {editingTrade.total > 0 && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Propagación Masiva Automática</span>
                  </div>
                  <p className="text-[11px] text-cyan-200/80">
                    Hay <strong>{editingTrade.total} operarios</strong> asignados a <em>"{editingTrade.trade}"</em>. Al confirmar, todos se actualizarán automáticamente a <em>"{editedName.trim().toUpperCase()}"</em>.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTrade(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !editedName.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{saving ? 'Actualizando...' : 'Renombrar y Propagar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ELIMINAR CON REASIGNACIÓN SEGURA (SKL-007 P9) */}
      {/* ========================================================================= */}
      {deletingTrade && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-extrabold text-white">Eliminar Rubro</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingTrade(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                ¿Estás seguro de que deseas eliminar el rubro <strong className="text-white">"{deletingTrade.trade}"</strong> del catálogo?
              </p>

              {deletingTrade.total > 0 ? (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs space-y-2.5">
                  <div className="font-bold flex items-center gap-1.5 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Reasignación Obligatoria ({deletingTrade.total} operarios)</span>
                  </div>
                  <p className="text-[11px] text-rose-200/80">
                    Para evitar registros huérfanos, selecciona a qué rubro se reasignarán los <strong>{deletingTrade.total} operarios</strong> que tenían este oficio:
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Rubro de Destino
                    </label>
                    <select
                      value={reassignTrade}
                      onChange={(e) => setReassignTrade(e.target.value)}
                      className="w-full bg-slate-950 border border-rose-800/80 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-rose-400"
                    >
                      {masterTrades.filter(t => t !== deletingTrade.trade).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  Este rubro no tiene operarios asignados actualmente. Se eliminará de forma segura del catálogo.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingTrade(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || (deletingTrade.total > 0 && !reassignTrade)}
                onClick={handleDeleteTrade}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{saving ? 'Eliminando...' : deletingTrade.total > 0 ? 'Reasignar y Eliminar' : 'Eliminar Rubro'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
