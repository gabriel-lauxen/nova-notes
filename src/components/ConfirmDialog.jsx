import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Modal de confirmação. Enter confirma, Esc cancela.
export default function ConfirmDialog({ title = 'Confirmar', message, confirmLabel = 'Excluir', onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {message && <div className="modal-msg">{message}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
        <div className="modal-hint">Enter para confirmar · Esc para cancelar</div>
      </div>
    </div>,
    document.body,
  )
}
