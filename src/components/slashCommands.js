import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import SlashMenu from './SlashMenu'

// Itens do menu "/". Cada um sabe como se transformar no bloco desejado.
const ITEMS = [
  { title: 'Texto', subtitle: 'Parágrafo simples', icon: '¶', keywords: 'texto paragrafo p',
    run: (c) => c.setParagraph().run() },
  { title: 'Título 1', subtitle: 'Cabeçalho grande', icon: 'H₁', keywords: 'titulo heading h1',
    run: (c) => c.toggleHeading({ level: 1 }).run() },
  { title: 'Título 2', subtitle: 'Cabeçalho médio', icon: 'H₂', keywords: 'titulo heading h2',
    run: (c) => c.toggleHeading({ level: 2 }).run() },
  { title: 'Título 3', subtitle: 'Cabeçalho pequeno', icon: 'H₃', keywords: 'titulo heading h3',
    run: (c) => c.toggleHeading({ level: 3 }).run() },
  { title: 'Lista', subtitle: 'Lista com marcadores', icon: '•', keywords: 'lista bullet ul',
    run: (c) => c.toggleBulletList().run() },
  { title: 'Lista numerada', subtitle: '1. 2. 3.', icon: '1.', keywords: 'lista numerada ordered ol',
    run: (c) => c.toggleOrderedList().run() },
  { title: 'To-do', subtitle: 'Lista de tarefas', icon: '☑', keywords: 'todo tarefa checkbox task',
    run: (c) => c.toggleTaskList().run() },
  { title: 'Citação', subtitle: 'Bloco de citação', icon: '❝', keywords: 'citacao quote blockquote',
    run: (c) => c.toggleBlockquote().run() },
  { title: 'Código', subtitle: 'Bloco de código', icon: '</>', keywords: 'codigo code pre',
    run: (c) => c.toggleCodeBlock().run() },
  { title: 'Divisor', subtitle: 'Linha separadora', icon: '―', keywords: 'divisor linha hr separador',
    run: (c) => c.setHorizontalRule().run() },
  { title: 'Tabela', subtitle: 'Tabela 3×3 com cabeçalho', icon: '▦', keywords: 'tabela table grade',
    run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Marcador de progresso', subtitle: 'Grade de dias p/ hábito diário', icon: '▣',
    keywords: 'progresso habito dias tracker streak meta diaria checkbox',
    run: (c) => {
      const n = parseInt(window.prompt('Quantos dias? (ex.: 7, 30, 90)', '7'), 10)
      if (!n || n < 1) return c.run()
      return c.insertContent({ type: 'progressTracker', attrs: { count: Math.min(n, 366), done: '', label: '' } }).run()
    } },
  { title: 'Link', subtitle: 'URL ou outra nota', icon: '🔗', keywords: 'link url hyperlink nota',
    run: (c) => {
      c.run() // remove o "/link"
      window.dispatchEvent(new CustomEvent('nova:add-link'))
    } },
  { title: 'Gerar com IA', subtitle: 'Escreve com o Gemini', icon: '✨',
    keywords: 'ia ai gemini gerar escrever texto',
    run: (c) => {
      c.run()
      window.dispatchEvent(new CustomEvent('nova:ai-generate'))
    } },
]

function filterItems(query) {
  const q = (query || '').toLowerCase().trim()
  if (!q) return ITEMS
  return ITEMS.filter((i) => (i.title + ' ' + i.keywords).toLowerCase().includes(q))
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        // ao escolher um item: apaga o "/..." e executa a transformação
        command: ({ editor, range, props }) => {
          const chain = editor.chain().focus().deleteRange(range)
          props.run(chain, editor)
        },
        items: ({ query }) => filterItems(query),
        render: () => {
          let component
          let popup

          const place = (props) => {
            const rect = props.clientRect?.()
            if (!rect || !popup) return
            const menuH = popup.offsetHeight || 320
            const below = rect.bottom + 6
            const top = below + menuH > window.innerHeight ? rect.top - menuH - 6 : below
            popup.style.left = `${rect.left}px`
            popup.style.top = `${top}px`
          }

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, { props, editor: props.editor })
              popup = document.createElement('div')
              popup.className = 'slash-popup'
              document.body.appendChild(popup)
              popup.appendChild(component.element)
              place(props)
            },
            onUpdate: (props) => {
              component.updateProps(props)
              place(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.remove()
                return true
              }
              return component.ref?.onKeyDown(props)
            },
            onExit: () => {
              popup?.remove()
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
