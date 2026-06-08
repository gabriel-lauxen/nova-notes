import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, Upload, Trash2, Check, Loader2, Target } from 'lucide-react'
import Editor from '../components/Editor'
import LinkDialog from '../components/LinkDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import EmojiPicker from '../components/EmojiPicker'
import { notesApi } from '../lib/store'

// conta checkboxes (to-dos) e os dias dos marcadores de progresso
function countTasks(md) {
  const text = md || ''
  const items = text.match(/^\s*[-*+]\s+\[( |x|X)\]/gm) || []
  let total = items.length
  let checked = items.filter((l) => /\[(x|X)\]/.test(l)).length
  const trackers = text.matchAll(/data-count="(\d+)"\s+data-done="([01]*)"/g)
  for (const m of trackers) {
    total += parseInt(m[1], 10)
    checked += (m[2].match(/1/g) || []).length
  }
  return { total, checked }
}

export default function NotePage({ onChanged, onDeleted }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [note, setNote] = useState(null)
  const [allNotes, setAllNotes] = useState([])
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const [tagInput, setTagInput] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const saveTimer = useRef(null)
  const fileInput = useRef(null)
  const editorRef = useRef(null)

  useEffect(() => {
    let active = true
    notesApi.get(id).then((n) => active && setNote(n))
    notesApi.list().then((ns) => active && setAllNotes(ns.filter((n) => n.id !== id))).catch(() => {})
    return () => { active = false }
  }, [id])

  // abre o diálogo de link (disparado pelo menu "/")
  useEffect(() => {
    const open = () => setLinkOpen(true)
    window.addEventListener('nova:add-link', open)
    return () => window.removeEventListener('nova:add-link', open)
  }, [])

  const queueSave = (patch) => {
    setNote((n) => ({ ...n, ...patch }))
    setStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await notesApi.update(id, patch)
      setStatus('saved')
      onChanged?.()
      setTimeout(() => setStatus('idle'), 1500)
    }, 600)
  }

  const handleContent = (content) => {
    const patch = { content }
    const { total, checked } = countTasks(content)
    if (total > 0) {
      patch.progress = Math.round((checked / total) * 100)
      patch.done = patch.progress === 100
    }
    queueSave(patch)
  }

  const exportMd = () => {
    const blob = new Blob([note.content || ''], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(note.title || 'nota').replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importMd = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    queueSave({ content: text, title: file.name.replace(/\.md$/i, '') })
    e.target.value = ''
  }

  const confirmDelete = async () => {
    setConfirmOpen(false)
    await notesApi.remove(id)
    onDeleted?.(id)
  }

  const insertLink = ({ text, href }) => {
    setLinkOpen(false)
    const ed = editorRef.current
    if (ed) ed.chain().focus().insertContent(`<a href="${href}">${text}</a> `).run()
  }

  // clique em link: nota interna navega no app, externo abre em nova aba
  const onBodyClick = (e) => {
    const a = e.target.closest && e.target.closest('a')
    if (!a) return
    const href = a.getAttribute('href')
    if (!href) return
    e.preventDefault()
    if (href.startsWith('/note/')) navigate(href)
    else window.open(href, '_blank', 'noopener')
  }

  const toggleGoal = () => queueSave({ is_goal: !note.is_goal, emoji: !note.is_goal && note.emoji === '📄' ? '🎯' : note.emoji })
  const focusBody = () => editorRef.current?.commands.focus('start')

  if (!note) return <div className="panel">Carregando…</div>

  return (
    <div className="editor-page">
      <div className="editor-head">
        <button className={'goal-toggle' + (note.is_goal ? ' on' : '')} onClick={toggleGoal} title="Marcar como objetivo">
          <Target size={15} /> {note.is_goal ? 'Objetivo' : 'Marcar como objetivo'}
        </button>
        {note.is_goal && (() => {
          const { total, checked } = countTasks(note.content)
          if (total > 0) {
            return (
              <div className="head-progress" title="Calculado pelas tarefas marcadas">
                <div className="progress" style={{ width: 110 }}><span style={{ width: `${note.progress || 0}%` }} /></div>
                <span className="head-progress-val">{note.progress || 0}% · {checked}/{total} ✓ auto</span>
              </div>
            )
          }
          return (
            <div className="head-progress">
              <input
                className="range"
                type="range"
                min="0"
                max="100"
                value={note.progress || 0}
                onChange={(e) => queueSave({ progress: Number(e.target.value), done: Number(e.target.value) === 100 })}
              />
              <span className="head-progress-val">{note.progress || 0}%</span>
            </div>
          )
        })()}
        {status === 'saving' && <span className="save-tag"><Loader2 size={14} className="spin" /> salvando…</span>}
        {status === 'saved' && <span className="save-tag" style={{ color: 'var(--accent)' }}><Check size={14} /> salvo</span>}
        <div className="spacer" />
        <button className="icon-btn" title="Importar .md" onClick={() => fileInput.current?.click()}><Upload size={18} /></button>
        <button className="icon-btn" title="Exportar .md" onClick={exportMd}><Download size={18} /></button>
        <button className="icon-btn" title="Excluir" onClick={() => setConfirmOpen(true)}><Trash2 size={18} /></button>
        <input ref={fileInput} type="file" accept=".md,text/markdown" hidden onChange={importMd} />
      </div>

      <div className="editor-body fade-in">
        <div className="emoji-wrap">
          <button className="emoji-input" onClick={() => setEmojiOpen((o) => !o)} title="Escolher emoji">
            {note.emoji || '📄'}
          </button>
          {emojiOpen && (
            <EmojiPicker
              onPick={(e) => { queueSave({ emoji: e }); setEmojiOpen(false) }}
              onClose={() => setEmojiOpen(false)}
            />
          )}
        </div>
        <input
          className="title-input"
          placeholder="Sem título"
          value={note.title || ''}
          onChange={(e) => queueSave({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusBody() }
          }}
        />
        <div className="tags-row">
          {(note.tags || []).map((t) => (
            <span className="tag-chip" key={t}>
              {t}
              <button onClick={() => queueSave({ tags: (note.tags || []).filter((x) => x !== t) })}>×</button>
            </span>
          ))}
          <input
            className="tag-input"
            placeholder="+ tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagInput.trim()) {
                e.preventDefault()
                const t = tagInput.trim().replace(/^#/, '')
                if (t && !(note.tags || []).includes(t)) queueSave({ tags: [...(note.tags || []), t] })
                setTagInput('')
              }
            }}
          />
        </div>
        <div onClick={onBodyClick}>
          <Editor content={note.content} onChange={handleContent} onEditor={(ed) => (editorRef.current = ed)} />
        </div>
      </div>

      {linkOpen && <LinkDialog notes={allNotes} onConfirm={insertLink} onCancel={() => setLinkOpen(false)} />}
      {confirmOpen && (
        <ConfirmDialog
          title="Excluir nota"
          message={`Tem certeza que deseja excluir "${note.title || 'Sem título'}"? Esta ação não pode ser desfeita.`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
