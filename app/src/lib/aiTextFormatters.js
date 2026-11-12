import {
  normalizeText,
  canonicalizeRubroLabel,
  parseWorkerTrades
} from './tradesCatalog.js'
import {
  DEFAULT_SYSTEM_PROMPTS,
  getNavalDictionary
} from './aiPrompts.js'

// ============================================================================
// CORRECCIÓN ORTOGRÁFICA CONSERVADORA (RN-09)
// ============================================================================
export function applyConservativeSpellingCorrection(text = '', dict = {}) {
  if (!text) return ''
  let result = String(text).trim()
  const corrections = dict.spellingCorrections || {}

  Object.entries(corrections).forEach(([wrong, right]) => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi')
    result = result.replace(regex, right)
  })

  // Limpiar espacios múltiples y poner mayúscula inicial
  result = result.replace(/\s+/g, ' ').trim()
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1)
  }
  return result
}

// ============================================================================
// INFERENCIA DE RUBRO SEGÚN DESCRIPCIÓN DE TAREA (RN-08)
// ============================================================================
export function inferRubroFromTaskText(taskText = '', fallbackRubro = '') {
  const norm = normalizeText(taskText)
  if (
    norm.includes('SOLDAD') ||
    norm.includes('PARCHE') ||
    norm.includes('TRANCALIN') ||
    norm.includes('REJILLA') ||
    norm.includes('REGUILLA') ||
    norm.includes('BACHA') ||
    norm.includes('PARRILLA') ||
    norm.includes('CHAPA')
  ) {
    if (norm.includes('SOLDAD')) return 'Soldadura'
    return 'Calderería'
  }
  if (norm.includes('MANIOBR') || norm.includes('PRUEBA NAVEG') || norm.includes('VARAD')) {
    return 'Maniobras y varada'
  }
  if (
    norm.includes('POLIURETANO') ||
    norm.includes('PORURIETANO') ||
    norm.includes('CEMENT') ||
    norm.includes('COMENTANDO') ||
    norm.includes('SENTINA') ||
    norm.includes('CENTINA') ||
    norm.includes('RASCHIN') ||
    norm.includes('PORTON') ||
    norm.includes('MATAFUEGO') ||
    norm.includes('BODEGA') ||
    norm.includes('ACHIQUE') ||
    norm.includes('LIMPIEZ')
  ) {
    return 'Raschinear'
  }
  if (norm.includes('PINT') || norm.includes('ARENAD')) return 'Pintura'
  if (norm.includes('MECAN') || norm.includes('VALVUL') || norm.includes('HELICE') || norm.includes('EJE') || norm.includes('MOTOR')) return 'Mecánica'
  if (norm.includes('CARPINT') || norm.includes('MADERA')) return 'Carpintería naval'
  if (norm.includes('ELECTR') || norm.includes('CABLE') || norm.includes('TABLERO')) return 'Electricidad'
  return fallbackRubro || 'General'
}

