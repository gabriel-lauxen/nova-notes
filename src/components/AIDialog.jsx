import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Mic, Square, Loader2 } from 'lucide-react'
import { recordVoice } from '../lib/recorder'
import { transcribe } from '../lib/ai'

// Coleta o pedido e dispara a geração no NotePage (que mostra "Gerando…").
export default function AIDialog({
  onSubmit,
  onCancel,
  defaultMeta,
  title = 'Gerar com IA',
  message = 'Descreva o que você quer escrever — a IA gera e insere na nota.',
  placeholder = 'Ex.: um resumo dos benefícios de acordar cedo, em tópicos',
  hideMeta = false,
}) {
  const [prompt, setPrompt] = useState('')
  const [meta, setMeta] = useState(!!defaultMeta)
  const [rec, setRec] = useState('idle') // idle | recording | transcribing
  const ref = useRef(null)
  const stopRef = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  // microfone: grava (para no silêncio), transcreve e adiciona ao prompt
  const toggleMic = async () => {
    if (rec === 'recording') { stopRef.current?.(); return }
    if (rec !== 'idle') return
    setRec('recording')
    let blob
    try {
      const r = recordVoice({})
      stopRef.current = r.stop
      blob = await r.promise
    } catch {
      setRec('idle'); return
    }
    setRec('transcribing')
    try {
      const text = await transcribe(blob)
      if (text) setPrompt((p) => (p ? p.trim() + ' ' : '') + text)
    } catch {}
    setRec('idle')
    ref.current?.focus()
  }

  const run = () => {
    const p = prompt.trim()
    if (p) onSubmit(p, meta)
  }

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run() }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="modal-title"><Sparkles size={17} style={{ verticalAlign: 'middle', color: 'var(--accent)' }} /> {title}</div>
        <div className="modal-msg">{message}</div>
        <div className="agent-instr">
          <textarea
            ref={ref}
            className="field"
            rows={4}
            placeholder={placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className={'agent-mic ' + rec}
            onClick={toggleMic}
            disabled={rec === 'transcribing'}
            title={rec === 'recording' ? 'Parar' : rec === 'transcribing' ? 'Transcrevendo…' : 'Falar'}
          >
            {rec === 'recording' ? (
              <Square size={14} fill="currentColor" />
            ) : rec === 'transcribing' ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Mic size={15} />
            )}
          </button>
        </div>
        {!hideMeta && (
          <label className="ai-check">
            <input type="checkbox" checked={meta} onChange={(e) => setMeta(e.target.checked)} />
            Gerar título e emoji com base no prompt
          </label>
        )}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={run}>Gerar</button>
        </div>
        <div className="modal-hint">⌘/Ctrl + Enter para gerar · Esc para cancelar</div>
      </div>
    </div>,
    document.body,
  )
}
