import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Home, Target, CalendarCheck, Settings, Plus, FileText, Trash2, Bot, Search } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import PinwheelIcon from './PinwheelIcon'

function NoteItem({ n, onContextMenu, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: n.id })
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState(false)
  const live = useRef(false)
  const sx = useRef(0), sy = useRef(0), swiping = useRef(false)

  // enquanto o dnd-kit estiver reordenando, zera o swipe pra não encolher o item
  useEffect(() => {
    if (isDragging) {
      swiping.current = false
      live.current = false
      setDx(0)
      setOpen(false)
    }
  }, [isDragging])

  const onTouchStart = (e) => {
    listeners?.onTouchStart?.(e) // mantém o drag de reordenar (TouchSensor)
    const t = e.touches[0]
    sx.current = t.clientX; sy.current = t.clientY; swiping.current = false
  }
  const onTouchMove = (e) => {
    if (isDragging) return // reordenando -> não interpreta como swipe
    const t = e.touches[0]
    const ddx = t.clientX - sx.current, ddy = t.clientY - sy.current
    if (!swiping.current) {
      // só vira swipe se o gesto for claramente horizontal
      if (Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(ddy) * 1.6) swiping.current = true
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

  const revealed = !isDragging && (open || dx < -2)
  const reveal = -dx // 0..72 -> quanto o item encolhe (revela o botão)
  // reordenar só na vertical: zera o deslocamento horizontal do dnd-kit
  const vTransform = transform ? { ...transform, x: 0 } : null
  const style = {
    transform: CSS.Transform.toString(vTransform),
    // o item ENCOLHE pela direita; o título fica no lugar (não desliza)
    width: revealed ? `calc(100% - ${reveal}px)` : undefined,
    transition: isDragging ? transition : live.current ? 'none' : 'width 0.2s ease, transform 0.2s ease',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    ...(revealed ? { backgroundColor: 'var(--bg-elev)', overflow: 'hidden' } : null),
  }
  return (
    <div
      className={'nav-swipe' + (revealed ? ' swiping' : '')}
      style={isDragging ? { zIndex: 50 } : undefined}
    >
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

export default function Sidebar({ notes, sharedNotes = [], onNewNote, onDeleteNote, onReorderNotes, onSearch, open, onClose }) {
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
    // engole o clique que dispara logo após soltar (senão soltar em cima de um
    // link tipo "Agentes" navega e mostra a tela de carregamento)
    const swallow = (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
    }
    document.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => document.removeEventListener('click', swallow, true), 320)

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
          <PinwheelIcon className="logo" size={28} />
          <span className="brand-name">Nova notes</span>
        </div>

        <button type="button" className="nav-item nav-search" onClick={onSearch}>
          <Search size={17} /> <span className="title">Buscar</span>
          <span className="nav-kbd">⌘K</span>
        </button>

        <NavLink to="/" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} end>
          <Home size={17} /> <span className="title">Início</span>
        </NavLink>
        <NavLink to="/goals" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <Target size={17} /> <span className="title">Objetivos</span>
        </NavLink>
        <NavLink to="/habits" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <CalendarCheck size={17} /> <span className="title">Hábitos</span>
        </NavLink>
        <NavLink to="/agents" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <Bot size={17} /> <span className="title">Agentes</span>
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

        {sharedNotes.length > 0 && (
          <>
            <div className="nav-section">Compartilhadas</div>
            {sharedNotes.map((n) => (
              <NavLink
                key={n.id}
                to={`/note/${n.id}`}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <span className="emoji">{n.emoji || <FileText size={15} />}</span>
                <span className="title">{n.title || 'Sem título'}</span>
              </NavLink>
            ))}
          </>
        )}

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
