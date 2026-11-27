import { stampNewRecordWithFolio } from '../lib/monotonicFolioEngine'
import { syncContractExpiryAlertsService } from '../lib/contractorDeductionsService'
import { buildWorkerGroupSyncPatch, buildWorkerSavePayload } from '../lib/personalNominaFormHelpers'
import {
  persistWorkerWithSchemaFallbackService,
  logWorkerModalSaveAuditService,
  saveOrganizationRolesService
} from '../services/personalNominaService'

export function usePersonalNominaModalActions({
  workers,
  setWorkers,
  dollarRate,
  state,
  applyWorkerSinglePatch
}) {
  const {
    showGridFeedback,
    editingWorker, setEditingWorker,
    setIsNewModalOpen,
    setSavingWorker,
    isCustomGroup, customGroupName, formData,
    rolesFormData, setOrgRoles, setIsRolesModalOpen, setSavingRoles,
    setCustomTrades, newTradeInput, setNewTradeInput,
    targetWorkerForNewTrade, setTargetWorkerForNewTrade, setIsAddTradeModalOpen
  } = state

  const handleSaveSubmit = async (e) => {
    e.preventDefault()
    setSavingWorker(true)
    try {
      const { payload, finalGroup } = buildWorkerSavePayload(formData, {
        isCustomGroup,
        customGroupName,
        dollarRate
      })

      if (editingWorker) {
        const { missingContractCols } = await persistWorkerWithSchemaFallbackService({
          mode: 'update',
          targetId: editingWorker.id,
          payload,
          syncGroup: finalGroup
        })

        const groupPatch = finalGroup !== 'ASTILLERO' ? buildWorkerGroupSyncPatch(payload) : null
        const updatedWorkersList = workers.map((w) => {
          if (w.id === editingWorker.id) return { ...w, ...payload }
          if (groupPatch && w.work_group === finalGroup) return { ...w, ...groupPatch }
          return w
        })
        setWorkers(updatedWorkersList)
        syncContractExpiryAlertsService(updatedWorkersList)
        await logWorkerModalSaveAuditService({ isEdit: true, workerId: editingWorker.id, payload })

        showGridFeedback(
          missingContractCols ? 'info' : 'success',
          missingContractCols
            ? 'Operario actualizado. Ejecutá la migración 0037 en Supabase para guardar Tipo de Contrato y Fecha Inicio.'
            : `Registro de ${payload.name} (${finalGroup}) actualizado con éxito.`,
          3500
        )
        setEditingWorker(null)
      } else {
        const { data, missingContractCols } = await persistWorkerWithSchemaFallbackService({ mode: 'insert', payload, syncGroup: finalGroup })
        const createdObj = data?.[0] || { ...payload, id: Date.now().toString() }
        const newRecord = stampNewRecordWithFolio(createdObj, workers)
        const groupPatch = finalGroup !== 'ASTILLERO' ? buildWorkerGroupSyncPatch(payload) : null
        const updatedWorkersList = [
          newRecord,
          ...(groupPatch ? workers.map((w) => (w.work_group === finalGroup ? { ...w, ...groupPatch } : w)) : workers)
        ]
        setWorkers(updatedWorkersList)
        syncContractExpiryAlertsService(updatedWorkersList)
        await logWorkerModalSaveAuditService({ isEdit: false, workerId: newRecord.id, payload, rowData: payload })

        showGridFeedback(
          missingContractCols ? 'info' : 'success',
          missingContractCols
            ? `Operario ${payload.name} creado. Ejecutá la migración 0037 en Supabase para guardar Contrato.`
            : `Operario ${payload.name} agregado al Grupo ${finalGroup}.`,
          3500
        )
        setIsNewModalOpen(false)
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar: ${err.message}`, 3500)
    } finally {
      setSavingWorker(false)
    }
  }

  const handleSaveRolesSubmit = async (e) => {
    e.preventDefault()
    setSavingRoles(true)
    try {
      const updatedMap = await saveOrganizationRolesService({ rolesFormData })
      if (Object.keys(updatedMap).length > 0) setOrgRoles((prev) => ({ ...prev, ...updatedMap }))
      showGridFeedback('success', 'Titulares de puestos organizacionales actualizados en todo el sistema.', 3500)
      setIsRolesModalOpen(false)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al actualizar puestos: ${err.message}`, 3500)
    } finally {
      setSavingRoles(false)
    }
  }

  const handleAddTradeSubmit = async (e) => {
    e.preventDefault()
    const cleaned = newTradeInput.trim().toUpperCase()
    if (!cleaned) {
      alert('Por favor ingresá el nombre del rubro.')
      return
    }
    setCustomTrades((prev) => Array.from(new Set([...prev, cleaned])))
    if (targetWorkerForNewTrade) {
      await applyWorkerSinglePatch(targetWorkerForNewTrade.id, 'trade', cleaned)
      showGridFeedback('success', `Rubro "${cleaned}" asignado a ${targetWorkerForNewTrade.name}`)
    }
    setIsAddTradeModalOpen(false)
    setNewTradeInput('')
    setTargetWorkerForNewTrade(null)
  }

  return {
    handleSaveSubmit,
    handleSaveRolesSubmit,
    handleAddTradeSubmit
  }
}
