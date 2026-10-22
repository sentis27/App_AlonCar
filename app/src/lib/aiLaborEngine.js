import { supabase } from './supabase'

// ============================================================================
// CATÁLOGO OFICIAL DE RUBROS ESTANDARIZADOS ALON CAR
// ============================================================================
export const OFFICIAL_RUBROS_CATALOG = [
  { code: 'CALDERERIA', label: 'Calderería' },
  { code: 'RASCHINAJE', label: 'Raschinear' },
  { code: 'SOLDADURA', label: 'Soldadura' },
  { code: 'PINTURA', label: 'Pintura' },
  { code: 'MECANICA', label: 'Mecánica' },
  { code: 'CARPINTERIA', label: 'Carpintería naval' },
  { code: 'ELECTRICIDAD', label: 'Electricidad' },
  { code: 'MANIOBRAS', label: 'Maniobras y varada' },
  { code: 'MAQUINARIA', label: 'Maquinaria' },
  { code: 'TORNERIA', label: 'Tornería' },
  { code: 'PRFV', label: 'PRFV / Plásticos' },
  { code: 'PANOLERO', label: 'Pañolero' },
  { code: 'MANDADOS', label: 'Mandados' },
  { code: 'SUPERVISION', label: 'Supervisión' },
  { code: 'FERIADO', label: 'Feriado' }
]

// Normalizar texto sin acentos y en mayúsculas
export function normalizeText(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

// Convertir un código o texto de rubro a su etiqueta legible estándar
export function canonicalizeRubroLabel(raw = '') {
  const norm = normalizeText(raw)
  if (!norm) return 'General'
  if (norm.includes('CALDER')) return 'Calderería'
  if (norm.includes('RASCHIN')) return 'Raschinear'
  if (norm.includes('SOLDAD')) return 'Soldadura'
  if (norm.includes('PINT')) return 'Pintura'
  if (norm.includes('MECAN')) return 'Mecánica'
  if (norm.includes('CARPINT')) return 'Carpintería naval'
  if (norm.includes('ELECTR')) return 'Electricidad'
  if (norm.includes('MANIOBR') || norm.includes('VARAD')) return 'Maniobras y varada'
  if (norm.includes('MAQUIN') || norm.includes('PALA') || norm.includes('GRUA')) return 'Maquinaria'
  if (norm.includes('TORN')) return 'Tornería'
  if (norm.includes('PRFV') || norm.includes('FIBRA')) return 'PRFV / Plásticos'
  if (norm.includes('PANOL')) return 'Pañolero'
  if (norm.includes('MANDAD') || norm.includes('FLETE')) return 'Mandados'
  if (norm.includes('SUPERV') || norm.includes('TECNIC')) return 'Supervisión'
  if (norm.includes('FERIAD')) return 'Feriado'
  return raw.trim()
}

// Desglosar el campo `trade` de un operario/contratista (soporta Multi-Rubro separado por comas)
export function parseWorkerTrades(tradeStr = '') {
  const parts = String(tradeStr || '')
    .split(/[,;/|]+/)
    .map(s => s.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      rawList: ['GENERAL'],
      labelList: ['General'],
      primaryRaw: 'GENERAL',
      primaryLabel: 'General'
    }
  }

  const rawList = parts.map(p => p.toUpperCase())
  const labelList = Array.from(new Set(parts.map(p => canonicalizeRubroLabel(p))))

  return {
    rawList,
    labelList,
    primaryRaw: rawList[0],
    primaryLabel: labelList[0] || 'General'
  }
}

