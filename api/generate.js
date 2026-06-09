// Função serverless (Vercel) — proxy para a API do Gemini.
// A chave fica só no servidor (GEMINI_API_KEY), nunca no frontend.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' })

  const { prompt } = req.body || {}
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt vazio.' })

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const SYSTEM =
    'Você é um assistente de escrita dentro de um editor de notas. Escreva APENAS o que foi pedido, ' +
    'sem preâmbulos, saudações ou frases como "Claro! Aqui está...". Nunca comente o que vai fazer. ' +
    'Use Markdown bem formatado quando fizer sentido (títulos com #, listas, negrito, tabelas). ' +
    'Não envolva a resposta inteira em bloco de código, a menos que seja código.'

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Erro na API do Gemini.' })
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
    return res.status(200).json({ text })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Falha ao chamar o Gemini.' })
  }
}
