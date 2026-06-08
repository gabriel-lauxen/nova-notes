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
import { useEffect } from 'react'
import { SlashCommands } from './slashCommands'
import { ProgressTracker } from './ProgressTracker'

// Editor de texto rico com armazenamento em Markdown.
// onChange recebe o conteúdo já convertido para markdown.
// onEditor entrega a instância (para foco a partir do título, etc).
export default function Editor({ content, onChange, onEditor }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: "Escreva algo, ou digite '/' para inserir blocos…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
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
    if (editor && onEditor) onEditor(editor)
  }, [editor, onEditor])

  // recarrega conteúdo ao trocar de documento
  useEffect(() => {
    if (!editor) return
    const current = editor.storage.markdown.getMarkdown()
    if ((content || '') !== current) editor.commands.setContent(content || '', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  return <EditorContent editor={editor} />
}
