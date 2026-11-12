import { supabase } from './supabase.js'

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

export const STORAGE_KEY_PROMPTS = 'aloncar_system_prompts_v1'
export const STORAGE_KEY_AI_CONFIG = 'aloncar_ai_provider_config_v1'
export const STORAGE_KEY_AI_LOGS = 'aloncar_ai_processing_logs_v1'

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

export async function recordAiProcessingLog(entry) {
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
// DICCIONARIO Y RESOLUCIÓN DE CONFIGURACIÓN NAVAL
// ============================================================================
export function getNavalDictionary(promptsList = []) {
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
