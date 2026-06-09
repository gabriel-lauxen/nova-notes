import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'

// Coleta o pedido e dispara a geração no NotePage (que mostra "Gerando…").
export default function AIDialog({ onSubmit, onCancel, defaultMeta }) {
  const [prompt, setPrompt] = useState('')
  const [meta, setMeta] = useState(!!defaultMeta)
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

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
        <div className="modal-title"><Sparkles size={17} style={{ verticalAlign: 'middle', color: 'var(--accent)' }} /> Gerar com IA</div>
        <div className="modal-msg">Descreva o que você quer escrever — a IA gera e insere na nota.</div>
        <textarea
          ref={ref}
          className="field"
          rows={4}
          placeholder="Ex.: um resumo dos benefícios de acordar cedo, em tópicos"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <label className="ai-check">
          <input type="checkbox" checked={meta} onChange={(e) => setMeta(e.target.checked)} />
          Gerar título e emoji com base no prompt
        </label>
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
