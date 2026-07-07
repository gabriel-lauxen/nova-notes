import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import SlashMenu from './SlashMenu'
import { insertImageFiles } from './NovaImage'

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
  { title: 'Lembrete', subtitle: 'To-do que te notifica na hora certa', icon: '🔔',
    keywords: 'lembrete reminder notificacao notificação alarme aviso push alerta',
    run: (c) => {
      c.run() // apaga o "/lembrete"
      window.dispatchEvent(new CustomEvent('nova:add-reminder'))
    } },
  { title: 'Citação', subtitle: 'Bloco de citação', icon: '❝', keywords: 'citacao quote blockquote',
    run: (c) => c.toggleBlockquote().run() },
  { title: 'Código', subtitle: 'Bloco de código', icon: '</>', keywords: 'codigo code pre',
    run: (c) => c.toggleCodeBlock().run() },
  { title: 'Divisor', subtitle: 'Linha separadora', icon: '―', keywords: 'divisor linha hr separador',
    run: (c) => c.setHorizontalRule().run() },
  { title: 'Tabela', subtitle: 'Tabela 3×3 com cabeçalho', icon: '▦', keywords: 'tabela table grade',
    run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Imagem', subtitle: 'Enviar uma imagem', icon: '🖼️',
    keywords: 'imagem foto picture image upload anexar arquivo',
    run: (c, editor) => {
      c.run() // apaga o "/imagem"
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.multiple = true
      input.onchange = () => { if (input.files?.length) insertImageFiles(editor, input.files) }
      input.click()
    } },
  { title: 'Toggle', subtitle: 'Bloco colapsável (título + conteúdo)', icon: '▸',
    keywords: 'toggle colapsavel colapsável recolher expandir detalhes accordion dropdown',
    run: (c) =>
      c.insertContent({
        type: 'toggle',
        attrs: { open: true, title: '' },
        content: [{ type: 'paragraph' }],
      }).run() },
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
  { title: 'Gerar com IA', subtitle: 'Escreve com a IA', icon: '✨',
    keywords: 'ia ai gerar escrever texto gemini groq cerebras',
    run: (c) => {
      c.run()
      window.dispatchEvent(new CustomEvent('nova:ai-generate'))
    } },
  { title: 'Gerar com voz', subtitle: 'Fale e a IA escreve', icon: '🎙️',
    keywords: 'voz audio falar microfone ditar gravar transcrever',
    run: (c) => {
      c.run()
      window.dispatchEvent(new CustomEvent('nova:ai-voice'))
    } },
  { title: 'Refatorar', subtitle: 'Reescreve a nota com IA', icon: '↻',
    keywords: 'refatorar reescrever mudar alterar melhorar resumir ia ai texto',
    run: (c) => {
      c.run()
      window.dispatchEvent(new CustomEvent('nova:ai-refactor'))
    } },
  { title: 'Agente', subtitle: 'Roda um agente seu com uma instrução', icon: '🤖',
    keywords: 'agente agent prompt ia ai assistente persona',
    run: (c) => {
      c.run()
      window.dispatchEvent(new CustomEvent('nova:ai-agent'))
    } },
]

// pontua cada item pela relevância à busca (título e palavras-chave),
// pra que "ia"/"ai" tragam "Gerar com IA" antes de itens que apenas contêm
// o trecho (ex.: "diaria" no marcador de progresso).
function scoreItem(item, q) {
  const title = item.title.toLowerCase()
  const tokens = item.keywords.toLowerCase().split(/\s+/)
  if (title === q) return 100
  if (title.startsWith(q)) return 80
  if (tokens.some((k) => k === q)) return 70 // palavra-chave exata
  if (tokens.some((k) => k.startsWith(q))) return 50
  if (title.includes(q)) return 30
  if (tokens.some((k) => k.includes(q))) return 10
  return -1
}

function filterItems(query) {
  const q = (query || '').toLowerCase().trim()
  if (!q) return ITEMS
  return ITEMS.map((i, idx) => ({ i, idx, s: scoreItem(i, q) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.idx - b.idx) // empate: mantém ordem original
    .map((x) => x.i)
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
            // usa o viewport VISÍVEL (desconta o teclado no mobile)
            const vv = window.visualViewport
            const vTop = vv ? vv.offsetTop : 0
            const vh = vv ? vv.height : window.innerHeight
            // limita a altura ao espaço visível (rola se precisar)
            const menuEl = popup.querySelector('.slash-menu')
            if (menuEl) menuEl.style.maxHeight = Math.max(160, Math.min(320, vh - 16)) + 'px'
            const menuH = popup.offsetHeight || 300
            const menuW = popup.offsetWidth || 240

            let top = rect.bottom + 6
            // se não couber abaixo, tenta acima; senão encosta no topo visível
            if (top + menuH > vTop + vh - 8) {
              const above = rect.top - menuH - 6
              top = above > vTop + 8 ? above : vTop + vh - menuH - 8
            }
            top = Math.max(vTop + 8, Math.min(top, vTop + vh - menuH - 8))
            let left = Math.min(rect.left, window.innerWidth - menuW - 8)
            left = Math.max(8, left)
            popup.style.left = `${left}px`
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
