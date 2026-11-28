/**
 * TesoreriaContratadosModals.jsx
 * Contenedor de modales reutilizados en `3. Contratados`:
 * - `TesoreriaCcModal` para contratistas en AR$
 * - `TercerosCcPaymentModal` para talleres `FL-026` en US$ (Pampa Naval)
 */
import React from 'react'
import TesoreriaCcModal from '../TesoreriaCcModal'
import TercerosCcPaymentModal from '../../terceros/cc/TercerosCcPaymentModal'

export default function TesoreriaContratadosModals({
  ccModal,
  onCloseCcModal,
  onSaveCcMovement,
  wsPayModal,
  onCloseWsModal,
  onSaveWsPayment,
  selectedEntity = null,
  selectedPeriod = '',
  periods = [],
  fortnightDollarRate = 1500,
  entities = [],
  prcs = [],
  ships = [],
  workOrders = [],
  macroVariables = [],
}) {
  const contractorOptions = entities
    .filter((e) => e.entityType === 'CONTRACTOR')
    .map((e) => ({ id: e.worker?.id || null, name: e.baseGroup }))

  return (
    <>
      <TesoreriaCcModal
        isOpen={ccModal.isOpen}
        initialRow={ccModal.initialRow}
        presetInvoiceOnly={ccModal.presetInvoiceOnly}
        presetDefaults={ccModal.presetDefaults}
        currentPeriod={selectedPeriod}
        availablePeriods={periods}
        fortnightDollarRate={fortnightDollarRate}
        contractors={contractorOptions}
        prcs={prcs}
        ships={ships}
        workOrders={workOrders}
        onClose={onCloseCcModal}
        onSave={onSaveCcMovement}
      />

      <TercerosCcPaymentModal
        isOpen={wsPayModal.isOpen}
        onClose={onCloseWsModal}
        account={selectedEntity?.ccAccount || null}
        editingPayment={wsPayModal.editingPayment}
        macroVariables={macroVariables}
        onSave={onSaveWsPayment}
      />
    </>
  )
}
