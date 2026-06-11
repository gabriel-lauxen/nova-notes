// Função serverless (Vercel) — proxy de geração de texto.
// Provedor principal: Groq (GROQ_API_KEY). Fallback: Gemini (GEMINI_API_KEY).
// As chaves ficam só no servidor, nunca no frontend.

const SYSTEM =
  'Você é um assistente de escrita dentro de um editor de notas. Escreva APENAS o que foi pedido, ' +
  'sem preâmbulos, saudações ou frases como "Claro! Aqui está...". Nunca comente o que vai fazer. ' +
  'Use Markdown bem formatado quando fizer sentido (títulos com #, listas, negrito, tabelas). ' +
  'Se pedirem lista de mercado, compras, tarefas ou qualquer checklist, use checkboxes de Markdown ' +
  '(linhas começando com "- [ ] "). ' +
  'Não envolva a resposta inteira em bloco de código, a menos que seja código.'

const MAX_TOKENS = 3000

async function openaiStyle(url, key, model, prompt, label) {
  if (!key) return null
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return { error: data?.error?.message || `Erro na API do ${label}.`, status: r.status }
  return { text: (data.choices?.[0]?.message?.content || '').trim() }
}

const groq = (prompt) =>
  openaiStyle('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY,
    process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', prompt, 'Groq')

const cerebras = (prompt) =>
  openaiStyle('https://api.cerebras.ai/v1/chat/completions', process.env.CEREBRAS_API_KEY,
    process.env.CEREBRAS_MODEL || 'llama-3.3-70b', prompt, 'Cerebras')

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      }),
    },
  )
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return { error: data?.error?.message || 'Erro na API do Gemini.', status: r.status }
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
  return { text }
}

const PROVIDERS = { groq, cerebras, gemini }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { prompt, provider } = req.body || {}
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' })

  // provedor preferido primeiro, depois os outros como fallback
  const sel = ['groq', 'cerebras', 'gemini'].includes(provider) ? provider : 'groq'
  const order = [sel, ...Object.keys(PROVIDERS).filter((p) => p !== sel)]

  try {
    let fail
    for (const name of order) {
      const out = await PROVIDERS[name](prompt)
      if (out && out.text) return res.status(200).json({ text: out.text })
      if (out && out.error) fail = out
    }
    if (fail?.status === 429) return res.status(429).json({ error: 'Limite de uso atingido.' })
    if (fail?.error) return res.status(fail.status || 500).json({ error: fail.error })
    return res.status(500).json({ error: 'Configure GROQ_API_KEY, CEREBRAS_API_KEY ou GEMINI_API_KEY no servidor.' })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Falha ao gerar texto.' })
  }
}
