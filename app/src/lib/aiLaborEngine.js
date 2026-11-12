import { supabase } from './supabase.js'
import {
  OFFICIAL_RUBROS_CATALOG,
  normalizeText,
  canonicalizeRubroLabel,
  parseWorkerTrades
} from './tradesCatalog.js'
import {
  DEFAULT_SYSTEM_PROMPTS,
  STORAGE_KEY_PROMPTS,
  STORAGE_KEY_AI_CONFIG,
  STORAGE_KEY_AI_LOGS,
  loadAiProviderConfig,
  saveAiProviderConfig,
  loadSystemPrompts,
  saveSystemPrompt,
  loadAiProcessingLogs,
  recordAiProcessingLog,
  getNavalDictionary
} from './aiPrompts.js'
import {
  applyConservativeSpellingCorrection,
  inferRubroFromTaskText,
  parseCrewMessageLocally,
  validateAndEnrichExtractedTasks
} from './aiTextFormatters.js'

// ============================================================================
// RE-EXPORTACIONES PARA RETROCOMPATIBILIDAD ABSOLUTA
// ============================================================================
export {
  OFFICIAL_RUBROS_CATALOG,
  normalizeText,
  canonicalizeRubroLabel,
  parseWorkerTrades,
  DEFAULT_SYSTEM_PROMPTS,
  STORAGE_KEY_PROMPTS,
  STORAGE_KEY_AI_CONFIG,
  STORAGE_KEY_AI_LOGS,
  loadAiProviderConfig,
  saveAiProviderConfig,
  loadSystemPrompts,
  saveSystemPrompt,
  loadAiProcessingLogs,
  recordAiProcessingLog,
  getNavalDictionary,
  applyConservativeSpellingCorrection,
  inferRubroFromTaskText,
  parseCrewMessageLocally,
  validateAndEnrichExtractedTasks
}

