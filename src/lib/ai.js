// Geração de texto com Gemini.
// 1) Se o usuário colou a própria chave em Configurações, chama direto.
// 2) Senão, usa o proxy serverless /api/generate (chave no servidor).
const MODEL = 'gemini-2.5-flash'
const KEY_STORAGE = 'nova-gemini-key'

// instrução fixa: sem preâmbulos, só o conteúdo pedido, em Markdown bem formatado
const SYSTEM =
  'Você é um assistente de escrita dentro de um editor de notas. Escreva APENAS o que foi pedido, ' +
  'sem preâmbulos, saudações ou frases como "Claro! Aqui está...". Nunca comente o que vai fazer. ' +
  'Use Markdown bem formatado quando fizer sentido (títulos com #, listas, negrito, tabelas). ' +
  'Não envolva a resposta inteira em bloco de código, a menos que seja código.'

export function getGeminiKey() {
  try { return localStorage.getItem(KEY_STORAGE) || '' } catch { return '' }
}
export function setGeminiKey(k) {
  try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE) } catch {}
}

function extract(data) {
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
}

function parseJson(s) {
  try {
    const m = s.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch {
    return null
  }
}

// Gera o conteúdo da nota. Se wantMeta, também pede título e emoji.
export async function generateNote(instruction, wantMeta) {
  if (wantMeta) {
    const p = `Você é um assistente de notas. Gere o conteúdo em Markdown a partir do pedido, além de um título curto (máx. 6 palavras) e um único emoji que represente a nota.\nResponda APENAS com JSON válido: {"emoji":"<emoji>","title":"<título>","content":"<markdown>"}.\nPedido: ${instruction}`
    const raw = await generateText(p)
    const parsed = parseJson(raw)
    if (parsed && parsed.content) return { content: parsed.content, title: parsed.title, emoji: parsed.emoji }
    return { content: raw }
  }
  const content = await generateText(instruction)
  return { content }
}

export async function generateText(prompt) {
  const key = getGeminiKey()

  if (key) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.error?.message || 'Erro na API do Gemini (verifique sua chave).')
    return extract(data)
  }

  // fallback: proxy serverless
  let res
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
  } catch {
    throw new Error('Configure sua chave do Gemini em Configurações.')
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    throw new Error('Configure sua chave do Gemini em Configurações.')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Falha ao gerar texto.')
  return data.text || ''
}
