import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef } from 'react'
import { SlashCommands } from './slashCommands'
import { ProgressTracker } from './ProgressTracker'

// TaskItem com node view própria: o checkbox atualiza o nó via getPos (sempre
// atual) em qualquer modo — inclusive leitura — sem depender de identidade.
const CheckTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const li = document.createElement('li')
      const label = document.createElement('label')
      const styler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createElement('div')
      label.contentEditable = 'false'
      checkbox.type = 'checkbox'
      checkbox.checked = node.attrs.checked
      checkbox.addEventListener('mousedown', (e) => e.preventDefault())
      checkbox.addEventListener('change', (event) => {
        const checked = event.target.checked
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        const { state, view } = editor
        const cur = state.doc.nodeAt(pos)
        view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...(cur && cur.attrs), checked }))
      })
      Object.entries(this.options.HTMLAttributes).forEach(([k, v]) => li.setAttribute(k, v))
      li.dataset.checked = node.attrs.checked
      label.append(checkbox, styler)
      li.append(label, content)
      Object.entries(HTMLAttributes).forEach(([k, v]) => li.setAttribute(k, v))
      return {
        dom: li,
        contentDOM: content,
        update: (updated) => {
          if (updated.type !== this.type) return false
          li.dataset.checked = updated.attrs.checked
          checkbox.checked = updated.attrs.checked
          return true
        },
      }
    }
  },
})

// Editor de texto rico com armazenamento em Markdown.
// onChange recebe o conteúdo já convertido para markdown.
// onEditor entrega a instância (para foco a partir do título, etc).
export default function Editor({ content, onChange, onEditor, editable = true }) {
  const edRef = useRef(null)
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: "Escreva algo, ou digite '/' para inserir blocos…",
      }),
      TaskList,
      CheckTaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ProgressTracker,
      SlashCommands,
      Markdown.configure({ html: true, linkify: true, transformPastedText: true, transformCopiedText: true }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  })

  useEffect(() => {
    if (editor) {
      edRef.current = editor
      onEditor?.(editor)
    }
  }, [editor, onEditor])

  // alterna modo leitura (sem teclado) mantendo checkbox clicável
  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editor, editable])

  // recarrega conteúdo ao trocar de documento
  useEffect(() => {
    if (!editor) return
    const current = editor.storage.markdown.getMarkdown()
    if ((content || '') !== current) editor.commands.setContent(content || '', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  return <EditorContent editor={editor} />
}