// ============================================================================
// FUNCIÓN PRINCIPAL: TABULAR MENSAJE (HÍBRIDO OPENAI + LOCAL DETERMINÍSTICO)
// ============================================================================
export async function tabulateCrewMessage(
  rawMessage,
  { workers = [], ships = [], workOrders = [], workItems = [], dateLogged = '', userEmail = '' } = {}
) {
  const config = loadAiProviderConfig()
  const { prompts } = await loadSystemPrompts()
  const astilleroPromptObj = prompts.find(p => p.slug === 'prompt_astillero') || DEFAULT_SYSTEM_PROMPTS[1]
  const dictObj = prompts.find(p => p.slug === 'diccionario_jerga_naval') || DEFAULT_SYSTEM_PROMPTS[3]

  let parsedPayload = null
  let engineUsed = 'local_deterministic'
  let tokensIn = 0
  let tokensOut = 0
  let llmError = null

  // Intentar con OpenAI si el modo es 'hybrid' u 'openai' y existe API Key
  if ((config.mode === 'hybrid' || config.mode === 'openai') && config.apiKey) {
    try {
      const personalStr = workers
        .filter(w => (w.status || 'ACTIVO') === 'ACTIVO')
        .map(w => `- ${w.name} | Grupo: ${w.work_group || 'ASTILLERO'} | Rubro: ${w.trade || w.defaultRubro || 'General'}`)
        .join('\n')

      const barcosStr = ships.map(s => `- ${s.name}`).join('\n')

      const woById = {}
      workOrders.forEach(w => { woById[w.id] = w })
      const shipById = {}
      ships.forEach(s => { shipById[s.id] = s.name })

      const otsStr = workItems
        .filter(i => i.status === 'En ejecución')
        .map(i => {
          const wo = woById[i.work_order_id]
          const sName = wo ? shipById[wo.ship_id] || '' : ''
          return `- Barco: ${sName} | OT: ${wo?.ot_number || ''} ${wo?.title || ''} | Desc: ${i.description || wo?.description || ''} | Habilitados: ${(i.contractors || []).join(', ') || 'ASTILLERO'}`
        })
        .join('\n')

      const rubrosStr = OFFICIAL_RUBROS_CATALOG.map(r => r.label).join(', ')

      const systemPrompt = (astilleroPromptObj.prompt_template || '')
        .replace('<<PERSONAL>>', personalStr || 'Sin datos')
        .replace('<<BARCOS>>', barcosStr || 'Sin datos')
        .replace('<<OTS_ACTIVAS>>', otsStr || 'Sin OTs activas')
        .replace('<<RUBROS>>', rubrosStr)
        .replace('<<DICCIONARIO>>', dictObj.prompt_template || '{}')

      // Intento 1: Supabase Edge Function (Servidor Seguro sin exponer Key)
      let edgeSuccess = false
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('parse-crew-message', {
          body: {
            rawMessage,
            systemPrompt,
            model: config.model || 'gpt-4o-mini',
            temperature: Number(config.temperature ?? 0)
          }
        })
        if (!edgeErr && edgeData?.parsedPayload && Array.isArray(edgeData.parsedPayload.tareas) && edgeData.parsedPayload.tareas.length > 0) {
          parsedPayload = edgeData.parsedPayload
          tokensIn = edgeData.tokensIn || 0
          tokensOut = edgeData.tokensOut || 0
          engineUsed = 'supabase_edge_openai'
          edgeSuccess = true
        }
      } catch (e) {
        // Edge Function no configurada aún, continuar con llamada cliente
      }

      // Intento 2: Llamada cliente directa con API Key
      if (!edgeSuccess) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey.trim()}`
          },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            temperature: Number(config.temperature ?? 0),
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Mensaje de parte diario a tabular:\n"""\n${rawMessage}\n"""` }
            ]
          })
        })

        if (!response.ok) {
          const errBody = await response.text()
          throw new Error(`OpenAI HTTP ${response.status}: ${errBody.slice(0, 140)}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        tokensIn = data.usage?.prompt_tokens || 0
        tokensOut = data.usage?.completion_tokens || 0

        if (content) {
          const json = JSON.parse(content)
          if (Array.isArray(json.tareas) && json.tareas.length > 0) {
            parsedPayload = json
            engineUsed = `openai_${config.model || 'gpt-4o-mini'}`
          }
        }
      }
    } catch (err) {
      console.warn('Fallback automático a Motor Determinístico Local:', err)
      llmError = err.message
    }
  }

  // Si OpenAI no se usó o falló, ejecutar el Motor Determinístico Local
  if (!parsedPayload) {
    parsedPayload = parseCrewMessageLocally(rawMessage, { workers, ships, prompts })
    engineUsed = llmError ? 'local_fallback' : 'local_deterministic'
  }

  // Ejecutar Validación Cruzada Determinística E4a + E4b + E5 + E6
  const validatedRows = validateAndEnrichExtractedTasks(parsedPayload.tareas || [], {
    workers,
    ships,
    workOrders,
    workItems,
    prioritizeDivision: config.prioritizeTaskDivision !== false
  })

  const reviewCount = validatedRows.filter(
    r => r.needs_review || r.homonym_candidates?.length > 0 || r.ot_match_status === 'multiple_ambiguous'
  ).length

  // Registrar en Bitácora de Auditoría
  const logEntry = await recordAiProcessingLog({
    fecha_reportada: dateLogged || new Date().toISOString().split('T')[0],
    usuario_emisor: userEmail || 'Operador Web',
    mensaje_literal: rawMessage,
    canal_detectado: parsedPayload.canal_detectado || 'astillero_general',
    engine_used: engineUsed,
    prompt_version: astilleroPromptObj.version || 'v2.4',
    total_filas: validatedRows.length,
    filas_review: reviewCount,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    resumen_agente: parsedPayload.resumen_agente || `Se generaron ${validatedRows.length} filas.`,
    raw_output: parsedPayload
  })

  return {
    rows: validatedRows,
    engineUsed,
    llmError,
    promptVersion: astilleroPromptObj.version || 'v2.4',
    tokensIn,
    tokensOut,
    summary: parsedPayload.resumen_agente || `Se tabularon ${validatedRows.length} filas en la Cuadrilla.`,
    logEntry
  }
}
