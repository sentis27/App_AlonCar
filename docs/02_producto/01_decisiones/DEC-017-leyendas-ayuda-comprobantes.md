# DEC-017: Leyendas de ayuda interactiva (Tooltips) para Tipos de Comprobante

## Contexto y Problema
Durante la carga de gastos de terceros, la selección incorrecta del "Tipo de Comprobante" (PRC, RMO, RPF, etc.) genera errores contables, desvirtúa el estado de deuda con el proveedor y requiere constantes correcciones o re-capacitación del personal administrativo.

## Decisión de Producto
Se implementará una asistencia contextual interactiva (Helper text o Tooltips descriptivos) en el frontend. Cuando un usuario interactúe con el selector desplegable (Dropdown) de "Tipo de Comprobante", el sistema mostrará inmediatamente una leyenda explicativa que detallará el caso de uso exacto geográfico/administrativo y su orden lógico evolutivo.

## Diseño Funcional (Textos a inyectar en UI)
- Al hacer hover o seleccionar **PRC**:
  > *"Uso: Todo trabajo realizado por terceros EN PLANTA (tengan precio previo o posterior). Evolución: Ninguna (siempre es PRC)."*
- Al hacer hover o seleccionar **RMO**:
  > *"Uso: Trabajos que el tercero realiza EN SU PROPIO TALLER. Se entrega remito como constancia. Evolución: Finaliza en FCR (Factura) o SDT (Sin Doc)."*
- Al hacer hover o seleccionar **RPF**:
  > *"Uso: Trabajo con remito que genera alerta para RECLAMAR FACTURA al proveedor. Evolución obligatoria: FCR."*
- Al hacer hover o seleccionar **FCR**:
  > *"Uso: Factura oficial cargada. Estado definitivo."*
- Al hacer hover o seleccionar **SDT**:
  > *"Uso: El proveedor no aportará factura. Estado definitivo."*

## Beneficios
1. **Poka-Yoke (A prueba de errores):** El usuario sabe exactamente qué implicancias tiene lo que está eligiendo en el momento de la carga (ej. distinguir si es en planta o fuera de planta).
2. **Onboarding pasivo:** Reduce drásticamente la necesidad de capacitación al personal administrativo nuevo. El sistema se explica a sí mismo.
