import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'

// valor inicial pro input datetime-local: agora + 1h, no fuso local
function defaultFireAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ReminderDialog({ initial = {}, onSave, onCancel }) {
  const [kind, setKind] = useState(initial.kind || 'once')
  const [fireAt, setFireAt] = useState(initial.fireAt || defaultFireAt())
  const [time, setTime] = useState(initial.time || '09:00')
  const [intervalHours, setIntervalHours] = useState(initial.intervalHours || 3)

  const save = () => {
    if (kind === 'once') onSave({ kind, fireAt })
    else if (kind === 'daily') onSave({ kind, time })
    else onSave({ kind, intervalHours: Math.max(0.5, Number(intervalHours) || 1) })
  }

  // Enter confirma (de qualquer lugar), Esc cancela
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, fireAt, time, intervalHours])

  const tab = (val, label) => (
    <button
      type="button"
      className={'rem-tab' + (kind === val ? ' on' : '')}
      onClick={() => setKind(val)}
    >
      {label}
    </button>
  )

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <Bell size={17} style={{ verticalAlign: 'middle', color: 'var(--accent)' }} /> Quando notificar?
        </div>

        <div className="rem-tabs">
          {tab('once', 'Uma vez')}
          {tab('daily', 'Todo dia')}
          {tab('interval', 'A cada X horas')}
        </div>

        <div className="rem-body">
          {kind === 'once' && (
            <label className="rem-field">
              <span>Data e hora</span>
              <input
                type="datetime-local"
                className="field"
                value={fireAt}
                onChange={(e) => setFireAt(e.target.value)}
              />
            </label>
          )}
          {kind === 'daily' && (
            <label className="rem-field">
              <span>Horário (todos os dias)</span>
              <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          )}
          {kind === 'interval' && (
            <label className="rem-field">
              <span>A cada quantas horas (até marcar como concluído)</span>
              <input
                type="number"
                className="field"
                min="0.5"
                step="0.5"
                value={intervalHours}
                onChange={(e) => setIntervalHours(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button>
        </div>
        <div className="modal-hint">Enter para salvar · Esc para cancelar</div>
      </div>
    </div>,
    document.body,
  )
}
