import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import { useState } from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { Markdown } from 'tiptap-markdown'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Copy, Check } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SlashCommands } from './slashCommands'
import { ProgressTracker } from './ProgressTracker'
import { Collapsible } from './Collapsible'

// Garante sempre um parágrafo vazio no fim do documento, pra dar pra clicar
// abaixo de blocos (tabela, código, toggle…) e digitar uma nova linha.
const TrailingNode = Extension.create({
  name: 'trailingNode',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('trailingNode'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return
          const { doc, tr, schema } = newState
          const last = doc.lastChild
          const needs = !last || last.type.name !== 'paragraph' || last.content.size > 0
          if (needs) return tr.insert(doc.content.size, schema.nodes.paragraph.create())
        },
      }),
    ]
  },
})

// Code block com botão de copiar (mantém o nome 'codeBlock' p/ serialização md)
function CodeBlockView({ node }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    try {
      navigator.clipboard.writeText(node.textContent || '').then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      })
    } catch {}
  }
  return (
    <NodeViewWrapper className="codeblock">
      <button
        type="button"
        className="code-copy"
        contentEditable={false}
        onClick={copy}
        title={copied ? 'Copiado' : 'Copiar'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
const CodeBlockCopy = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})

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
      const setChecked = (checked) => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        const { state, view } = editor
        const cur = state.doc.nodeAt(pos)
        if (!cur) return
        view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...cur.attrs, checked }))
      }
      checkbox.addEventListener('change', (event) => setChecked(event.target.checked))
      // no modo leitura, clicar no TEXTO do item também marca/desmarca
      content.addEventListener('click', () => {
        if (editor.isEditable) return
        const cur = typeof getPos === 'function' ? editor.state.doc.nodeAt(getPos()) : null
        setChecked(!(cur && cur.attrs.checked))
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
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
      CodeBlockCopy,
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) =>
          node.type.name === 'paragraph'
            ? "Escreva algo, ou digite '/' para inserir blocos…"
            : '',
      }),
      TaskList,
      CheckTaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ProgressTracker,
      Collapsible,
      TrailingNode,
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