// ============================================================================
// MOTOR LOCAL DETERMINÍSTICO DE PARTES DE CUADRILLA (Respaldo Instantáneo)
// ============================================================================
export function parseCrewMessageLocally(rawMessage = '', { workers = [], ships = [], prompts = [] } = {}) {
  const dict = getNavalDictionary(prompts)
  const cleanMsg = String(rawMessage || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleanMsg) return { canal_detectado: 'astillero_general', resumen_agente: 'Mensaje vacío', tareas: [] }

  // 1. Construir mapa de primeros nombres / apellidos / apodos de operarios conocidos
  const astilleroWorkers = workers.filter(w => (w.admin_center || 'ASTILLERO') === 'ASTILLERO' || !w.admin_center)
  const workerTokensMap = new Map()

  // Registrar apodos explícitos del diccionario primero
  Object.entries(dict.workerNicknames || {}).forEach(([nick, canonical]) => {
    workerTokensMap.set(normalizeText(nick), canonical)
  })

  astilleroWorkers.forEach(w => {
    const fullName = w.name || ''
    const parts = fullName.split(',').map(s => s.trim())
    const lastName = parts[0] || ''
    const firstNames = (parts[1] || '').split(/\s+/).filter(Boolean)

    // Si el nombre de pila o último nombre de pila no está en el mapa, agregarlo
    firstNames.forEach(fn => {
      const key = normalizeText(fn)
      if (key.length >= 3 && !workerTokensMap.has(key)) {
        workerTokensMap.set(key, fullName)
      }
    })
    if (lastName) {
      const lKey = normalizeText(lastName)
      if (lKey.length >= 4 && !workerTokensMap.has(lKey)) {
        workerTokensMap.set(lKey, fullName)
      }
    }
  })

  // 2. Construir lista de barcos conocidos (los de la base + alias del diccionario)
  const shipAliasEntries = Object.entries(dict.shipAliases || {})
  ships.forEach(s => {
    if (s.name) {
      shipAliasEntries.push([normalizeText(s.name), s.name])
    }
  })
  // Ordenar de más largo a más corto para que "DON VICENTE VUOSO" o "DON ANTONIO" matcheen antes que "ANTONIO"
  shipAliasEntries.sort((a, b) => b[0].length - a[0].length)

  const matchShipInText = (segmentText) => {
    const normSeg = normalizeText(segmentText)
    for (const [aliasNorm, canonicalShip] of shipAliasEntries) {
      const keyNorm = normalizeText(aliasNorm)
      const regex = new RegExp(`(?:\\b|^)${keyNorm}(?:\\b|$)`, 'i')
      if (regex.test(normSeg)) {
        return { matchedAlias: aliasNorm, canonicalShip }
      }
    }
    return null
  }

  // 3. Tokenizar para detectar dónde empieza cada grupo de operarios
  const words = cleanMsg.split(' ')
  const isConnector = (w) => ['Y', 'E', ','].includes(normalizeText(w).replace(/[.,;]/g, ''))
  const resolveWordAsWorker = (w) => {
    const norm = normalizeText(w).replace(/[.,;:]/g, '')
    // Evitar confundir parte de "don Antonio" o "don Vicente" con un operario
    if (!norm || norm === 'DON' || norm === 'SAN') return null
    return workerTokensMap.get(norm) || null
  }

  const groups = []
  let i = 0
  while (i < words.length) {
    const prevWordNorm = i > 0 ? normalizeText(words[i - 1]) : ''
    const workerMatch = prevWordNorm !== 'DON' ? resolveWordAsWorker(words[i]) : null

    if (workerMatch) {
      const groupWorkers = [{ mentioned: words[i].replace(/[.,]/g, ''), canonical: workerMatch }]
      let j = i + 1
      while (j < words.length) {
        if (isConnector(words[j]) && j + 1 < words.length && resolveWordAsWorker(words[j + 1])) {
          groupWorkers.push({
            mentioned: words[j + 1].replace(/[.,]/g, ''),
            canonical: resolveWordAsWorker(words[j + 1])
          })
          j += 2
        } else if (resolveWordAsWorker(words[j]) && normalizeText(words[j - 1]) !== 'DON') {
          groupWorkers.push({
            mentioned: words[j].replace(/[.,]/g, ''),
            canonical: resolveWordAsWorker(words[j])
          })
          j += 1
        } else {
          break
        }
      }
      groups.push({
        workers: groupWorkers,
        startWordIdx: i,
        bodyStartWordIdx: j
      })
      i = j
    } else {
      i++
    }
  }

  // Si no se detectaron nombres al inicio, tratar todo el mensaje como un único bloque
  if (groups.length === 0) {
    groups.push({
      workers: [{ mentioned: '', canonical: '' }],
      startWordIdx: 0,
      bodyStartWordIdx: 0
    })
  }

  const extractedTasks = []

  // 4. Para cada grupo de operarios, extraer su cuerpo de texto y dividirlo en subtareas por menciones de horas
  groups.forEach((grp, idx) => {
    const endWordIdx = idx + 1 < groups.length ? groups[idx + 1].startWordIdx : words.length
    const bodyText = words.slice(grp.bodyStartWordIdx, endWordIdx).join(' ').trim()
    const rawGroupBlock = words.slice(grp.startWordIdx, endWordIdx).join(' ').trim()

    const hourRegex = /(\d+(?:[.,]\d+)?)\s*(?:hs?|hrs?|horas?)\b/gi
    const hourMatches = [...bodyText.matchAll(hourRegex)]

    let subTasks = []

    if (hourMatches.length <= 1) {
      const hoursVal = hourMatches.length === 1 ? parseFloat(hourMatches[0][1].replace(',', '.')) : 9
      const textWithoutHours = bodyText.replace(hourRegex, ' ').replace(/\s+/g, ' ').trim()
      const shipMatch = matchShipInText(textWithoutHours)

      let obsClean = textWithoutHours
      if (shipMatch) {
        const shipRemRegex = new RegExp(`(?:\\ben\\s+)?\\b${shipMatch.matchedAlias}\\b`, 'gi')
        obsClean = obsClean.replace(shipRemRegex, ' ').replace(/\s+/g, ' ').trim()
      }

      subTasks.push({
        raw_subblock: rawGroupBlock,
        ship: shipMatch?.canonicalShip || '',
        hours: hoursVal,
        observation: applyConservativeSpellingCorrection(obsClean || textWithoutHours, dict)
      })
    } else {
      let cursor = 0
      let lastKnownShip = ''

      for (let mIdx = 0; mIdx < hourMatches.length; mIdx++) {
        const match = hourMatches[mIdx]
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length
        const hoursVal = parseFloat(match[1].replace(',', '.')) || 0

        const textBefore = bodyText.slice(cursor, matchStart).trim()

        if (textBefore.length > 0) {
          const shipInBefore = matchShipInText(textBefore)
          if (shipInBefore) lastKnownShip = shipInBefore.canonicalShip

          let obsClean = textBefore
          if (shipInBefore) {
            const shipRemRegex = new RegExp(`(?:\\ben\\s+)?\\b${shipInBefore.matchedAlias}\\b`, 'gi')
            obsClean = obsClean.replace(shipRemRegex, ' ').replace(/\s+/g, ' ').trim()
          }

          subTasks.push({
            raw_subblock: `${textBefore} ${match[0]}`,
            ship: shipInBefore?.canonicalShip || lastKnownShip,
            hours: hoursVal,
            observation: applyConservativeSpellingCorrection(obsClean, dict)
          })
          cursor = matchEnd
        } else {
          const nextMatchStart = mIdx + 1 < hourMatches.length ? hourMatches[mIdx + 1].index : bodyText.length
          const textAfter = bodyText.slice(matchEnd, nextMatchStart).trim()

          const shipInAfter = matchShipInText(textAfter)
          if (shipInAfter) lastKnownShip = shipInAfter.canonicalShip

          let obsClean = textAfter
          if (shipInAfter) {
            const shipRemRegex = new RegExp(`(?:\\ben\\s+)?\\b${shipInAfter.matchedAlias}\\b`, 'gi')
            obsClean = obsClean.replace(shipRemRegex, ' ').replace(/\s+/g, ' ').trim()
          }

          subTasks.push({
            raw_subblock: `${match[0]} ${textAfter}`,
            ship: shipInAfter?.canonicalShip || lastKnownShip,
            hours: hoursVal,
            observation: applyConservativeSpellingCorrection(obsClean, dict)
          })
          cursor = nextMatchStart
        }
      }
    }

    // Expandir cada subtarea por cada operario del grupo (RN-03: multiplicación en paralelo)
    subTasks.forEach(st => {
      grp.workers.forEach(w => {
        extractedTasks.push({
          raw_block: st.raw_subblock,
          operario_canonico: w.canonical,
          operario_mencionado: w.mentioned,
          barco_mencionado: st.ship,
          ot_sugerida: '',
          rubro: inferRubroFromTaskText(st.observation, ''),
          horas: st.hours,
          observacion: st.observation
        })
      })
    })
  })

  return {
    canal_detectado: 'astillero_general',
    resumen_agente: `Se extrajeron ${extractedTasks.length} imputaciones de cuadrilla (${groups.length} bloques de grupo) con prioridad en división de subtareas.`,
    tareas: extractedTasks
  }
}

