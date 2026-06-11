// Geração de texto e transcrição de voz.
// Provedor principal: Groq (mais RPM no free tier). Fallback: Gemini.
// Ordem para texto:
//   1) chave Groq do usuário  -> Groq direto
//   2) chave Gemini do usuário -> Gemini direto
//   3) proxy serverless /api/generate (Groq no servidor, com fallback Gemini)
// Transcrição: Groq Whisper (chave do usuário) ou proxy /api/transcribe.

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GROQ_WHISPER = 'whisper-large-v3-turbo'
const CEREBRAS_MODEL = 'llama-3.3-70b'
const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_TOKENS = 3000 // saída mais longa

const GEMINI_STORAGE = 'nova-gemini-key'
const GROQ_STORAGE = 'nova-groq-key'
const CEREBRAS_STORAGE = 'nova-cerebras-key'
const PROVIDER_STORAGE = 'nova-ai-provider' // 'groq' | 'cerebras' | 'gemini'

// instrução fixa: sem preâmbulos, só o conteúdo pedido, em Markdown bem formatado
const SYSTEM =
  'Você é um assistente de escrita dentro de um editor de notas. Escreva APENAS o que foi pedido, ' +
  'sem preâmbulos, saudações ou frases como "Claro! Aqui está...". Nunca comente o que vai fazer. ' +
  'Use Markdown bem formatado quando fizer sentido (títulos com #, listas, negrito, tabelas). ' +
  'Se pedirem lista de mercado, compras, tarefas ou qualquer checklist, use checkboxes de Markdown ' +
  '(linhas começando com "- [ ] "). ' +
  'Não envolva a resposta inteira em bloco de código, a menos que seja código.'

export function getGeminiKey() {
  try { return localStorage.getItem(GEMINI_STORAGE) || '' } catch { return '' }
}
export function setGeminiKey(k) {
  try { k ? localStorage.setItem(GEMINI_STORAGE, k) : localStorage.removeItem(GEMINI_STORAGE) } catch {}
}
export function getGroqKey() {
  try { return localStorage.getItem(GROQ_STORAGE) || '' } catch { return '' }
}
export function setGroqKey(k) {
  try { k ? localStorage.setItem(GROQ_STORAGE, k) : localStorage.removeItem(GROQ_STORAGE) } catch {}
}
export function getCerebrasKey() {
  try { return localStorage.getItem(CEREBRAS_STORAGE) || '' } catch { return '' }
}
export function setCerebrasKey(k) {
  try { k ? localStorage.setItem(CEREBRAS_STORAGE, k) : localStorage.removeItem(CEREBRAS_STORAGE) } catch {}
}

// provedor preferido escolhido pelo usuário (padrão: groq)
export function getProvider() {
  try { return localStorage.getItem(PROVIDER_STORAGE) || 'groq' } catch { return 'groq' }
}
export function setProvider(p) {
  try { localStorage.setItem(PROVIDER_STORAGE, p) } catch {}
}

const QUOTA_MSG =
  'Limite de uso da IA atingido por enquanto. Os planos grátis resetam por minuto e por dia — tente de novo em alguns minutos.'

function parseJson(s) {
  try {
    const m = s.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch {
    return null
  }
}

/* ----------------- Groq / Cerebras (OpenAI-compatible) ----------------- */
async function openaiStyleText(url, model, prompt, key, label) {
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
  if (!r.ok) {
    const err = new Error(r.status === 429 ? QUOTA_MSG : data?.error?.message || `Erro na API do ${label}.`)
    err.status = r.status
    throw err
  }
  return (data.choices?.[0]?.message?.content || '').trim()
}
const groqText = (prompt, key) =>
  openaiStyleText('https://api.groq.com/openai/v1/chat/completions', GROQ_MODEL, prompt, key, 'Groq')
const cerebrasText = (prompt, key) =>
  openaiStyleText('https://api.cerebras.ai/v1/chat/completions', CEREBRAS_MODEL, prompt, key, 'Cerebras')

/* ----------------- Gemini ----------------- */
async function geminiText(prompt, key) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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
  if (!r.ok) {
    const err = new Error(r.status === 429 ? QUOTA_MSG : data?.error?.message || 'Erro na API do Gemini.')
    err.status = r.status
    throw err
  }
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
}

/* ----------------- cadeia de provedores ----------------- */
const keyFor = (p) => (p === 'groq' ? getGroqKey() : p === 'cerebras' ? getCerebrasKey() : getGeminiKey())
const callProvider = (p, prompt, key) =>
  p === 'groq' ? groqText(prompt, key) : p === 'cerebras' ? cerebrasText(prompt, key) : geminiText(prompt, key)

// ordem: provedor escolhido primeiro, depois os outros como fallback
function providerOrder() {
  const sel = getProvider()
  const all = ['groq', 'cerebras', 'gemini']
  return [sel, ...all.filter((p) => p !== sel)]
}

// texto: provedor preferido -> fallbacks com chave -> proxy serverless
export async function generateText(prompt) {
  const order = providerOrder()
  let lastErr
  for (const p of order) {
    const key = keyFor(p)
    if (!key) continue
    try {
      return await callProvider(p, prompt, key)
    } catch (e) {
      lastErr = e
    }
  }
  try {
    return await proxyText(prompt, getProvider())
  } catch (e) {
    throw lastErr || e
  }
}

async function proxyText(prompt, provider) {
  let res
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider }),
    })
  } catch {
    throw new Error('Configure uma chave de IA (Groq, Cerebras ou Gemini) em Configurações.')
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    throw new Error('Configure uma chave de IA (Groq, Cerebras ou Gemini) em Configurações.')
  }
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 429) throw new Error(QUOTA_MSG)
    throw new Error(data.error || 'Falha ao gerar texto.')
  }
  return data.text || ''
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

/* ----------------- transcrição de voz (Whisper via Groq) ----------------- */
export async function transcribe(blob) {
  const groqKey = getGroqKey()

  // 1) Groq direto (multipart)
  if (groqKey) {
    const form = new FormData()
    form.append('file', blob, 'audio.webm')
    form.append('model', GROQ_WHISPER)
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (r.status === 429) throw new Error(QUOTA_MSG)
      throw new Error(data?.error?.message || 'Falha ao transcrever o áudio.')
    }
    return (data.text || '').trim()
  }

  // 2) proxy serverless (base64)
  const b64 = await blobToBase64(blob)
  let res
  try {
    res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: b64, mime: blob.type || 'audio/webm' }),
    })
  } catch {
    throw new Error('Para usar voz, configure sua chave do Groq em Configurações.')
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    throw new Error('Para usar voz, configure sua chave do Groq em Configurações.')
  }
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 429) throw new Error(QUOTA_MSG)
    throw new Error(data.error || 'Falha ao transcrever o áudio.')
  }
  return (data.text || '').trim()
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