// ============================================================================
// PROMPTS DEL SISTEMA POR DEFECTO (Basados en SDD v3.0 + DEC-004 a DEC-007)
// ============================================================================
export const DEFAULT_SYSTEM_PROMPTS = [
  {
    slug: 'router_clasificador_e3a',
    title: '1. Router Clasificador Jerárquico (E3a — DEC-006)',
    category: 'ROUTER',
    version: 'v2.4',
    model: 'gpt-4o-mini',
    temperature: 0.0,
    description: 'Clasifica el parte diario en 4 reglas determinísticas por prioridad absoluta (astillero_general, maquinista, contratista) y filtra los catálogos inyectados para evitar alucinaciones cruzadas.',
    prompt_template: `REGLAS DEL ROUTER JERÁRQUICO E3a (Prioridad Absoluta - DEC-006):
1. RUBRO EXPLÍCITO (astillero_general): Si el mensaje contiene palabras clave explícitas de rubro o personal propio (raschines, mecánicos, caldereros, carpinteros, pintores, electricistas, soldadura, parches, bodega, cubierta), clasificar como "astillero_general".
2. INICIO CON MÁQUINA (maquinista): Si no hay rubro explícito pero las líneas inician con maquinaria (pala, grúa, retroexcavadora, autoelevador), clasificar como "maquinista".
3. CONTRATISTA EN SUJETO (contratista): Si el mensaje inicia con un grupo contratista externo del catálogo (ej. Tobares, Ramón Aranda, Ávalos, Pintor Juárez) o la palabra "contratista(s)", clasificar como "contratista".
4. DEFAULT: En cualquier otro caso, clasificar como "astillero_general".`
  },
  {
    slug: 'prompt_astillero',
    title: '2. Prompt Maestro: Cuadrillas Astillero (E3b — DEC-007)',
    category: 'EXTRACCION',
    version: 'v2.4',
    model: 'gpt-4o-mini',
    temperature: 0.0,
    description: 'Transforma reportes informales de jefes de grupo en filas estructuradas por operario, barco, OT habilitada, rubro ejecutado y horas, aplicando multiplicación en paralelo y división prioritaria de subtareas.',
    prompt_template: `Eres el motor oficial de interpretación de partes diarios de horas del Astillero Alon Car (SDD v3.0 - DEC-007).
Tu misión es transformar el mensaje redactado en lenguaje natural por un jefe de obra o encargado en un objeto JSON estructurado para poblar la grilla "Cuadrilla de Trabajo".

CATÁLOGOS OFICIALES ACTIVOS EN ESTE MOMENTO:
- PERSONAL ACTIVO (Nombre | Grupo | Rubros):
<<PERSONAL>>

- BARCOS EN OBRA ( más apodos conocidos):
<<BARCOS>>

- ÓRDENES DE TRABAJO (OTs) EN EJECUCIÓN (Barco | Nº OT | Título | Descripción | Contratistas Habilitados):
<<OTS_ACTIVAS>>

- RUBROS OFICIALES:
<<RUBROS>>

- DICCIONARIO DE JERGA NAVAL Y CORRECCIONES:
<<DICCIONARIO>>

REGLAS ESTRICTAS DE NEGOCIO (OBLIGATORIAS):
1. BLINDAJE DE SUJETOS (DEC-007 / RN-04):
   - Mapea cada nombre mencionado (ej. "Luciano", "andres y diego", "franco y enzo higinio") a los nombres canónicos exactos del catálogo PERSONAL ACTIVO.
   - Si hay homónimos (ej. dos "Franco" o dos "Luciano"), elige el que coincida con el rubro de la tarea y devuelve los demás en "homonym_candidates".
   - Frases como "a cargo de..." son contexto de supervisión, NO el operario ejecutor.

2. MULTIPLICACIÓN DE HORAS EN PARALELO (RN-03):
   - Cuando un bloque menciona varios operarios para una tarea o secuencia de tareas (ej. "andres y diego soldadura parches trancalin don Antonio 9hr" o "franco y enzo higinio subir portones vuoso 2hr"), genera una fila individual para CADA operario con esas horas completas (9h a Andrés y 9h a Diego; 2h a Franco, 2h a Enzo y 2h a Higinio).

3. ARRASTRE DE BARCO Y MULTI-TAREA EN EL DÍA (RN-05):
   - Un mismo grupo de operarios puede repartir sus 9 horas diarias en varios bloques/barcos seguidos (ej. "franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación 5 hr en don Antonio bodega sacar porurietano y comentando").
   - Si una subtarea ("2hr maniobra para prueba navegación") no menciona barco nuevo, hereda el barco inmediatamente anterior del bloque ("vuoso"), hasta que aparezca otro barco ("en don Antonio").
   - Si un operario de ASTILLERO tiene una única tarea en el día y no se especificó el número de horas (ej. "Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla"), asígnale por defecto 9 horas normales (RN-01).

4. PRIORIDAD A LA DIVISIÓN DE SUBTAREAS (Regla E5/E6 Alon Car):
   - NO consolides subtareas distintas en una sola fila salvo que la descripción de la OT lo permita explícitamente. Prioriza mantener divididas las subtareas con sus horas individuales (ej. 2h "Subir portones y matafuego" separada de 2h "Maniobra para prueba de navegación" y 5h "Bodega: sacar poliuretano y cementando").

5. RUBRO EJECUTADO Y PUERTA DE EMERGENCIA (RN-08):
   - Infiere el rubro real de la tarea ejecutada (ej. "soldadura parches" -> Soldadura o Calderería; "maniobra para prueba navegación" -> Maniobras y varada; "sacar poliuretano" -> Raschinear). Si no se menciona un oficio distinto, usa el rubro titular del operario.

6. CORRECCIÓN ORTOGRÁFICA CONSERVADORA (RN-09):
   - Corrige errores ortográficos evidentes en español naval dentro del campo "observacion" (ej. "reguillas cuvierta" -> "Rejillas cubierta", "trancalin" -> "trancalín", "porurietano y comentando" -> "poliuretano y cementando"), sin inventar información técnica.

DEVUELVE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "canal_detectado": "astillero_general",
  "resumen_agente": "Resumen breve de lo interpretado",
  "tareas": [
    {
      "raw_block": "fragmento original",
      "operario_canonico": "Apellido, Nombre exacto del catálogo",
      "operario_mencionado": "nombre en el texto",
      "homonym_candidates": [],
      "barco_mencionado": "Nombre del barco detectado",
      "ot_sugerida": "Código o título de OT si coincide con OTS_ACTIVAS, o vacío",
      "rubro": "Rubro oficial ejecutado",
      "horas": 9,
      "observacion": "Descripción limpia con ortografía corregida"
    }
  ]
}`
  },
  {
    slug: 'prompt_contratistas',
    title: '3. Prompt Maestro: Contratistas Externos & Maquinaria (E3b)',
    category: 'EXTRACCION',
    version: 'v2.4',
    model: 'gpt-4o-mini',
    temperature: 0.0,
    description: 'Reglas específicas para grupos contratistas (acumulación N personas × horas sin tope de 9h, soporte multi-rubro) y operadores de maquinaria.',
    prompt_template: `REGLAS ESPECÍFICAS PARA CONTRATISTAS EXTERNOS Y MAQUINARIA (SDD Sección 14 & RN-01):
1. SIN TOPE DE HORAS EXTRA (E5): Los contratistas externos facturan por horas totales sin régimen de 50%/100%. Todas las horas reportadas van a "hours_normal".
2. MULTI-RUBRO DE CONTRATISTA: Si un contratista tiene múltiples rubros habilitados en el Padrón (ej. CALDERERIA, SOLDADURA), selecciona el rubro que mejor describa la tarea reportada en el mensaje.
3. ACUMULACIÓN N×HS: Si el parte indica "Contratista X: 3 personas 8 hs c/u", se imputa 1 fila al Grupo Contratista X con 24 hs totales (o desglosado por integrante si están nominalizados en el Padrón).`
  },
  {
    slug: 'diccionario_jerga_naval',
    title: '4. Diccionario Naval, Apodos de Barcos y Corrección Ortográfica (RN-09)',
    category: 'DICCIONARIO',
    version: 'v2.4',
    model: 'local+llm',
    temperature: 0.0,
    description: 'Diccionario vivo utilizado tanto por la IA como por el Motor Determinístico Local para normalizar apodos de barcos, errores ortográficos de taller y palabras clave de rubros.',
    prompt_template: JSON.stringify(
      {
        shipAliases: {
          'VUOSO': 'SIEMPRE DON VICENTE',
          'DON VICENTE': 'SIEMPRE DON VICENTE',
          'DON VICENTE VUOSO': 'SIEMPRE DON VICENTE',
          'SIEMPRE DON VICENTE': 'SIEMPRE DON VICENTE',
          'TRITON': 'TRITON',
          'TRITÓN': 'TRITON',
          'DON ANTONIO': 'DON ANTONIO',
          'ANTONIO': 'DON ANTONIO',
          'ITATI': 'VIRGEN DE ITATI',
          'VIRGEN DE ITATI': 'VIRGEN DE ITATI',
          'NONO': 'NONO PASCUAL',
          'NONO PASCUAL': 'NONO PASCUAL',
          'MIS SUENOS': 'MIS SUEÑOS',
          'MIS SUEÑOS': 'MIS SUEÑOS',
          'ASTILLERO': 'ASTILLERO'
        },
        spellingCorrections: {
          'reguillas': 'rejillas',
          'cuvierta': 'cubierta',
          'trancalin': 'trancalín',
          'porurietano': 'poliuretano',
          'poliurietano': 'poliuretano',
          'comentando': 'cementando',
          'centina': 'sentina',
          'baradero': 'varadero',
          'proteccion': 'protección',
          'colocacion': 'colocación',
          'navegacion': 'navegación'
        },
        workerNicknames: {
          'LUCIANO': 'Toledo, Luciano',
          'ANDRES': 'Gari, Mario Andres',
          'DIEGO': 'Rodriguez, Diego',
          'FRANCO': 'Colonga, Franco',
          'ENZO': 'Rodriguez, Enzo',
          'HIGINIO': 'Sostoa Gonzalez, Higinio'
        }
      },
      null,
      2
    )
  }
]