// ============================================================================
// VALIDACIÓN CRUZADA E4a (Operarios/Homónimos) + E4b (Barco/OT Habilitada) + E5/E6
// ============================================================================
export function validateAndEnrichExtractedTasks(
  rawTasks = [],
  { workers = [], ships = [], workOrders = [], workItems = [], prioritizeDivision = true } = {}
) {
  const dict = JSON.parse(DEFAULT_SYSTEM_PROMPTS[3].prompt_template)

  const woById = {}
  workOrders.forEach(wo => {
    woById[wo.id] = wo
  })

  // 1. Validar cada fila (E4a + E4b)
  const enrichedRows = rawTasks.map((task, idx) => {
    const warnings = []
    let needsReview = false

    // --- E4a: Matching de Operario y Homónimos (RN-04) ---
    const mentionedNorm = normalizeText(task.operario_mencionado || task.operario_canonico || '')
    const canonicalNorm = normalizeText(task.operario_canonico || '')

    const candidateWorkers = workers.filter(w => {
      const wNorm = normalizeText(w.name)
      if (!mentionedNorm && !canonicalNorm) return false
      if (canonicalNorm && wNorm === canonicalNorm) return true
      if (mentionedNorm && mentionedNorm.length >= 3) {
        const tokens = wNorm.split(/[\s,]+/).filter(Boolean)
        return tokens.includes(mentionedNorm) || wNorm.includes(mentionedNorm)
      }
      return false
    })

    const firstNameToken = mentionedNorm.split(/\s+/)[0]
    const homonymMatches = firstNameToken && firstNameToken.length >= 3
      ? workers.filter(w => {
          const tokens = normalizeText(w.name).split(/[\s,]+/).filter(Boolean)
          return tokens.includes(firstNameToken)
        })
      : candidateWorkers

    let matchedWorker =
      workers.find(w => normalizeText(w.name) === canonicalNorm) ||
      candidateWorkers[0] ||
      homonymMatches[0] ||
      null

    const inferredTaskRubro = inferRubroFromTaskText(task.observacion || '', task.rubro || '')

    let unresolvedHomonyms = []
    if (homonymMatches.length > 1) {
      const matchingByRubro = homonymMatches.filter(hw => {
        const { labelList } = parseWorkerTrades(hw.trade || hw.defaultRubro || '')
        return labelList.some(l => normalizeText(l) === normalizeText(inferredTaskRubro))
      })

      if (matchingByRubro.length === 1) {
        matchedWorker = matchingByRubro[0]
      } else if (matchingByRubro.length > 1) {
        matchedWorker = matchingByRubro[0]
        unresolvedHomonyms = matchingByRubro.map(hw => hw.name)
        warnings.push(`Homónimo en el mismo rubro (${unresolvedHomonyms.join(' / ')}). Verificá cuál operario corresponde.`)
      } else {
        unresolvedHomonyms = homonymMatches.map(hw => hw.name)
        warnings.push(`Homónimo detectado (${unresolvedHomonyms.join(' / ')}).`)
      }
    }

    const workerName = matchedWorker ? matchedWorker.name : (task.operario_canonico || task.operario_mencionado || '')
    if (!matchedWorker) {
      needsReview = true
      warnings.push(`Operario "${workerName || 'S/D'}" no encontrado en el Padrón activo.`)
    }

    const workerCenter = (matchedWorker?.admin_center || 'ASTILLERO').toUpperCase()
    const workerType = workerCenter === 'TALLER' ? 'Taller' : workerCenter === 'CONTRATISTA' ? 'Contratista' : 'Astillero'
    const workerTradesInfo = parseWorkerTrades(matchedWorker?.trade || matchedWorker?.defaultRubro || 'General')
    const defaultWorkerRubro = workerTradesInfo.primaryLabel

    const finalRubro = canonicalizeRubroLabel(task.rubro || inferredTaskRubro || defaultWorkerRubro)
    const isLoanedRubro =
      workerType === 'Astillero' &&
      defaultWorkerRubro &&
      defaultWorkerRubro !== 'General' &&
      normalizeText(finalRubro) !== normalizeText(defaultWorkerRubro)

    // --- E4b: Matching de Barco (RN-05) ---
    const rawShipName = task.barco_mencionado || ''
    const normRawShip = normalizeText(rawShipName)
    const mappedShipAlias = dict.shipAliases?.[normRawShip] || rawShipName
    const normMappedShip = normalizeText(mappedShipAlias)

    let matchedShip = ships.find(s => normalizeText(s.name) === normMappedShip || normalizeText(s.name) === normRawShip)
    if (!matchedShip && normMappedShip) {
      matchedShip = ships.find(
        s => normalizeText(s.name).includes(normMappedShip) || normMappedShip.includes(normalizeText(s.name))
      )
    }

    if (!matchedShip && rawShipName) {
      warnings.push(`El barco "${rawShipName}" no está aún dado de alta o activo en la lista de Barcos. Podés seleccionarlo o crearlo.`)
      needsReview = true
    }

    // --- E4b: Matching de OT por Habilitación Real y Palabras Clave (RN-06 & DEC-005) ---
    let selectedWoId = ''
    let selectedWorkItemId = ''
    let candidateOts = []
    let otMatchStatus = 'none'

    if (matchedShip) {
      const shipWos = workOrders.filter(wo => wo.ship_id === matchedShip.id && wo.status !== 'Cancelada')
      const shipActiveItems = workItems.filter(item => {
        const wo = woById[item.work_order_id]
        if (!wo || wo.ship_id !== matchedShip.id || item.status !== 'En ejecución') return false
        const list = item.contractors || []
        if (workerType === 'Astillero') {
          return list.length === 0 || list.some(c => normalizeText(c).startsWith('ASTILLERO'))
        }
        return list.some(c => normalizeText(c) === normalizeText(matchedWorker?.work_group || workerName))
      })

      const enabledWoIds = new Set(shipActiveItems.map(i => i.work_order_id))
      const enabledWos = shipWos.filter(w => enabledWoIds.has(w.id))

      const obsTokens = normalizeText(task.observacion || '')
        .split(/\s+/)
        .filter(t => t.length >= 4 && !['PARA', 'COMO', 'DESDE', 'HASTA', 'SOBRE'].includes(t))

      const scoredWos = enabledWos.map(wo => {
        const itemsForWo = shipActiveItems.filter(i => i.work_order_id === wo.id)
        const combinedText = normalizeText(
          `${wo.ot_number || ''} ${wo.title || ''} ${wo.description || ''} ${itemsForWo.map(i => `${i.description || ''} ${(i.contractors || []).join(' ')}`).join(' ')}`
        )

        let score = 0
        obsTokens.forEach(tok => {
          if (combinedText.includes(tok)) score += 3
        })
        const rubroNorm = normalizeText(finalRubro).slice(0, 6)
        if (rubroNorm && combinedText.includes(rubroNorm)) {
          score += 2
        }
        if (task.ot_sugerida && combinedText.includes(normalizeText(task.ot_sugerida))) {
          score += 5
        }

        return {
          wo,
          workItem: itemsForWo[0] || null,
          score
        }
      })

      scoredWos.sort((a, b) => b.score - a.score)
      candidateOts = scoredWos.map(s => s.wo)

      if (scoredWos.length === 1) {
        selectedWoId = scoredWos[0].wo.id
        selectedWorkItemId = scoredWos[0].workItem?.id || ''
        otMatchStatus = scoredWos[0].score > 0 ? 'keywords' : 'single_enabled'
      } else if (scoredWos.length > 1) {
        const topScore = scoredWos[0].score
        const topMatches = scoredWos.filter(s => s.score === topScore)
        if (topScore > 0 && topMatches.length === 1) {
          selectedWoId = topMatches[0].wo.id
          selectedWorkItemId = topMatches[0].workItem?.id || ''
          otMatchStatus = 'keywords'
        } else {
          selectedWoId = scoredWos[0].wo.id
          selectedWorkItemId = scoredWos[0].workItem?.id || ''
          otMatchStatus = 'multiple_ambiguous'
          warnings.push(
            `Hay ${scoredWos.length} OTs habilitadas posibles en ${matchedShip.name}. Confirmá la OT en el desplegable.`
          )
        }
      } else {
        if (workItems.length === 0 && shipWos.length > 0) {
          selectedWoId = shipWos[0].id
          candidateOts = shipWos
          otMatchStatus = 'single_enabled'
        } else {
          otMatchStatus = 'no_enabled_ot'
          needsReview = true
          warnings.push(`No hay OTs "En ejecución" habilitadas en ${matchedShip.name}.`)
        }
      }
    }

    // --- E5: Cálculo de horas por fila ---
    const rawHours = parseFloat(task.horas) || (workerType === 'Astillero' ? 9 : 8)

    return {
      id: Date.now() + idx + Math.random(),
      raw_block: task.raw_block || '',
      worker_name: workerName,
      worker_type: workerType,
      default_rubro: defaultWorkerRubro,
      allowed_trades: workerTradesInfo.labelList,
      rubro: finalRubro,
      is_loaned_rubro: isLoanedRubro,
      ship_id: matchedShip?.id || '',
      ship_name_raw: mappedShipAlias || rawShipName || '',
      work_order_id: selectedWoId,
      work_item_id: selectedWorkItemId,
      candidate_ot_ids: candidateOts.map(w => w.id),
      ot_match_status: otMatchStatus,
      homonym_candidates: unresolvedHomonyms,
      hours_raw: rawHours,
      hours_normal: rawHours,
      hours_extra_50: 0,
      hours_extra_100: 0,
      notes: task.observacion || '',
      needs_review: needsReview,
      review_warnings: warnings
    }
  })

  // 2. Regla E6 (Consolidación vs. División Prioritaria)
  let processedRows = enrichedRows
  if (!prioritizeDivision) {
    const consolidatedMap = new Map()
    enrichedRows.forEach(row => {
      const key = `${row.worker_name}__${row.ship_id || row.ship_name_raw}__${row.work_order_id}__${row.rubro}`
      if (row.work_order_id && consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key)
        existing.hours_raw += row.hours_raw
        existing.hours_normal = existing.hours_raw
        if (row.notes && !existing.notes.includes(row.notes)) {
          existing.notes = `${existing.notes} / ${row.notes}`
        }
      } else {
        consolidatedMap.set(`${key}__${Math.random()}`, { ...row })
      }
    })
    processedRows = Array.from(consolidatedMap.values())
  }

  // 3. Regla E5 (Distribución de Horas Normales / 50% / 100% acumulada por operario en el día)
  const workerDailyAccumulator = {}
  const finalRows = processedRows.map(row => {
    const wKey = row.worker_name || `anon_${row.id}`
    if (!workerDailyAccumulator[wKey]) {
      workerDailyAccumulator[wKey] = 0
    }

    const prevAccum = workerDailyAccumulator[wKey]
    const h = parseFloat(row.hours_raw) || 0
    workerDailyAccumulator[wKey] = prevAccum + h

    if (row.worker_type !== 'Astillero') {
      return {
        ...row,
        hours_normal: h,
        hours_extra_50: 0,
        hours_extra_100: 0
      }
    }

    const isFeriado = normalizeText(row.rubro).includes('FERIADO')
    const dailyTarget = isFeriado ? 8 : 9

    const normalAvailable = Math.max(0, dailyTarget - prevAccum)
    const hNorm = Math.min(h, normalAvailable)
    const remainingForExtra = Math.max(0, h - hNorm)

    const prevExtra = Math.max(0, prevAccum - dailyTarget)
    const extra50Available = Math.max(0, 4 - prevExtra)
    const h50 = Math.min(remainingForExtra, extra50Available)
    const h100 = Math.max(0, remainingForExtra - h50)

    return {
      ...row,
      hours_normal: Number(hNorm.toFixed(2)),
      hours_extra_50: Number(h50.toFixed(2)),
      hours_extra_100: Number(h100.toFixed(2))
    }
  })

  return finalRows
}
