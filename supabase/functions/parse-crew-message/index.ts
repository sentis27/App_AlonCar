// ============================================================================
// SUPABASE EDGE FUNCTION: parse-crew-message
// ============================================================================
// Procesa el parte de cuadrilla de WhatsApp / audio usando OpenAI gpt-4o-mini
// en el servidor para no exponer la VITE_OPENAI_API_KEY en el navegador.
//
// Despliegue con Supabase CLI:
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase functions deploy parse-crew-message --no-verify-jwt
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY no configurada en los Secrets de Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { rawMessage, systemPrompt, model = 'gpt-4o-mini', temperature = 0.0 } = await req.json()

    if (!rawMessage || !systemPrompt) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros: rawMessage o systemPrompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `PARTE DE TRABAJO A TABULAR:\n"${rawMessage}"` }
        ]
      })
    })

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text()
      return new Response(
        JSON.stringify({ error: `OpenAI API Error: ${openAiResponse.status}`, details: errText }),
        { status: openAiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openAiData = await openAiResponse.json()
    const content = openAiData.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)

    return new Response(
      JSON.stringify({
        parsedPayload: parsed,
        tokensIn: openAiData.usage?.prompt_tokens || 0,
        tokensOut: openAiData.usage?.completion_tokens || 0,
        engineUsed: 'supabase_edge_openai'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno procesando mensaje' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
