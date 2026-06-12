import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, ChevronLeft, ChevronRight, MoreVertical, Trash2, Pencil, Link2, ExternalLink, GripVertical } from 'lucide-react'
import { habitsApi, notesApi } from '../lib/store'
import EmojiPicker from '../components/EmojiPicker'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const stop = (e) => e.stopPropagation()

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()

function streaks(log, y, m) {
  const n = daysInMonth(y, m)
  let best = 0, run = 0, current = 0
  for (let d = 1; d <= n; d++) {
    if (log[keyOf(y, m, d)]) { run++; best = Math.max(best, run) } else run = 0
  }
  for (let d = n; d >= 1; d--) {
    if (log[keyOf(y, m, d)]) current++
    else if (current > 0 || d < n) break
  }
  return { best, current }
}
function monthDone(log, y, m) {
  const n = daysInMonth(y, m)
  let c = 0
  for (let d = 1; d <= n; d++) if (log[keyOf(y, m, d)]) c++
  return c
}

function HabitRow({ h, days, y, m, isThisMonth, today, onToggle, onOpenNote, onMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: h.id })
  const style = { transform: CSS.Transform.toString(transform), transition, position: isDragging ? 'relative' : undefined, zIndex: isDragging ? 30 : undefined }
  const log = h.log || {}
  const n = days.length
  const pct = Math.round((monthDone(log, y, m) / n) * 100)

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'row-dragging' : ''}>
      <td className="habit-name-col">
        <div className="habit-name-wrap">
          <button className="reorder-handle" title="Arraste para reordenar" {...attributes} {...listeners}><GripVertical size={15} /></button>
          <button className="habit-name" onClick={() => onOpenNote(h)} title={h.note_id ? 'Abrir nota vinculada' : ''}>
            <span>{h.emoji || '✅'}</span>
            <span className="hn-text">{h.name}</span>
            {h.note_id && <ExternalLink size={13} className="hn-link" />}
          </button>
        </div>
      </td>
      {days.map((d) => {
        const on = !!log[keyOf(y, m, d)]
        return <td key={d} className="day-cell"><button className={'hcell' + (on ? ' on' : '')} onClick={() => onToggle(h, d)} /></td>
      })}
      <td className="pct-col"><span className="pct-pill">{pct}%</span></td>
      <td className="act-col">
        <button className="icon-btn sm" onClick={(e) => onMenu(h.id, e)}><MoreVertical size={16} /></button>
      </td>
    </tr>
  )
}