const STORAGE_KEY_PROMPTS = 'aloncar_system_prompts_v1'
const STORAGE_KEY_AI_CONFIG = 'aloncar_ai_provider_config_v1'
const STORAGE_KEY_AI_LOGS = 'aloncar_ai_processing_logs_v1'

// ============================================================================
// CONFIGURACIÓN DEL PROVEEDOR DE IA (OpenAI / Gemini / Groq / Local)
// ============================================================================
export function loadAiProviderConfig() {
  const envOpenAiKey = import.meta.env.VITE_OPENAI_API_KEY || ''
  const defaultConfig = {
    mode: 'hybrid', // 'hybrid' (OpenAI + Respaldo Local) | 'openai' | 'gemini' | 'local'
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.0,
    apiKey: envOpenAiKey,
    hasEnvKey: Boolean(envOpenAiKey),
    autoCorrectSpelling: true,
    prioritizeTaskDivision: true
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_CONFIG)
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw)
    return {
      ...defaultConfig,
      ...parsed,
      apiKey: parsed.apiKey || envOpenAiKey,
      hasEnvKey: Boolean(envOpenAiKey)
    }
  } catch {
    return defaultConfig
  }
}

export function saveAiProviderConfig(newConfig) {
  const merged = {
    ...loadAiProviderConfig(),
    ...newConfig,
    updatedAt: new Date().toISOString()
  }
  localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(merged))
  return merged
}

