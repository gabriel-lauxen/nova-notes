// Função serverless (Vercel) — proxy de transcrição de voz via Groq Whisper.
// Recebe o áudio em base64 e repassa pro Groq. Chave só no servidor (GROQ_API_KEY).

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const key = process.env.GROQ_API_KEY
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' })

  const { audio, mime } = req.body || {}
  if (!audio) return res.status(400).json({ error: 'Áudio vazio.' })

  try {
    const bytes = Buffer.from(audio, 'base64')
    const model = process.env.GROQ_WHISPER || 'whisper-large-v3-turbo'
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mime || 'audio/webm' }), 'audio.webm')
    form.append('model', model)

    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Falha ao transcrever.' })
    return res.status(200).json({ text: (data.text || '').trim() })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Falha ao transcrever o áudio.' })
  }
}
