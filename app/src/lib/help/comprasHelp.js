/**
 * comprasHelp.js
 * Registro de reglas de negocio y ayudas contextuales para Compras y Proveedores (M4b).
 */

export const COMPRAS_ORDER_STEP_HELP = {
  1: {
    id: 'compras_order_step_1',
    module: 'compras_pedidos',
    step: 1,
    title: 'PASO 1 · DESTINO E IMPUTACIÓN DEL PEDIDO',
    uiBullets: [
      { label: 'Directo a Obra vs. Pañol', text: 'DIRECT imputa el gasto directo a un Barco/OT; VIA_PANOL repone stock general del Astillero; STANDBY queda en espera.' },
      { label: 'OT con Vista Flotante', text: 'Pasá el mouse por la OT para ver su alcance completo; si aún no está abierta podés dejarla en blanco.' }
    ],
    aiRuleContext:
      'Regla de Destino de Compras (M4b): Carga Directa exige un buque distinto de Astillero (OT opcional); Reposición Pañol fija automáticamente barco ASTILLERO y OT STOCK.'
  },
  2: {
    id: 'compras_order_step_2',
    module: 'compras_pedidos',
    step: 2,
    title: 'PASO 2 · MATRIZ DE MATERIALES A COMPRAR',
    uiBullets: [
      { label: 'Catálogo o Material Nuevo', text: 'Buscá sin tildes ni mayúsculas con CanonicalMaterialPicker; si no existe, escribí el nombre nuevo y se marca para alta.' },
      { label: 'Fórmulas en Cantidad y Precio', text: 'Podés escribir fórmulas rápidas (ej. =2*3 o =1500*1.21) en Cantidad y $/U Cotizado.' },
      { label: 'Unidad Oficial', text: 'Se hereda automáticamente del Catálogo de Pañol (m², kg, un., etc.) para mantener consistencia en toda la app.' }
    ],
    aiRuleContext:
      'Regla de Renglones de Compra: Usa CanonicalMaterialPicker con allowFreeText, FormulaNumericInput para cantidad y precio cotizado, y hereda la unidad oficial de materials.'
  },
  3: {
    id: 'compras_order_step_3',
    module: 'compras_pedidos',
    step: 3,
    title: 'PASO 3 · FECHA Y NIVEL DE URGENCIA',
    uiBullets: [
      { label: 'Fecha y Quincena', text: 'La fecha impacta el registro contable y asocia el pedido a la quincena activa.' },
      { label: 'Semáforo de Urgencia', text: 'Sin Apuro (normal) · Próxima Salida de Buque (alerta amarilla) · Urgente (prioridad roja para Compras).' }
    ],
    aiRuleContext:
      'Regla de Cronograma y Urgencia de Compras: Todo pedido nace con estado PEDIR, observations (nunca notes) y prioridad SIN_APURO / PROXIMA_SALIDA / URGENTE.'
  }
}

export const COMPRAS_SUPPLIER_STEP_HELP = {
  1: {
    id: 'compras_supplier_step_1',
    module: 'compras_proveedores',
    step: 1,
    title: 'PASO 1 · RAZÓN SOCIAL Y RUBROS',
    uiBullets: [
      { label: 'Rubros de Suministro', text: 'Seleccioná todos los rubros que provee la firma para que aparezca sugerido al cotizar en Compras.' },
      { label: 'Proveedor Local MDP', text: 'Tildarlo habilita al proveedor en el módulo de Mandados Rápidos locales.' }
    ],
    aiRuleContext:
      'Regla de Proveedores (M4b): Nombre en MAYÚSCULAS, uno o más rubros en trades/trade y flag is_local_supplier para despacho de mandados.'
  },
  2: {
    id: 'compras_supplier_step_2',
    module: 'compras_proveedores',
    step: 2,
    title: 'PASO 2 · DATOS FISCALES Y CONTACTO',
    uiBullets: [
      { label: 'WhatsApp de Pedidos', text: 'El teléfono se formatea automáticamente para emitir lotes de pedidos por WhatsApp desde Compras.' }
    ],
    aiRuleContext:
      'Regla de Contacto de Proveedores: Almacena CUIT, dirección, teléfono WhatsApp, email y contacto de mostrador para emisión de órdenes.'
  },
  3: {
    id: 'compras_supplier_step_3',
    module: 'compras_proveedores',
    step: 3,
    title: 'PASO 3 · CONDICIÓN DE PAGO Y OBSERVACIONES',
    uiBullets: [
      { label: 'Cuenta Corriente y N° Cliente', text: 'Registrá la modalidad de pago pactada y el número de cliente de AlonCar para agilizar pedidos y conciliación.' }
    ],
    aiRuleContext:
      'Regla Comercial de Proveedores: Persiste payment_method, client_number y observations en la tabla suppliers con auditoría.'
  }
}
