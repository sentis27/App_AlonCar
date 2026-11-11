import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ship,
  Calendar,
  Building2,
  Trash2,
  UserPlus,
  BellRing,
  X,
  Save,
  Check,
  FileText,
  Anchor,
  Sparkles,
  Eye,
  Upload,
  Pencil,
  ExternalLink,
  AlertTriangle,
  MessageSquare
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logRowAction } from '../../lib/auditService'
import {
  DEFAULT_TECH_COMPONENTS,
  PREDEFINED_VESSEL_TYPES,
  STANDARD_LOCATIONS,
  cleanShipName,
  cleanLocation,
  calculateStayDays
} from '../../lib/shipsConstants'

// ==============================================================================
// MODAL 1: FICHA TÉCNICA DINÁMICA 360° (PLANOS, ESPECIFICACIONES, ARMADOR, OTS)
// ==============================================================================
export function ShipDetailModal({
  selectedShip360,
  setSelectedShip360,
  subTab360,
  setSubTab360,
  stays = [],
  workOrders = [],
  workItems = [],
  getShipOtMetrics = {},
  uploadingDoc,
  handleUploadNavalFile,
  handleDeleteNavalFile,
  handleOpenEditShip,
  handleOpenNewStay,
  onOpenAssignOrphan,
  handleDismissOrphanAlert
}) {
  if (!selectedShip360) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 md:p-6 shadow-2xl space-y-5">
        {/* Cabecera Modal */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-primary">
              <Ship className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {cleanShipName(selectedShip360.name)}
                </h2>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
                  {selectedShip360.vessel_type || 'Pesquero'}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Matrícula: <strong className="text-slate-200 font-mono">{selectedShip360.matricula || 'S/D'}</strong></span>
                <span>•</span>
                <span>Locación: <strong className="text-cyan-300 font-mono">{cleanLocation(selectedShip360.current_location)}</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedShip360(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Alerta de Barco Huérfano */}
        {selectedShip360.orphan_owner_alert && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Buque Huérfano: La empresa armadora fue eliminada. Requiere nueva asignación.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAssignOrphan(selectedShip360)}
                className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer shadow-sm"
              >
                Asignar Armador
              </button>
              <button
                type="button"
                onClick={() => handleDismissOrphanAlert(selectedShip360)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Apagar Alerta
              </button>
            </div>
          </div>
        )}

        {/* Alerta de Solicitud de Información Activa */}
        {selectedShip360.info_request_status && selectedShip360.info_request_status !== 'completo' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-amber-400" />
                <span>
                  Solicitud Pendiente ({selectedShip360.info_request_status === 'pendiente_maria_jose' ? 'María José' : selectedShip360.info_request_status === 'pendiente_jefe_obra' ? 'Jefes de Obra' : 'María José & Jefes de Obra'})
                </span>
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">
                {selectedShip360.info_requested_at ? String(selectedShip360.info_requested_at).split('T')[0] : ''}
              </span>
            </div>
            {selectedShip360.info_request_notes && (
              <p className="text-[11px] text-amber-200/90 pl-5 italic border-l-2 border-amber-500/40 py-0.5">
                💬 Instrucciones de Jorge Sentis (Admin): &ldquo;{selectedShip360.info_request_notes}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Subpestañas Ficha 360 */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setSubTab360('tecnica')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab360 === 'tecnica'
                ? 'bg-primary text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ficha Técnica & Planos
          </button>
          <button
            type="button"
            onClick={() => setSubTab360('armador')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab360 === 'armador'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Armador & Contactos
          </button>
          <button
            type="button"
            onClick={() => setSubTab360('movimientos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab360 === 'movimientos'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Historial de Estadías ({stays.filter(s => s.ship_id === selectedShip360.id).length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab360('ots')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab360 === 'ots'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Órdenes de Trabajo ({getShipOtMetrics[selectedShip360.id]?.total || 0})
          </button>
        </div>

        {/* CONTENIDO SUBPESTAÑAS */}
        <div className="space-y-4 pt-1">
          {/* SUBPESTAÑA 1: FICHA TÉCNICA DINÁMICA & DOCUMENTACIÓN NAVAL */}
          {subTab360 === 'tecnica' && (
            <div className="space-y-5">
              {/* SECCIÓN DOCUMENTACIÓN TÉCNICA NAVAL (Jefe de Obra) */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                      Documentación Técnica Naval & Planos (Jefe de Obra)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Terminal Jefe de Obra</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. Plano de Diseño de Anguilera */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-white text-xs flex items-center gap-1.5">
                          <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Plano de Diseño de Anguilera</span>
                        </strong>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                          .DWG / .PDF / .CAD
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Plano constructivo de puesta en seco, anguilera y picaderos específicos del buque.
                      </p>
                    </div>

                    {selectedShip360.plan_anguilera_url ? (
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-300 font-bold truncate max-w-[190px]" title={selectedShip360.plan_anguilera_name}>
                            📄 {selectedShip360.plan_anguilera_name || 'Plano_Anguilera'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {selectedShip360.plan_anguilera_uploaded_at ? String(selectedShip360.plan_anguilera_uploaded_at).split('T')[0] : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                          <a
                            href={selectedShip360.plan_anguilera_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[11px] font-bold flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver / Descargar</span>
                          </a>
                          <label className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold cursor-pointer flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>Reemplazar</span>
                            <input
                              type="file"
                              accept=".dwg,.dxf,.pdf"
                              className="hidden"
                              disabled={uploadingDoc}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUploadNavalFile(selectedShip360.id, 'plano_anguilera', file)
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteNavalFile(selectedShip360.id, 'plano_anguilera')}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer ml-auto"
                            title="Quitar archivo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-700 hover:border-cyan-400/60 p-4 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-slate-950/60 hover:bg-slate-950">
                        <Upload className="w-5 h-5 text-cyan-400" />
                        <span className="text-xs font-bold text-slate-200">Subir Plano de Anguilera</span>
                        <span className="text-[10px] text-slate-500">Seleccionar archivo .dwg, .dxf o .pdf</span>
                        <input
                          type="file"
                          accept=".dwg,.dxf,.pdf"
                          className="hidden"
                          disabled={uploadingDoc}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadNavalFile(selectedShip360.id, 'plano_anguilera', file)
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* 2. Informe de Pintado de Casco */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-white text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Informe de Pintado de Casco</span>
                        </strong>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                          .PDF
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Informe de preparación de superficie, espesores de película y esquema de pintado.
                      </p>
                    </div>

                    {selectedShip360.informe_pintado_url ? (
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-300 font-bold truncate max-w-[190px]" title={selectedShip360.informe_pintado_name}>
                            📄 {selectedShip360.informe_pintado_name || 'Informe_Pintado.pdf'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {selectedShip360.informe_pintado_uploaded_at ? String(selectedShip360.informe_pintado_uploaded_at).split('T')[0] : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                          <a
                            href={selectedShip360.informe_pintado_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver PDF</span>
                          </a>
                          <label className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold cursor-pointer flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>Reemplazar</span>
                            <input
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              disabled={uploadingDoc}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUploadNavalFile(selectedShip360.id, 'informe_pintado', file)
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteNavalFile(selectedShip360.id, 'informe_pintado')}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer ml-auto"
                            title="Quitar archivo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-700 hover:border-emerald-400/60 p-4 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-slate-950/60 hover:bg-slate-950">
                        <Upload className="w-5 h-5 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">Subir Informe de Pintado</span>
                        <span className="text-[10px] text-slate-500">Seleccionar archivo en formato .pdf</span>
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          disabled={uploadingDoc}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadNavalFile(selectedShip360.id, 'informe_pintado', file)
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Dimensiones Principales */}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Medidas Principales de Casco
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">Eslora</span>
                    <strong className="text-base text-white font-mono">{selectedShip360.eslora_mts ? `${selectedShip360.eslora_mts} m` : 'S/D'}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">Manga</span>
                    <strong className="text-base text-white font-mono">{selectedShip360.manga_mts ? `${selectedShip360.manga_mts} m` : 'S/D'}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">Puntal</span>
                    <strong className="text-base text-white font-mono">{selectedShip360.puntal_mts ? `${selectedShip360.puntal_mts} m` : 'S/D'}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">Superficie de Casco</span>
                    <strong className="text-base text-cyan-300 font-mono">{selectedShip360.superficie_casco_m2 ? `${selectedShip360.superficie_casco_m2} m²` : 'S/D'}</strong>
                  </div>
                </div>
              </div>

              {/* Componentes Técnicos Dinámicos (JSONB) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Componentes & Válvulas a Bordo
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEditShip(selectedShip360)
                      setSelectedShip360(null)
                    }}
                    className="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar Ficha Técnica</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {DEFAULT_TECH_COMPONENTS.map(comp => {
                    const compData = (selectedShip360.technical_specs || {})[comp.key] || { quantity: 0, notes: '' }
                    return (
                      <div key={comp.key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-white text-xs">{comp.label}</strong>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                            compData.quantity > 0
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : 'bg-slate-900 text-slate-500'
                          }`}>
                            Cantidad: {compData.quantity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {compData.notes ? compData.notes : 'Sin observaciones cargadas a bordo.'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SUBPESTAÑA 2: ARMADOR & CONTACTOS */}
          {subTab360 === 'armador' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Razón Social:</span>
                  <strong className="text-white text-sm">{selectedShip360.owners?.name || selectedShip360.client_name || 'Sin asignar'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Nombre del Armador:</span>
                  <strong className="text-amber-300">{selectedShip360.owners?.armador_name || 'No informado'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Teléfono Armador:</span>
                  <strong className="text-cyan-300">{selectedShip360.owners?.armador_phone || 'No informado'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email Principal:</span>
                  <strong className="text-slate-200">{selectedShip360.owners?.email_principal || 'No informado'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email Secundario:</span>
                  <strong className="text-slate-200">{selectedShip360.owners?.email_secundario || 'No informado'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* SUBPESTAÑA 3: MOVIMIENTOS */}
          {subTab360 === 'movimientos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Historial de Estadías de este barco:</span>
                <button
                  type="button"
                  onClick={() => handleOpenNewStay(selectedShip360.id)}
                  className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold cursor-pointer"
                >
                  + Registrar Movimiento
                </button>
              </div>
              {stays.filter(s => s.ship_id === selectedShip360.id).length === 0 ? (
                <div className="p-5 text-center text-slate-500 text-xs">
                  Sin movimientos registrados aún para este barco.
                </div>
              ) : (
                <div className="space-y-2">
                  {stays.filter(s => s.ship_id === selectedShip360.id).map(st => {
                    const days = calculateStayDays(st.start_date, st.end_date)
                    const locClean = cleanLocation(st.location)
                    return (
                      <div key={st.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-white block">{locClean}</strong>
                          <span className="text-slate-400 text-[11px]">
                            {st.start_date} &rarr; {st.end_date || 'En curso (=HOY)'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-cyan-300 font-mono block">
                            {days} {days === 1 ? 'día' : 'días'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUBPESTAÑA 4: OTS Y TRABAJOS */}
          {subTab360 === 'ots' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Órdenes de Trabajo vinculadas ({getShipOtMetrics[selectedShip360.id]?.total || 0}):
                </span>
                <Link
                  to="/ots"
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
                >
                  <span>Ir a Órdenes de Trabajo</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {workOrders.filter(w => w.ship_id === selectedShip360.id).length === 0 ? (
                <div className="p-5 text-center text-slate-500 text-xs">
                  Sin Órdenes de Trabajo abiertas para este barco.
                </div>
              ) : (
                <div className="space-y-2">
                  {workOrders.filter(w => w.ship_id === selectedShip360.id).map(wo => {
                    const items = workItems.filter(i => i.work_order_id === wo.id)
                    const inExecutionItems = items.filter(i => i.status === 'En ejecución')
                    const isExecution = inExecutionItems.length > 0 || wo.status === 'En Progreso' || wo.status === 'En ejecución'

                    return (
                      <div key={wo.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-primary font-black px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                              {wo.ot_number || 'OT'}
                            </span>
                            <strong className="text-white text-sm">{wo.title}</strong>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                            isExecution
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}>
                            {isExecution ? `En ejecución (${inExecutionItems.length}/${items.length} act.)` : wo.status}
                          </span>
                        </div>

                        {items.length > 0 && (
                          <div className="pl-3 border-l-2 border-slate-800 space-y-1 text-[11px]">
                            {items.map(it => (
                              <div key={it.id} className="flex items-center justify-between text-slate-300">
                                <span className="truncate max-w-[400px]">• {it.description}</span>
                                <span className={`font-mono font-bold text-[10px] ${
                                  it.status === 'En ejecución' ? 'text-emerald-400' : 'text-slate-500'
                                }`}>
                                  {it.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 2: ALTA Y EDICIÓN DE BUQUE (FICHA TÉCNICA Y RELEVAMIENTO)
// ==============================================================================
export function ShipFormModal({
  modalShip,
  setModalShip,
  owners = [],
  submitting,
  handleSaveShip
}) {
  if (!modalShip.isOpen || !modalShip.ship) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="alon-modal-card max-w-5xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2.5 min-w-0">
            <Ship className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="font-black text-white text-sm truncate">
                {modalShip.ship.id ? 'Editar Ficha Técnica de Buque' : 'Alta de Nuevo Buque (Administrador)'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Identificación Naval ➔ 2° Medidas Principales ➔ 3° Inventario Técnico a Bordo.
              </p>
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setModalShip({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveShip} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="alon-modal-body">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
              {/* COLUMNA IZQUIERDA: BLOQUES 1 Y 2 */}
              <div className="space-y-3">
                {/* BLOQUE 1: IDENTIFICACIÓN NAVAL Y ARMADOR */}
                <div className="alon-chunk-sky space-y-2.5">
                  <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
                    <span className="font-black text-sky-400 uppercase tracking-wider text-[11px]">
                      1. Identificación Naval y Empresa Propietaria
                    </span>
                    <span className="text-[10px] text-slate-400">Datos Maestros</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Nombre del buque */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Nombre del Buque <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        required
                        placeholder="Ej: TRITON I"
                        value={modalShip.ship.name || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, name: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary uppercase font-bold"
                      />
                    </div>

                    {/* Empresa Propietaria / Armador */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Empresa Propietaria / Armador
                      </label>
                      <select
                        value={modalShip.ship.owner_id || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, owner_id: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
                      >
                        <option value="">-- Seleccionar Armador --</option>
                        {owners.map(o => (
                          <option key={o.id} value={o.id}>{o.name} {o.armador_name ? `(${o.armador_name})` : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo de Embarcación */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Tipo de Embarcación
                      </label>
                      <select
                        value={modalShip.isCustomVesselType ? '__otro__' : (modalShip.ship.vessel_type || 'Pesquero')}
                        onChange={(e) => {
                          if (e.target.value === '__otro__') {
                            setModalShip({
                              ...modalShip,
                              isCustomVesselType: true,
                              customVesselTypeVal: modalShip.ship.vessel_type || ''
                            })
                          } else {
                            setModalShip({
                              ...modalShip,
                              isCustomVesselType: false,
                              ship: { ...modalShip.ship, vessel_type: e.target.value }
                            })
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
                      >
                        {PREDEFINED_VESSEL_TYPES.map(vt => (
                          <option key={vt} value={vt}>{vt}</option>
                        ))}
                        <option value="__otro__">✏️ + Otro (Personalizado)...</option>
                      </select>

                      {modalShip.isCustomVesselType && (
                        <input
                          type="text"
                          required
                          placeholder="Escribí tipo de embarcación..."
                          value={modalShip.customVesselTypeVal}
                          onChange={(e) => setModalShip({ ...modalShip, customVesselTypeVal: e.target.value })}
                          className="w-full mt-1.5 bg-slate-950 border border-primary/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                      )}
                    </div>

                    {/* Matrícula */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">Matrícula Naval</label>
                      <input
                        type="text"
                        placeholder="Ej: 0124-M"
                        value={modalShip.ship.matricula || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, matricula: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                      />
                    </div>

                    {/* Locación Inicial Limpia */}
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">Locación Actual en Astillero</label>
                      <select
                        value={cleanLocation(modalShip.ship.current_location)}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, current_location: cleanLocation(e.target.value) } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
                      >
                        {STANDARD_LOCATIONS.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* BLOQUE 2: MEDIDAS NAVALES PRINCIPALES */}
                <div className="alon-chunk-indigo space-y-2.5">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1">
                    <span className="font-black text-indigo-400 uppercase tracking-wider text-[11px]">
                      2. Medidas Principales (Jefe de Obra)
                    </span>
                    <span className="text-[10px] text-slate-400">Dimensiones de casco</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 font-mono">Eslora (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 28.5"
                        value={modalShip.ship.eslora_mts || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, eslora_mts: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 font-mono">Manga (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 7.2"
                        value={modalShip.ship.manga_mts || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, manga_mts: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 font-mono">Puntal (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 3.4"
                        value={modalShip.ship.puntal_mts || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, puntal_mts: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 font-mono">Sup. Casco (m²)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 320"
                        value={modalShip.ship.superficie_casco_m2 || ''}
                        onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, superficie_casco_m2: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: BLOQUE 3 */}
              <div className="alon-chunk-emerald space-y-2.5">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                  <span className="font-black text-emerald-400 uppercase tracking-wider text-[11px]">
                    3. Inventario Técnico a Bordo (Válvulas, Tanques, Pocetes)
                  </span>
                  <span className="text-[10px] text-slate-400">Relevamiento técnico</span>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {DEFAULT_TECH_COMPONENTS.map(comp => {
                    const currentComp = (modalShip.ship.technical_specs || {})[comp.key] || { quantity: 0, notes: '' }
                    return (
                      <div key={comp.key} className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="text-xs text-white block truncate">{comp.label}</strong>
                            <span className="text-[10px] text-slate-400 block truncate">{comp.hint}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold">Cant:</span>
                            <input
                              type="number"
                              min="0"
                              value={currentComp.quantity || 0}
                              onChange={(e) => {
                                const q = parseInt(e.target.value, 10) || 0
                                const updatedSpecs = {
                                  ...(modalShip.ship.technical_specs || {}),
                                  [comp.key]: { ...currentComp, quantity: q }
                                }
                                setModalShip({
                                  ...modalShip,
                                  ship: { ...modalShip.ship, technical_specs: updatedSpecs }
                                })
                              }}
                              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-center font-mono font-bold focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>

                        {currentComp.quantity > 0 && (
                          <input
                            type="text"
                            placeholder={`Observaciones de ${comp.label}...`}
                            value={currentComp.notes || ''}
                            onChange={(e) => {
                              const updatedSpecs = {
                                ...(modalShip.ship.technical_specs || {}),
                                [comp.key]: { ...currentComp, notes: e.target.value }
                              }
                              setModalShip({
                                ...modalShip,
                                ship: { ...modalShip.ship, technical_specs: updatedSpecs }
                              })
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={() => setModalShip({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-1.5 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Buque</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 3: REGISTRAR / EDITAR MOVIMIENTO Y ESTADÍA
// ==============================================================================
export function StayFormModal({
  modalStay,
  setModalStay,
  ships = [],
  submitting,
  handleSaveStay
}) {
  if (!modalStay.isOpen || !modalStay.stay) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <span>{modalStay.stay.id ? 'Editar Movimiento' : 'Registrar Nuevo Movimiento'}</span>
          </h3>
          <button
            type="button"
            onClick={() => setModalStay({ isOpen: false, stay: null, defaultShipId: '' })}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveStay} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Buque *</label>
            <select
              required
              value={modalStay.stay.ship_id}
              onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, ship_id: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
            >
              <option value="">-- Seleccionar Buque --</option>
              {ships.map(s => (
                <option key={s.id} value={s.id}>{cleanShipName(s.name)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Locación *</label>
            <select
              required
              value={cleanLocation(modalStay.stay.location)}
              onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, location: cleanLocation(e.target.value) } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
            >
              {STANDARD_LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Fecha Comienzo *</label>
              <input
                type="date"
                required
                value={modalStay.stay.start_date || ''}
                onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, start_date: e.target.value } })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Fecha Fin <span className="text-[10px] text-slate-500 font-normal">(Vacío = HOY)</span>
              </label>
              <input
                type="date"
                value={modalStay.stay.end_date || ''}
                onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, end_date: e.target.value } })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Observaciones</label>
            <textarea
              rows={2}
              placeholder="Detalles del movimiento o cambio de amarre..."
              value={modalStay.stay.notes || ''}
              onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, notes: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalStay({ isOpen: false, stay: null, defaultShipId: '' })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Movimiento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 4: EMPRESA ARMADORA (ALTA / EDICIÓN)
// ==============================================================================
export function OwnerFormModal({
  modalOwner,
  setModalOwner,
  submitting,
  handleSaveOwner
}) {
  if (!modalOwner.isOpen || !modalOwner.owner) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <span>{modalOwner.owner.id ? 'Editar Armador' : 'Nueva Empresa Armadora'}</span>
          </h3>
          <button
            type="button"
            onClick={() => setModalOwner({ isOpen: false, owner: null })}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveOwner} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Razón Social o Empresa *</label>
            <input
              type="text"
              required
              placeholder="Ej: Pesquera Aldana S.A."
              value={modalOwner.owner.name || ''}
              onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, name: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Nombre del Armador</label>
              <input
                type="text"
                placeholder="Ej: Carlos Aldana"
                value={modalOwner.owner.armador_name || ''}
                onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, armador_name: e.target.value } })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Teléfono Armador</label>
              <input
                type="text"
                placeholder="Ej: +54 9 223 555-0192"
                value={modalOwner.owner.armador_phone || ''}
                onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, armador_phone: e.target.value } })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Email Principal (Operativo)</label>
            <input
              type="email"
              placeholder="operaciones@armador.com"
              value={modalOwner.owner.email_principal || ''}
              onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, email_principal: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Email Secundario (Facturación/Admin)</label>
            <input
              type="email"
              placeholder="facturacion@armador.com"
              value={modalOwner.owner.email_secundario || ''}
              onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, email_secundario: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">CUIT</label>
            <input
              type="text"
              placeholder="30-12345678-9"
              value={modalOwner.owner.cuit || ''}
              onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, cuit: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOwner({ isOpen: false, owner: null })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Armador</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 5: ELIMINACIÓN DEFINITIVA DE ARMADOR (AUDITADA)
// ==============================================================================
export function DeleteOwnerModal({
  modalDeleteOwner,
  setModalDeleteOwner,
  submitting,
  handleConfirmDeleteOwner
}) {
  if (!modalDeleteOwner.isOpen || !modalDeleteOwner.owner) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-rose-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">¿Eliminar Empresa Armadora?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Vas a eliminar definitivamente a <strong className="text-white">{modalDeleteOwner.owner?.name}</strong>. Esta acción quedará registrada en la Hoja de Auditoría permanente.
            </p>
          </div>
        </div>

        {modalDeleteOwner.linkedShips?.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Buques que quedarán Huérfanos ({modalDeleteOwner.linkedShips.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {modalDeleteOwner.linkedShips.map(s => (
                <span key={s.id} className="px-2 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-700/60 font-bold text-[10px]">
                  {cleanShipName(s.name)}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-amber-300/80 pt-1">
              Se desvinculará la empresa y se emitirá una alerta a María José para que asigne un nuevo armador o apague la alerta.
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setModalDeleteOwner({ isOpen: false, owner: null, linkedShips: [] })}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteOwner}
            disabled={submitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Confirmar Eliminación Definitiva</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 6: ASIGNAR ARMADOR A BUQUE HUÉRFANO
// ==============================================================================
export function AssignOrphanModal({
  modalAssignOrphan,
  setModalAssignOrphan,
  owners = [],
  submitting,
  handleAssignOrphanOwner
}) {
  if (!modalAssignOrphan.isOpen || !modalAssignOrphan.ship) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            <span>Asignar Empresa Armadora</span>
          </h3>
          <button
            type="button"
            onClick={() => setModalAssignOrphan({ isOpen: false, ship: null, selectedOwnerId: '' })}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAssignOrphanOwner} className="space-y-4">
          <div className="text-xs text-slate-300">
            Buque: <strong className="text-white text-sm">{cleanShipName(modalAssignOrphan.ship?.name)}</strong>
            {modalAssignOrphan.ship?.orphan_owner_previous_name && (
              <span className="block text-[11px] text-amber-300 mt-0.5">
                Armador anterior: {modalAssignOrphan.ship.orphan_owner_previous_name}
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Seleccioná la Empresa Armadora Propietaria *
            </label>
            <select
              required
              value={modalAssignOrphan.selectedOwnerId}
              onChange={(e) => setModalAssignOrphan({ ...modalAssignOrphan, selectedOwnerId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium"
            >
              <option value="">-- Seleccionar Armador Activo --</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name} {o.armador_name ? `(${o.armador_name})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalAssignOrphan({ isOpen: false, ship: null, selectedOwnerId: '' })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !modalAssignOrphan.selectedOwnerId}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Asignar y Quitar Alerta</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 7: SOLICITAR CARGA DE INFORMACIÓN CON NOTAS
// ==============================================================================
export function RequestInfoModal({
  modalRequestInfo,
  setModalRequestInfo,
  handleSendInfoRequestWithNotes
}) {
  if (!modalRequestInfo.isOpen || !modalRequestInfo.ship) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-400" />
            <span>Solicitar Carga de Información (Jorge Sentis)</span>
          </h3>
          <button
            type="button"
            onClick={() => setModalRequestInfo({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSendInfoRequestWithNotes} className="space-y-4">
          <div className="text-xs text-slate-300">
            Buque: <strong className="text-white text-sm">{cleanShipName(modalRequestInfo.ship?.name)}</strong>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              1. ¿A quién deseás encomendar la carga de datos?
            </label>
            <div className="space-y-2">
              <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                modalRequestInfo.requestType === 'pendiente_jefe_obra'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="requestType"
                  value="pendiente_jefe_obra"
                  checked={modalRequestInfo.requestType === 'pendiente_jefe_obra'}
                  onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, requestType: e.target.value })}
                  className="mt-0.5 accent-emerald-400"
                />
                <div>
                  <strong className="text-xs text-emerald-300 block">🛠️ Solo a Jefes de Obra (Técnico / Operaciones)</strong>
                  <span className="text-[11px] text-slate-400">
                    Solicita relevar Eslora, Manga, Superficie de Casco, Válvulas, Plano de Anguilera e Informe de Pintado.
                  </span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                modalRequestInfo.requestType === 'pendiente_maria_jose'
                  ? 'bg-amber-950/40 border-amber-500/60 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="requestType"
                  value="pendiente_maria_jose"
                  checked={modalRequestInfo.requestType === 'pendiente_maria_jose'}
                  onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, requestType: e.target.value })}
                  className="mt-0.5 accent-amber-400"
                />
                <div>
                  <strong className="text-xs text-amber-300 block">📋 Solo a María José (Administración / Comercial)</strong>
                  <span className="text-[11px] text-slate-400">
                    Solicita vincular Razón Social, nombre del armador, teléfonos y correos de contacto.
                  </span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                modalRequestInfo.requestType === 'pendiente_ambos'
                  ? 'bg-cyan-950/40 border-cyan-500/60 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="requestType"
                  value="pendiente_ambos"
                  checked={modalRequestInfo.requestType === 'pendiente_ambos'}
                  onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, requestType: e.target.value })}
                  className="mt-0.5 accent-cyan-400"
                />
                <div>
                  <strong className="text-xs text-cyan-300 block">📢 A Ambos: María José & Jefes de Obra</strong>
                  <span className="text-[11px] text-slate-400">
                    Solicita datos de armador y relevamiento técnico a bordo de forma paralela.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-200 block mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>2. Instrucciones o detalle específico de la solicitud:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Para que la tarea sea clara</span>
            </label>
            <textarea
              rows={3}
              placeholder="Ej: Por favor verificar espesores de chapa del fondo, relevar las 4 válvulas de casco de 3 a 6 pulgadas y subir el plano de anguilera actualizado..."
              value={modalRequestInfo.notes}
              onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalRequestInfo({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <BellRing className="w-4 h-4" />
              <span>Enviar Solicitud con Instrucciones</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// CONTENEDOR INTEGRAL DE TODOS LOS MODALES DE SHIPS
// ==============================================================================
export function ShipsModalsContainer({
  // Estados y Setters de Modales
  selectedShip360,
  setSelectedShip360,
  subTab360,
  setSubTab360,
  modalShip,
  setModalShip,
  modalStay,
  setModalStay,
  modalOwner,
  setModalOwner,
  modalDeleteOwner,
  setModalDeleteOwner,
  modalAssignOrphan,
  setModalAssignOrphan,
  modalRequestInfo,
  setModalRequestInfo,
  // Listas de datos
  ships = [],
  setShips,
  owners = [],
  setOwners,
  stays = [],
  setStays,
  workOrders = [],
  workItems = [],
  getShipOtMetrics = {},
  // Contexto y callbacks
  user,
  activeRolePerspective = 'admin',
  setStatusMessage,
  loadInitialData,
  handleOpenEditShip,
  handleOpenNewStay
}) {
  const [submitting, setSubmitting] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  // Guardar Buque
  const handleSaveShip = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const cleanName = cleanShipName(modalShip.ship.name).toUpperCase()
      if (!cleanName) throw new Error('El nombre del barco es obligatorio')
      const finalVesselType = modalShip.isCustomVesselType
        ? (modalShip.customVesselTypeVal?.trim() || 'Pesquero')
        : (modalShip.ship.vessel_type || 'Pesquero')

      const payload = {
        name: cleanName,
        owner_id: modalShip.ship.owner_id || null,
        matricula: modalShip.ship.matricula || null,
        vessel_type: finalVesselType,
        eslora_mts: modalShip.ship.eslora_mts ? parseFloat(modalShip.ship.eslora_mts) : null,
        manga_mts: modalShip.ship.manga_mts ? parseFloat(modalShip.ship.manga_mts) : null,
        puntal_mts: modalShip.ship.puntal_mts ? parseFloat(modalShip.ship.puntal_mts) : null,
        superficie_casco_m2: modalShip.ship.superficie_casco_m2 ? parseFloat(modalShip.ship.superficie_casco_m2) : null,
        current_location: cleanLocation(modalShip.ship.current_location),
        notes: modalShip.ship.notes || null,
        technical_specs: modalShip.ship.technical_specs || {},
        info_request_status: modalShip.ship.info_request_status || 'completo',
        is_active: true
      }

      if (modalShip.ship.id) {
        const { error } = await supabase.from('ships').update(payload).eq('id', modalShip.ship.id)
        if (error) throw error
        logRowAction({ action: 'MODAL_SAVE', entityType: 'ships', entityId: modalShip.ship.id, entityName: cleanName, changes: payload, sheetName: 'Barcos', moduleRoute: '/barcos', changeOrigin: 'MODAL_FORM', user: user?.email })
      } else {
        const { error } = await supabase.from('ships').insert([payload])
        if (error) throw error
      }

      setModalShip({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: `Buque "${cleanName}" guardado correctamente.` })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Estadía
  const handleSaveStay = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const cleanLoc = cleanLocation(modalStay.stay.location)
      const payload = {
        ship_id: modalStay.stay.ship_id,
        location: cleanLoc,
        start_date: modalStay.stay.start_date,
        end_date: modalStay.stay.end_date || null,
        notes: modalStay.stay.notes || null
      }

      if (modalStay.stay.id) {
        const { error } = await supabase.from('ship_stays').update(payload).eq('id', modalStay.stay.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ship_stays').insert([payload])
        if (error) throw error
      }

      if (!modalStay.stay.end_date) {
        await supabase.from('ships').update({ current_location: cleanLoc }).eq('id', payload.ship_id)
      }

      setModalStay({ isOpen: false, stay: null, defaultShipId: '' })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: 'Movimiento asentado en el Calendario de Estadías.' })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Armador
  const handleSaveOwner = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!modalOwner.owner.name.trim()) throw new Error('La Razón Social o Empresa es obligatoria')
      const payload = {
        name: modalOwner.owner.name.trim(),
        armador_name: modalOwner.owner.armador_name?.trim() || null,
        armador_phone: modalOwner.owner.armador_phone?.trim() || null,
        email_principal: modalOwner.owner.email_principal?.trim() || null,
        email_secundario: modalOwner.owner.email_secundario?.trim() || null,
        cuit: modalOwner.owner.cuit?.trim() || null,
        notes: modalOwner.owner.notes?.trim() || null,
        is_active: true
      }

      if (modalOwner.owner.id) {
        const { error } = await supabase.from('owners').update(payload).eq('id', modalOwner.owner.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('owners').insert([payload])
        if (error) throw error
      }

      setModalOwner({ isOpen: false, owner: null })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: 'Datos de la empresa armadora guardados exitosamente.' })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Confirmar eliminación definitiva de armador
  const handleConfirmDeleteOwner = async () => {
    const owner = modalDeleteOwner.owner
    if (!owner) return
    setSubmitting(true)
    try {
      const linked = modalDeleteOwner.linkedShips || []
      if (linked.length > 0) {
        for (const s of linked) {
          await supabase.from('ships').update({
            owner_id: null,
            orphan_owner_alert: true,
            orphan_owner_previous_name: owner.name
          }).eq('id', s.id)
        }
      }

      const { error } = await supabase.from('owners').delete().eq('id', owner.id)
      if (error) throw error

      setModalDeleteOwner({ isOpen: false, owner: null, linkedShips: [] })
      if (setStatusMessage) setStatusMessage({
        type: 'info',
        text: `Empresa "${owner.name}" eliminada definitivamente. Se activó la alerta de buques huérfanos.`
      })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Asignar armador a buque huérfano
  const handleAssignOrphanOwner = async (e) => {
    e.preventDefault()
    if (!modalAssignOrphan.ship || !modalAssignOrphan.selectedOwnerId) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('ships').update({
        owner_id: modalAssignOrphan.selectedOwnerId,
        orphan_owner_alert: false,
        orphan_owner_previous_name: null
      }).eq('id', modalAssignOrphan.ship.id)
      if (error) throw error

      setModalAssignOrphan({ isOpen: false, ship: null, selectedOwnerId: '' })
      if (setStatusMessage) setStatusMessage({
        type: 'success',
        text: `Se asignó correctamente el armador al buque "${cleanShipName(modalAssignOrphan.ship.name)}".`
      })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Apagar alerta de huérfano
  const handleDismissOrphanAlert = async (ship) => {
    if (!window.confirm(`¿Apagar la alerta de buque huérfano para "${cleanShipName(ship.name)}"?`)) return
    try {
      const { error } = await supabase.from('ships').update({ orphan_owner_alert: false }).eq('id', ship.id)
      if (error) throw error
      if (setStatusMessage) setStatusMessage({ type: 'info', text: 'Alerta de buque huérfano apagada.' })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    }
  }

  // Enviar solicitud de información técnica
  const handleSendInfoRequestWithNotes = async (e) => {
    e.preventDefault()
    if (!modalRequestInfo.ship) return
    try {
      const { error } = await supabase.from('ships').update({
        info_request_status: modalRequestInfo.requestType,
        info_request_notes: modalRequestInfo.notes?.trim() || null,
        info_requested_at: new Date().toISOString(),
        info_requested_by: user?.email || 'Jorge Sentis (Admin)'
      }).eq('id', modalRequestInfo.ship.id)
      if (error) throw error

      setModalRequestInfo({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: 'Solicitud enviada con instrucciones claras.' })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    }
  }

  // Subir plano / informe naval
  const handleUploadNavalFile = async (shipId, docType, file) => {
    if (!file) return
    setUploadingDoc(true)
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${shipId}/${docType}_${Date.now()}_${cleanFileName}`
      const { error: uploadError } = await supabase.storage.from('ship-documents').upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('ship-documents').getPublicUrl(filePath)
      const nowIso = new Date().toISOString()
      const updateFields = docType === 'plano_anguilera'
        ? { plan_anguilera_url: urlData?.publicUrl, plan_anguilera_name: file.name, plan_anguilera_uploaded_at: nowIso }
        : { informe_pintado_url: urlData?.publicUrl, informe_pintado_name: file.name, informe_pintado_uploaded_at: nowIso }

      const { error: dbErr } = await supabase.from('ships').update(updateFields).eq('id', shipId)
      if (dbErr) throw dbErr

      if (setStatusMessage) setStatusMessage({ type: 'success', text: `Archivo "${file.name}" cargado con éxito.` })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setUploadingDoc(false)
    }
  }

  // Quitar documento naval
  const handleDeleteNavalFile = async (shipId, docType) => {
    if (!window.confirm('¿Confirmás quitar este documento de la Ficha Técnica Naval?')) return
    try {
      const updateFields = docType === 'plano_anguilera'
        ? { plan_anguilera_url: null, plan_anguilera_name: null, plan_anguilera_uploaded_at: null }
        : { informe_pintado_url: null, informe_pintado_name: null, informe_pintado_uploaded_at: null }

      const { error: dbErr } = await supabase.from('ships').update(updateFields).eq('id', shipId)
      if (dbErr) throw dbErr

      if (setStatusMessage) setStatusMessage({ type: 'info', text: 'Documento técnico removido de la Ficha Técnica.' })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <>
      <ShipDetailModal
        selectedShip360={selectedShip360}
        setSelectedShip360={setSelectedShip360}
        subTab360={subTab360}
        setSubTab360={setSubTab360}
        stays={stays}
        workOrders={workOrders}
        workItems={workItems}
        getShipOtMetrics={getShipOtMetrics}
        uploadingDoc={uploadingDoc}
        handleUploadNavalFile={handleUploadNavalFile}
        handleDeleteNavalFile={handleDeleteNavalFile}
        handleOpenEditShip={handleOpenEditShip}
        handleOpenNewStay={handleOpenNewStay}
        onOpenAssignOrphan={(ship) => setModalAssignOrphan({ isOpen: true, ship, selectedOwnerId: '' })}
        handleDismissOrphanAlert={handleDismissOrphanAlert}
      />

      <ShipFormModal
        modalShip={modalShip}
        setModalShip={setModalShip}
        owners={owners}
        submitting={submitting}
        handleSaveShip={handleSaveShip}
      />

      <StayFormModal
        modalStay={modalStay}
        setModalStay={setModalStay}
        ships={ships}
        submitting={submitting}
        handleSaveStay={handleSaveStay}
      />

      <OwnerFormModal
        modalOwner={modalOwner}
        setModalOwner={setModalOwner}
        submitting={submitting}
        handleSaveOwner={handleSaveOwner}
      />

      <DeleteOwnerModal
        modalDeleteOwner={modalDeleteOwner}
        setModalDeleteOwner={setModalDeleteOwner}
        submitting={submitting}
        handleConfirmDeleteOwner={handleConfirmDeleteOwner}
      />

      <AssignOrphanModal
        modalAssignOrphan={modalAssignOrphan}
        setModalAssignOrphan={setModalAssignOrphan}
        owners={owners}
        submitting={submitting}
        handleAssignOrphanOwner={handleAssignOrphanOwner}
      />

      <RequestInfoModal
        modalRequestInfo={modalRequestInfo}
        setModalRequestInfo={setModalRequestInfo}
        handleSendInfoRequestWithNotes={handleSendInfoRequestWithNotes}
      />
    </>
  )
}

export default ShipsModalsContainer
