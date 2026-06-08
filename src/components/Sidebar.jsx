import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Target, CalendarCheck, Settings, Plus, FileText, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'

export default function Sidebar({ notes, onNewNote, onDeleteNote, open, onClose }) {
  const navigate = useNavigate()
  const [menu, setMenu] = useState(null) // { id, x, y }
  const [confirm, setConfirm] = useState(null) // { id, title }

  const openMenu = (e, id) => {
    e.preventDefault()
    setMenu({ id, x: Math.min(e.clientX, window.innerWidth - 200), y: e.clientY })
  }

  return (
    <>
    {open && <div className="nav-backdrop" onClick={onClose} />}
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <div className="brand">
        <span className="logo">N</span>
        <span className="brand-name">NOVA</span>
      </div>

      <NavLink to="/" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} end>
        <Home size={17} /> <span className="title">Início</span>
      </NavLink>
      <NavLink to="/goals" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <Target size={17} /> <span className="title">Objetivos</span>
      </NavLink>
      <NavLink to="/habits" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <CalendarCheck size={17} /> <span className="title">Hábitos</span>
      </NavLink>

      <div className="nav-section">Notas</div>
      {notes.map((n) => (
        <NavLink
          key={n.id}
          to={`/note/${n.id}`}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          onContextMenu={(e) => openMenu(e, n.id)}
        >
          <span className="emoji">{n.emoji || <FileText size={15} />}</span>
          <span className="title">{n.title || 'Sem título'}</span>
        </NavLink>
      ))}
      <button className="add-btn" onClick={onNewNote}><Plus size={15} /> Nova nota</button>

      <div className="sidebar-footer">
        <NavLink to="/settings" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <Settings size={17} /> <span className="title">Configurações</span>
        </NavLink>
      </div>

      {menu && createPortal(
        <>
          <div className="menu-backdrop" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div className="card-menu" style={{ position: 'fixed', top: menu.y, left: menu.x, right: 'auto', zIndex: 120 }}>
            <button className="danger" onClick={() => {
              const n = notes.find((x) => x.id === menu.id)
              setConfirm({ id: menu.id, title: n?.title || 'Sem título' })
              setMenu(null)
            }}>
              <Trash2 size={14} /> Excluir nota
            </button>
          </div>
        </>,
        document.body,
      )}

      {confirm && (
        <ConfirmDialog
          title="Excluir nota"
          message={`Tem certeza que deseja excluir "${confirm.title}"? Esta ação não pode ser desfeita.`}
          onConfirm={() => { onDeleteNote?.(confirm.id); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </aside>
    </>
  )
}
