import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RESUMEN_GERENCIAL_TABS } from '../lib/drydockCatalogConstants'
import { useResumenGerencialState } from '../hooks/useResumenGerencialState'
import ResumenGerencialHeader from '../components/resumenGerencial/ResumenGerencialHeader'
import ResumenObraCostosPanel from '../components/resumenGerencial/ResumenObraCostosPanel'
import ResumenMatrizOtsPanel from '../components/resumenGerencial/ResumenMatrizOtsPanel'
import ResumenHojaMaterialesPanel from '../components/resumenGerencial/ResumenHojaMaterialesPanel'
import ResumenHojaHorasPanel from '../components/resumenGerencial/ResumenHojaHorasPanel'
import ResumenHojaTercerosPanel from '../components/resumenGerencial/ResumenHojaTercerosPanel'
import ComparadorObrasCanvasPanel from '../components/resumenGerencial/ComparadorObrasCanvasPanel'
import RemitoComercialAlfaPanel from '../components/resumenGerencial/RemitoComercialAlfaPanel'

export default function ResumenGerencial() {
  const { user, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = RESUMEN_GERENCIAL_TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'resumen'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [resumenSubView, setResumenSubView] = useState('RESUMEN')
  const [activeCostSheet, setActiveCostSheet] = useState('materiales')
  const [costSheetScope, setCostSheetScope] = useState('GENERAL')

  const state = useResumenGerencialState({
    actorName: profile?.full_name || user?.email || 'Dirección'
  })

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && RESUMEN_GERENCIAL_TABS.some((tab) => tab.id === t)) {
      setActiveTab(t)
    }
  }, [searchParams])

  const switchTab = (tabId) => {
    setActiveTab(tabId)
    if (tabId !== 'resumen') setResumenSubView('RESUMEN')
    setSearchParams({ tab: tabId }, { replace: true })
  }

  return (
    <div className="space-y-4 pb-8">
      <ResumenGerencialHeader
        activeTab={activeTab}
        onSelectTab={switchTab}
        selectableShips={state.selectableShips}
        selectedShipId={state.selectedShipId}
        onChangeShip={(shipId) => {
          state.setSelectedShipId(shipId)
          state.setSelectedOtId('')
        }}
        scope={state.scope}
        onChangeScope={state.setScope}
        yearFilter={state.yearFilter}
        onChangeYear={state.setYearFilter}
        availableYears={state.availableYears}
        shipSummary={state.shipSummary}
        loading={state.loading}
        onRefresh={state.loadAll}
      />

      {state.feedback && (
        <div
          className={`px-4 py-2 rounded-xl border text-xs font-semibold ${
            state.feedback.type === 'error'
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {state.feedback.text}
        </div>
      )}

      {state.data?.warnings?.length > 0 && (
        <div className="px-4 py-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Avisos de consulta: {state.data.warnings.join(' | ')}</span>
        </div>
      )}

      {state.loading && !state.data ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs font-semibold">
            Consolidando costos de obra, pañol, horas y terceros...
          </span>
        </div>
      ) : (
        <>
          {activeTab === 'resumen' && resumenSubView === 'RESUMEN' && (
            <ResumenObraCostosPanel
              summary={state.shipSummary}
              dollarRate={state.dollarRate}
              onDollarRateOverride={state.setDollarOverride}
              onSelectOt={state.setSelectedOtId}
              onOpenMatrixView={() => setResumenSubView('MATRIX')}
              onOpenCostSheet={(sheetId, nextScope) => {
                setActiveCostSheet(sheetId)
                setCostSheetScope(nextScope)
                setResumenSubView('SHEET')
              }}
              onSaveCraneHours={state.handleSaveCraneHours}
            />
          )}

          {activeTab === 'resumen' && resumenSubView === 'MATRIX' && (
            <ResumenMatrizOtsPanel
              summary={state.shipSummary}
              activeOtId={state.shipSummary?.activeOt?.id}
              onSelectOtAndInspect={(otId) => {
                state.setSelectedOtId(otId)
                setResumenSubView('RESUMEN')
              }}
              onBackToSummary={() => setResumenSubView('RESUMEN')}
            />
          )}

          {activeTab === 'resumen' && resumenSubView === 'SHEET' && activeCostSheet === 'materiales' && (
            <ResumenHojaMaterialesPanel
              ship={state.shipSummary?.ship}
              otRows={state.shipSummary?.otRows || []}
              activeOtId={state.shipSummary?.activeOt?.id}
              costScope={costSheetScope}
              materialRows={state.materialRows}
              onSelectSheet={setActiveCostSheet}
              onChangeCostScope={setCostSheetScope}
              onSelectOt={state.setSelectedOtId}
              onBackToSummary={() => setResumenSubView('RESUMEN')}
            />
          )}

          {activeTab === 'resumen' && resumenSubView === 'SHEET' && activeCostSheet === 'horas' && (
            <ResumenHojaHorasPanel
              ship={state.shipSummary?.ship}
              otRows={state.shipSummary?.otRows || []}
              activeOtId={state.shipSummary?.activeOt?.id}
              costScope={costSheetScope}
              laborRows={state.laborRows}
              onSelectSheet={setActiveCostSheet}
              onChangeCostScope={setCostSheetScope}
              onSelectOt={state.setSelectedOtId}
              onBackToSummary={() => setResumenSubView('RESUMEN')}
            />
          )}

          {activeTab === 'resumen' && resumenSubView === 'SHEET' && activeCostSheet === 'terceros' && (
            <ResumenHojaTercerosPanel
              ship={state.shipSummary?.ship}
              otRows={state.shipSummary?.otRows || []}
              activeOtId={state.shipSummary?.activeOt?.id}
              costScope={costSheetScope}
              thirdPartyRows={state.thirdPartyRows}
              onSelectSheet={setActiveCostSheet}
              onChangeCostScope={setCostSheetScope}
              onSelectOt={state.setSelectedOtId}
              onBackToSummary={() => setResumenSubView('RESUMEN')}
            />
          )}

          {activeTab === 'comparador' && (
            <ComparadorObrasCanvasPanel
              comparatorData={state.comparatorData}
              savedViews={state.data?.comparatorSavedViews || []}
              activeShipId={state.selectedShipId}
              onSaveAdhocArea={state.handleSaveAdhocArea}
              onSavePresetView={state.handleSavePresetView}
              onDeletePresetView={state.handleDeletePresetView}
            />
          )}

          {activeTab === 'remito' && (
            <RemitoComercialAlfaPanel
              ship={state.shipSummary?.ship}
              shipStays={state.data?.shipStays || []}
              workOrders={state.data?.workOrders || []}
              shipSummary={state.shipSummary}
              materialRows={state.materialRows}
              craneHours={state.shipSummary?.craneHours || {}}
              alfaRateCard={state.data?.alfaRateCard || []}
              remitoState={state.data?.remitosByShip?.[state.selectedShipId] || null}
              onPersistCellChange={state.handlePersistRemitoCellChange}
              onPersistRowAction={state.handlePersistRemitoRowAction}
              onSaveAlfaRateCard={state.handleSaveAlfaRateCard}
              showFeedback={state.showFeedback}
            />
          )}
        </>
      )}
    </div>
  )
}
