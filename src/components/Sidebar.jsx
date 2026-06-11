import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Home, Target, CalendarCheck, Settings, Plus, FileText, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'

function NoteItem({ n, onContextMenu, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: n.id })
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState(false)
  const live = useRef(false)
  const sx = useRef(0), sy = useRef(0), swiping = useRef(false)

  const onTouchStart = (e) => {
    listeners?.onTouchStart?.(e) // mantém o drag de reordenar (TouchSensor)
    const t = e.touches[0]
    sx.current = t.clientX; sy.current = t.clientY; swiping.current = false
  }
  const onTouchMove = (e) => {
    const t = e.touches[0]
    const ddx = t.clientX - sx.current, ddy = t.clientY - sy.current
    if (!swiping.current) {
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.3) swiping.current = true
      else return
    }
    live.current = true
    const base = open ? -72 : 0
    setDx(Math.max(-86, Math.min(0, base + ddx)))
  }
  const onTouchEnd = () => {
    if (!swiping.current) return
    live.current = false
    const willOpen = dx < -36
    setOpen(willOpen)
    setDx(willOpen ? -72 : 0)
    swiping.current = false
  }

  const revealed = open || dx < -2
  const reveal = -dx // 0..72 -> quanto o item encolhe (revela o botão)
  const style = {
    transform: CSS.Transform.toString(transform),
    // o item ENCOLHE pela direita; o título fica no lugar (não desliza)
    width: revealed ? `calc(100% - ${reveal}px)` : undefined,
    transition: isDragging ? transition : live.current ? 'none' : 'width 0.2s ease, transform 0.2s ease',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    ...(revealed ? { backgroundColor: 'var(--bg-elev)', overflow: 'hidden' } : null),
  }
  return (
    <div className="nav-swipe">
      {revealed && (
        <button
          className="nav-del"
          onClick={() => { setOpen(false); setDx(0); onDelete(n) }}
          aria-label="Excluir nota"
        >
          <Trash2 size={16} />
        </button>
      )}
      <NavLink
        ref={setNodeRef}
        style={style}
        to={`/note/${n.id}`}
        draggable={false}
        className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        onContextMenu={(e) => onContextMenu(e, n.id)}
        onClick={(e) => { if (open) { e.preventDefault(); setOpen(false); setDx(0) } }}
        {...attributes}
        {...listeners}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="emoji">{n.emoji || <FileText size={15} />}</span>
        <span className="title">{n.title || 'Sem título'}</span>
      </NavLink>
    </div>
  )
}

export default function Sidebar({ notes, onNewNote, onDeleteNote, onReorderNotes, open, onClose }) {
  const navigate = useNavigate()
  const [menu, setMenu] = useState(null) // { id, x, y }
  const [confirm, setConfirm] = useState(null) // { id, title }

  // mouse: arrasta após 6px (clique simples navega).
  // toque (iPhone): segura ~220ms pra arrastar; toque rápido navega; rolar cancela.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  const openMenu = (e, id) => {
    e.preventDefault()
    setMenu({ id, x: Math.min(e.clientX, window.innerWidth - 200), y: e.clientY })
  }

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldI = notes.findIndex((n) => n.id === active.id)
    const newI = notes.findIndex((n) => n.id === over.id)
    onReorderNotes?.(arrayMove(notes, oldI, newI).map((n) => n.id))
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {notes.map((n) => (
              <NoteItem
                key={n.id}
                n={n}
                onContextMenu={openMenu}
                onDelete={(note) => setConfirm({ id: note.id, title: note.title || 'Sem título' })}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button className="add-btn" onClick={onNewNote}><Plus size={15} /> Nova nota</button>

        <div className="sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Settings size={17} /> <span className="title">Configurações</span>
          </NavLink>
        </div>
      </aside>

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
    </>
  )
}
