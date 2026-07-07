import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Type, Heading1, Heading2, Heading3, List, ListChecks, Quote, Code } from 'lucide-react'

// opções de "transformar em" (usa clearNodes pra normalizar antes de aplicar,
// então um to-do vira h1, um h1 vira lista, etc.)
const TRANSFORMS = [
  { label: 'Texto', Icon: Type, apply: (c) => c.clearNodes().run() },
  { label: 'Título 1', Icon: Heading1, apply: (c) => c.clearNodes().setNode('heading', { level: 1 }).run() },
  { label: 'Título 2', Icon: Heading2, apply: (c) => c.clearNodes().setNode('heading', { level: 2 }).run() },
  { label: 'Título 3', Icon: Heading3, apply: (c) => c.clearNodes().setNode('heading', { level: 3 }).run() },
  { label: 'Lista', Icon: List, apply: (c) => c.clearNodes().toggleBulletList().run() },
  { label: 'To-do', Icon: ListChecks, apply: (c) => c.clearNodes().toggleTaskList().run() },
  { label: 'Citação', Icon: Quote, apply: (c) => c.clearNodes().toggleBlockquote().run() },
  { label: 'Código', Icon: Code, apply: (c) => c.clearNodes().toggleCodeBlock().run() },
]

// Menu que abre ao clicar no drag handle de um bloco: transformar ou excluir.
export default function BlockHandleMenu({ editor }) {
  const [menu, setMenu] = useState(null) // { x, y, pos }

  useEffect(() => {
    // clicar no mesmo handle de novo fecha (toggle); em outro bloco, troca
    const onOpen = (e) =>
      setMenu((prev) => (prev && prev.pos === e.detail.pos ? null : { x: e.detail.x, y: e.detail.y, pos: e.detail.pos }))
    const onKey = (e) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('nova:block-menu', onOpen)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('nova:block-menu', onOpen)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!menu || !editor) return null

  const at = () => editor.chain().focus().setTextSelection(menu.pos + 1)
  const transform = (t) => {
    t.apply(at())
    setMenu(null)
  }
  const del = () => {
    const node = editor.state.doc.nodeAt(menu.pos)
    if (node) editor.chain().focus().deleteRange({ from: menu.pos, to: menu.pos + node.nodeSize }).run()
    setMenu(null)
  }

  // mantém o menu dentro da tela
  const top = Math.min(menu.y, window.innerHeight - 360)
  const left = Math.min(menu.x, window.innerWidth - 190)

  return createPortal(
    <>
      <div
        className="menu-backdrop"
        onClick={() => setMenu(null)}
        onContextMenu={(e) => { e.preventDefault(); setMenu(null) }}
      />
      <div className="card-menu block-menu" style={{ position: 'fixed', top: Math.max(8, top), left: Math.max(8, left), right: 'auto', zIndex: 200 }}>
        <div className="block-menu-label">Transformar em</div>
        {TRANSFORMS.map((t) => (
          <button key={t.label} onClick={() => transform(t)}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
        <div className="block-menu-sep" />
        <button className="danger" onClick={del}>
          <Trash2 size={14} /> Excluir bloco
        </button>
      </div>
    </>,
    document.body,
  )
}