// ============================================================================
// GESTIÓN DE PROMPTS EN SUPABASE + RESPALDO LOCAL
// ============================================================================
export async function loadSystemPrompts() {
  try {
    const { data, error } = await supabase
      .from('system_prompts')
      .select('*')
      .order('slug', { ascending: true })

    if (!error) {
      if (data && data.length > 0) {
        // Asegurar que estén los 4 prompts base
        const merged = DEFAULT_SYSTEM_PROMPTS.map(def => {
          const found = data.find(d => d.slug === def.slug)
          return found ? { ...def, ...found } : def
        })
        localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(merged))
        return { prompts: merged, source: 'supabase' }
      } else {
        // Tabla recién creada vacía: sembrar automáticamente en Supabase
        await supabase.from('system_prompts').upsert(DEFAULT_SYSTEM_PROMPTS, { onConflict: 'slug' })
        localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(DEFAULT_SYSTEM_PROMPTS))
        return { prompts: DEFAULT_SYSTEM_PROMPTS, source: 'supabase' }
      }
    }
  } catch (err) {
    console.warn('Usando prompts desde caché local:', err)
  }

  try {
    const localRaw = localStorage.getItem(STORAGE_KEY_PROMPTS)
    if (localRaw) {
      const parsed = JSON.parse(localRaw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { prompts: parsed, source: 'local' }
      }
    }
  } catch {
    // ignore
  }

  // Intentar sembrar en Supabase silenciosamente la primera vez
  try {
    await supabase.from('system_prompts').upsert(DEFAULT_SYSTEM_PROMPTS, { onConflict: 'slug' })
  } catch {
    // ignore
  }

  localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(DEFAULT_SYSTEM_PROMPTS))
  return { prompts: DEFAULT_SYSTEM_PROMPTS, source: 'default' }
}

export async function saveSystemPrompt(promptObj) {
  const updated = {
    ...promptObj,
    updated_at: new Date().toISOString()
  }

  // 1. Guardar en caché local inmediatamente
  const current = (await loadSystemPrompts()).prompts
  const nextList = current.map(p => (p.slug === updated.slug ? updated : p))
  if (!nextList.some(p => p.slug === updated.slug)) {
    nextList.push(updated)
  }
  localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(nextList))

  // 2. Persistir en Supabase
  try {
    const { error } = await supabase
      .from('system_prompts')
      .upsert(
        {
          slug: updated.slug,
          title: updated.title,
          category: updated.category || 'HORAS',
          description: updated.description || '',
          prompt_template: updated.prompt_template,
          version: updated.version || 'v2.4',
          model: updated.model || 'gpt-4o-mini',
          temperature: Number(updated.temperature ?? 0),
          is_active: updated.is_active ?? true,
          updated_by: updated.updated_by || 'Administrador',
          updated_at: updated.updated_at
        },
        { onConflict: 'slug' }
      )
    if (error) throw error
    return { ok: true, syncedToDb: true, prompt: updated }
  } catch (err) {
    console.warn('Prompt guardado localmente (tabla remota pendiente de migración):', err)
    return { ok: true, syncedToDb: false, prompt: updated, warning: err.message }
  }
}