export default function Habits() {
  const navigate = useNavigate()
  const [habits, setHabits] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ref, setRef] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [menu, setMenu] = useState(null) // { id, top, left }
  const [editing, setEditing] = useState(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [focus, setFocus] = useState('all')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const refresh = () =>
    habitsApi.list()
      .then((h) => { setHabits(h); setError(null) })
      .catch((e) => { console.error('[NOVA] erro hábitos:', e); setError(e.message || String(e)) })
      .finally(() => setLoading(false))

  useEffect(() => { refresh(); notesApi.list().then(setNotes).catch(() => {}) }, [])

  const today = new Date()
  const isThisMonth = today.getFullYear() === ref.y && today.getMonth() === ref.m
  const n = daysInMonth(ref.y, ref.m)
  const days = useMemo(() => Array.from({ length: n }, (_, i) => i + 1), [n])

  // rola a tabela até o dia atual
  const tableRef = useRef(null)
  useEffect(() => {
    if (loading || !isThisMonth) return
    const wrap = tableRef.current
    const cell = wrap?.querySelector('.day-col.today')
    if (!wrap || !cell) return
    wrap.scrollLeft += cell.getBoundingClientRect().left - wrap.getBoundingClientRect().left - 200
  }, [loading, isThisMonth, ref.y, ref.m, habits.length])

  const move = (delta) => setRef((r) => { const d = new Date(r.y, r.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const add = async () => {
    const h = await habitsApi.create({ position: habits.length })
    setHabits((hs) => [...hs, h])
    setEditing(h.id)
  }
  const patch = async (id, p) => {
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, ...p } : h)))
    await habitsApi.update(id, p)
  }
  const toggleDay = (h, d) => {
    const k = keyOf(ref.y, ref.m, d)
    const log = { ...(h.log || {}) }
    if (log[k]) delete log[k]; else log[k] = true
    patch(h.id, { log })
  }
  const remove = async (id) => { setMenu(null); await habitsApi.remove(id); refresh() }
  const openNote = (h) => { if (h.note_id) navigate(`/note/${h.note_id}`) }

  const openMenu = (id, e) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setMenu((cur) => (cur?.id === id ? null : { id, top: r.bottom + 4, left: Math.max(8, r.right - 190) }))
  }

  const onDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldI = habits.findIndex((h) => h.id === active.id)
    const newI = habits.findIndex((h) => h.id === over.id)
    const reordered = arrayMove(habits, oldI, newI)
    setHabits(reordered)
    await Promise.all(reordered.map((h, i) => (h.position === i ? null : habitsApi.update(h.id, { position: i }))))
  }

  if (loading) return (
    <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="inline-loader" style={{ padding: 0 }}><div className="ring" /><span>carregando</span></div>
    </div>
  )

  const focused = focus === 'all' ? null : habits.find((h) => h.id === focus)
  const menuHabit = menu && habits.find((h) => h.id === menu.id)

  return (
    <div className="panel">
      <div className="habits-head">
        <div>
          <div className="panel-title">Hábitos</div>
          <div className="panel-sub">Acompanhe seus hábitos do mês.</div>
        </div>
        <div className="habits-actions">
          <div className="month-nav">
            <button className="icon-btn" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
            <span>{MONTHS[ref.m]} {ref.y}</span>
            <button className="icon-btn" onClick={() => move(1)}><ChevronRight size={18} /></button>
          </div>
          <button className="btn-primary" onClick={add}><Plus size={16} style={{ verticalAlign: 'middle' }} /> Hábito</button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--accent)', margin: '8px 0 18px' }}>
          <strong>Não consegui carregar os hábitos.</strong>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 6 }}>{error}</p>
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 8 }}>
            Rode o <code>supabase_schema.sql</code> atualizado (ele cria a tabela <code>habits</code>).
          </p>
        </div>
      )}

      {habits.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>Nenhum hábito ainda. Clique em “Hábito” para criar o primeiro.</p>
      ) : (
        <div className="habit-table-wrap fade-in" ref={tableRef}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <table className="habit-table">
              <thead>
                <tr>
                  <th className="habit-name-col">Atividade</th>
                  {days.map((d) => {
                    const wd = new Date(ref.y, ref.m, d).getDay()
                    const isToday = isThisMonth && d === today.getDate()
                    return <th key={d} className={'day-col' + (isToday ? ' today' : '')}><span className="wd">{WD[wd]}</span><span className="dn">{d}</span></th>
                  })}
                  <th className="pct-col">Mês</th>
                  <th className="act-col"></th>
                </tr>
              </thead>
              <tbody>
                <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                  {habits.map((h) => (
                    <HabitRow key={h.id} h={h} days={days} y={ref.y} m={ref.m} isThisMonth={isThisMonth} today={today} onToggle={toggleDay} onOpenNote={openNote} onMenu={openMenu} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      )}

      {/* menu fixo (escapa do overflow da tabela) */}
      {menuHabit && createPortal(
        <>
          <div className="menu-backdrop" onClick={() => setMenu(null)} />
          <div className="card-menu" style={{ position: 'fixed', top: menu.top, left: menu.left, right: 'auto', zIndex: 120 }}>
            <button onClick={() => { setEditing(menuHabit.id); setMenu(null) }}><Pencil size={14} /> Editar</button>
            <button onClick={() => { setFocus(menuHabit.id); setMenu(null) }}><Link2 size={14} /> Ver isolado</button>
            <button className="danger" onClick={() => remove(menuHabit.id)}><Trash2 size={14} /> Excluir</button>
          </div>
        </>,
        document.body,
      )}

      {editing && (() => {
        const h = habits.find((x) => x.id === editing)
        if (!h) return null
        return (
          <div className="card" style={{ marginTop: 16, maxWidth: 460, position: 'relative', zIndex: 30 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Editar hábito</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'stretch' }}>
              <div className="emoji-wrap">
                <button
                  className="field"
                  style={{ width: 52, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer' }}
                  onClick={() => setEmojiOpen((o) => !o)}
                >
                  {h.emoji || '✅'}
                </button>
                {emojiOpen && (
                  <EmojiPicker
                    onPick={(e) => { patch(h.id, { emoji: e }); setEmojiOpen(false) }}
                    onClose={() => setEmojiOpen(false)}
                  />
                )}
              </div>
              <input className="field" value={h.name} onChange={(e) => patch(h.id, { name: e.target.value })} placeholder="Nome do hábito" />
            </div>
            <label style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Vincular a uma nota</label>
            <select className="field" style={{ marginTop: 6 }} value={h.note_id || ''} onChange={(e) => patch(h.id, { note_id: e.target.value || null })}>
              <option value="">— Nenhuma —</option>
              {notes.map((nt) => <option key={nt.id} value={nt.id}>{nt.emoji} {nt.title || 'Sem título'}</option>)}
            </select>
            <button className="btn-text" style={{ marginTop: 12 }} onClick={() => setEditing(null)}>Concluir</button>
          </div>
        )
      })()}

      {habits.length > 0 && (
        <div className="fade-in" style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div className="panel-title" style={{ fontSize: 19 }}>Métricas do mês</div>
            <div className="seg">
              <button className={'seg-btn' + (focus === 'all' ? ' on' : '')} onClick={() => setFocus('all')}>Todos</button>
              {habits.map((h) => (
                <button key={h.id} className={'seg-btn' + (focus === h.id ? ' on' : '')} onClick={() => setFocus(h.id)}>{h.emoji} {h.name}</button>
              ))}
            </div>
          </div>
          {focus === 'all' ? <AllMetrics habits={habits} y={ref.y} m={ref.m} days={days} /> : <HabitMetrics habit={focused} y={ref.y} m={ref.m} days={days} />}
        </div>
      )}
    </div>
  )
}

function AllMetrics({ habits, y, m, days }) {
  const n = days.length
  return (
    <div className="metrics">
      <div className="card">
        <div className="metric-title">Conclusão por hábito</div>
        {habits.map((h) => {
          const pct = Math.round((monthDone(h.log || {}, y, m) / n) * 100)
          return (
            <div className="metric-bar" key={h.id}>
              <span className="metric-name">{h.emoji} {h.name}</span>
              <div className="metric-track"><span style={{ width: `${pct}%` }} /></div>
              <span className="metric-val">{pct}%</span>
            </div>
          )
        })}
      </div>
      <div className="card">
        <div className="metric-title">Atividade por dia</div>
        <div className="day-bars">
          {days.map((d) => {
            const total = habits.length || 1
            const c = habits.filter((h) => (h.log || {})[keyOf(y, m, d)]).length
            const pct = Math.round((c / total) * 100)
            return <div key={d} className="day-bar-wrap" title={`Dia ${d}: ${c}/${habits.length}`}><div className="day-bar" style={{ height: `${Math.max(4, pct)}%` }} /></div>
          })}
        </div>
        <div className="day-bars-axis"><span>1</span><span>{n}</span></div>
      </div>
    </div>
  )
}

function HabitMetrics({ habit, y, m, days }) {
  if (!habit) return null
  const log = habit.log || {}
  const n = days.length
  const done = monthDone(log, y, m)
  const pct = Math.round((done / n) * 100)
  const { best, current } = streaks(log, y, m)
  const firstWd = new Date(y, m, 1).getDay()
  return (
    <div className="metrics">
      <div className="card">
        <div className="metric-title">{habit.emoji} {habit.name} — calendário</div>
        <div className="cal-grid">
          {WD.map((w, i) => <div key={'h' + i} className="cal-wd">{w}</div>)}
          {Array.from({ length: firstWd }).map((_, i) => <div key={'e' + i} />)}
          {days.map((d) => {
            const on = !!log[keyOf(y, m, d)]
            return <div key={d} className={'cal-cell' + (on ? ' on' : '')}>{d}</div>
          })}
        </div>
      </div>
      <div className="card stat-card">
        <div className="metric-title">Resumo</div>
        <div className="stat"><span className="stat-num">{pct}%</span><span className="stat-lbl">do mês ({done}/{n} dias)</span></div>
        <div className="stat"><span className="stat-num">{current}</span><span className="stat-lbl">sequência atual</span></div>
        <div className="stat"><span className="stat-num">{best}</span><span className="stat-lbl">melhor sequência</span></div>
      </div>
    </div>
  )
}