// ============================================================================
// BITÁCORA DE AUDITORÍA (LOG_PROCESAMIENTO)
// ============================================================================
export async function loadAiProcessingLogs() {
  try {
    const { data, error } = await supabase
      .from('ai_processing_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error && data && data.length > 0) {
      return data
    }
  } catch {
    // ignore
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_LOGS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function recordAiProcessingLog(entry) {
  const fullEntry = {
    id: `log-${Date.now()}`,
    mensaje_id: `MSG-${Date.now()}`,
    fecha_procesamiento: new Date().toISOString(),
    ...entry
  }

  try {
    const prev = await loadAiProcessingLogs()
    const next = [fullEntry, ...prev].slice(0, 40)
    localStorage.setItem(STORAGE_KEY_AI_LOGS, JSON.stringify(next))
  } catch {
    // ignore
  }

  try {
    await supabase.from('ai_processing_logs').insert([
      {
        mensaje_id: fullEntry.mensaje_id,
        fecha_reportada: fullEntry.fecha_reportada || null,
        usuario_emisor: fullEntry.usuario_emisor || 'Operador Web',
        mensaje_literal: fullEntry.mensaje_literal || '',
        canal_detectado: fullEntry.canal_detectado || 'astillero_general',
        engine_used: fullEntry.engine_used || 'hybrid',
        prompt_version: fullEntry.prompt_version || 'v2.4',
        total_filas: fullEntry.total_filas || 0,
        filas_review: fullEntry.filas_review || 0,
        tokens_in: fullEntry.tokens_in || 0,
        tokens_out: fullEntry.tokens_out || 0,
        resumen_agente: fullEntry.resumen_agente || '',
        raw_output: fullEntry.raw_output || null
      }
    ])
  } catch {
    // ignore
  }

  return fullEntry
}

// ============================================================================
// DICCIONARIO Y CORRECCIÓN ORTOGRÁFICA CONSERVADORA (RN-09)
// ============================================================================
function getNavalDictionary(promptsList = []) {
  const dictPrompt = promptsList.find(p => p.slug === 'diccionario_jerga_naval')
  if (dictPrompt?.prompt_template) {
    try {
      return JSON.parse(dictPrompt.prompt_template)
    } catch {
      // fallback
    }
  }
  return JSON.parse(DEFAULT_SYSTEM_PROMPTS[3].prompt_template)
}

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

// Inferir rubro desde el texto de una tarea cuando el operario hace una tarea específica (RN-08)
export function inferRubroFromTaskText(taskText = '', fallbackRubro = '') {
  const norm = normalizeText(taskText)
  if (norm.includes('SOLDAD') || norm.includes('PARCHE') || norm.includes('TRANCALIN') || norm.includes('REJILLA') || norm.includes('REGUILLA') || norm.includes('BACHA') || norm.includes('PARRILLA') || norm.includes('CHAPA')) {
    if (norm.includes('SOLDAD')) return 'Soldadura'
    return 'Calderería'
  }
  if (norm.includes('MANIOBR') || norm.includes('PRUEBA NAVEG') || norm.includes('VARAD')) {
    return 'Maniobras y varada'
  }
  if (norm.includes('POLIURETANO') || norm.includes('PORURIETANO') || norm.includes('CEMENT') || norm.includes('COMENTANDO') || norm.includes('SENTINA') || norm.includes('CENTINA') || norm.includes('RASCHIN') || norm.includes('PORTON') || norm.includes('MATAFUEGO') || norm.includes('BODEGA') || norm.includes('ACHIQUE') || norm.includes('LIMPIEZ')) {
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
  // Un nuevo grupo de operarios empieza cuando encontramos 1 o más nombres de operarios (conectados opcionalmente por "y", "e", ",")
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

  // 4. Para cada grupo de operarios, extraer su cuerpo de texto y dividirlo en subtareas por menciones de horas ("2hr", "5 hr", "9hr")
  groups.forEach((grp, idx) => {
    const endWordIdx = idx + 1 < groups.length ? groups[idx + 1].startWordIdx : words.length
    const bodyText = words.slice(grp.bodyStartWordIdx, endWordIdx).join(' ').trim()
    const rawGroupBlock = words.slice(grp.startWordIdx, endWordIdx).join(' ').trim()

    // Buscar todas las menciones de horas en bodyText: ej. "9hr", "2hr", "5 hr", "2.5 hs", "3 horas"
    const hourRegex = /(\d+(?:[.,]\d+)?)\s*(?:hs?|hrs?|horas?)\b/gi
    const hourMatches = [...bodyText.matchAll(hourRegex)]

    let subTasks = []

    if (hourMatches.length <= 1) {
      // Una sola tarea para este grupo de operarios
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
      // Múltiples subtareas con horas para el mismo grupo (ej. "subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación 5 hr en don Antonio bodega sacar porurietano y comentando")
      // Segmentar alrededor de cada indicador de horas
      let cursor = 0
      let lastKnownShip = ''

      for (let mIdx = 0; mIdx < hourMatches.length; mIdx++) {
        const match = hourMatches[mIdx]
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length
        const hoursVal = parseFloat(match[1].replace(',', '.')) || 0

        const textBefore = bodyText.slice(cursor, matchStart).trim()

        if (textBefore.length > 0) {
          // El número de horas está al FINAL de la frase (ej. "subir portones y matafuego vuoso 2hr")
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
          // El número de horas está al INICIO de la frase (ej. "2hr maniobra para prueba navegación" o "5 hr en don Antonio bodega sacar porurietano y comentando")
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

  // Mapa de barcos por ID
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

    // Buscar todos los operarios que coincidan con el nombre mencionado (para detectar homónimos reales)
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

    // También buscar por token de nombre de pila aunque el LLM haya devuelto uno de los dos homónimos
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

    // Desambiguar homónimos por rubro si tienen rubros distintos (RN-04 punto 3)
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

    // Rubro final: priorizar el inferido de la tarea si es específico, o el del operario
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
    let otMatchStatus = 'none' // 'exact' | 'keywords' | 'single_enabled' | 'multiple_ambiguous' | 'no_enabled_ot'

    if (matchedShip) {
      const shipWos = workOrders.filter(wo => wo.ship_id === matchedShip.id && wo.status !== 'Cancelada')
      const shipActiveItems = workItems.filter(item => {
        const wo = woById[item.work_order_id]
        if (!wo || wo.ship_id !== matchedShip.id || item.status !== 'En ejecución') return false
        const list = item.contractors || []
        if (workerType === 'Astillero') {
          // Regla Alon Car: cualquier ASTILLERO.* habilita a personal de Astillero
          return list.length === 0 || list.some(c => normalizeText(c).startsWith('ASTILLERO'))
        }
        return list.some(c => normalizeText(c) === normalizeText(matchedWorker?.work_group || workerName))
      })

      // OTs habilitadas en ejecución para este barco
      const enabledWoIds = new Set(shipActiveItems.map(i => i.work_order_id))
      const enabledWos = shipWos.filter(w => enabledWoIds.has(w.id))

      // Puntuar cada OT habilitada según coincidencia de palabras clave con la observación y el rubro
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
        // Bonus si el contratista de la OT coincide con el rubro ejecutado (ej. ASTILLERO.CALDERERIA vs Calderería)
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
          // DEC-005: Empate o múltiples OTs habilitadas -> NO dividir horas, preseleccionar la primera y avisar para confirmación 1-clic
          selectedWoId = scoredWos[0].wo.id
          selectedWorkItemId = scoredWos[0].workItem?.id || ''
          otMatchStatus = 'multiple_ambiguous'
          warnings.push(
            `Hay ${scoredWos.length} OTs habilitadas posibles en ${matchedShip.name}. Confirmá la OT en el desplegable.`
          )
        }
      } else {
        // Si no hay work_items cargados pero sí workOrders en el barco (modo fallback)
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

  // 2. Regla E6 (Consolidación vs. División Prioritaria):
  // "Solo consolida si la descripción de la OT lo permite, sino prioriza la división."
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

  // 3. Regla E5 (Distribución de Horas Normales / 50% / 100% acumulada por operario en el día):
  // Para Astillero: las primeras 9h del día son Normales (8h si es Feriado); excedente hasta 4h -> 50%; resto -> 100%.
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
      // Contratistas: todo va a horas normales sin cap (SDD Sección 14)
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
