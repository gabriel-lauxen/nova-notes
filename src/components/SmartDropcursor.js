import { Extension } from '@tiptap/core'
import { Plugin, NodeSelection } from '@tiptap/pm/state'
import { dropPoint } from '@tiptap/pm/transform'

// acha o ancestral que realmente rola (no app é o .editor-page)
function findScrollParent(el) {
  let n = el?.parentElement
  while (n) {
    const s = getComputedStyle(n)
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n
    n = n.parentElement
  }
  return document.scrollingElement || document.documentElement
}

// true se a posição cair dentro de qualquer tabela
function isInsideTable(doc, pos) {
  const p = Math.max(0, Math.min(pos, doc.content.size))
  const $p = doc.resolve(p)
  for (let d = $p.depth; d > 0; d--) {
    if ($p.node(d).type.name === 'table') return true
  }
  return false
}

// intervalo (e nó) do bloco de nível superior que contém `pos`
function topLevelRange(doc, pos) {
  const p = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(p)
  if ($pos.depth === 0) {
    const node = $pos.nodeAfter
    if (!node) return null
    return { from: p, to: p + node.nodeSize, node }
  }
  const before = $pos.before(1)
  const node = $pos.node(1)
  return { from: before, to: before + node.nodeSize, node }
}

// posição de drop SEMPRE numa borda de bloco top-level (nunca inline/entre letras):
// escolhe antes/depois do bloco sob o cursor pela metade da altura.
function blockDropPos(view, clientX, clientY) {
  const posInfo = view.posAtCoords({ left: clientX, top: clientY })
  if (!posInfo) return null
  const doc = view.state.doc
  const $pos = doc.resolve(Math.max(0, Math.min(posInfo.pos, doc.content.size)))
  if ($pos.depth === 0) return posInfo.pos
  const before = $pos.before(1)
  const node = $pos.node(1)
  const after = before + node.nodeSize
  const dom = view.nodeDOM(before)
  if (dom && dom.getBoundingClientRect) {
    const r = dom.getBoundingClientRect()
    return clientY < r.top + r.height / 2 ? before : after
  }
  return after
}

// Fork enxuto do prosemirror-dropcursor que NÃO mostra a linha nas posições
// imediatamente acima/abaixo do bloco que está sendo arrastado (seriam no-op).
class DropCursorView {
  constructor(editorView, options) {
    this.editorView = editorView
    this.cursorPos = null
    this.element = null
    this.timeout = -1
    this.width = options.width ?? 1
    this.color = options.color || 'black'
    this.class = options.class
    this.scrollEl = null
    this.scrollRAF = 0
    this.lastY = 0
    this.handlers = ['dragover', 'dragend', 'drop', 'dragleave'].map((name) => {
      const handler = (e) => this[name](e)
      editorView.dom.addEventListener(name, handler)
      return { name, handler }
    })
    // auto-scroll escuta no document inteiro -> rola mesmo quando o cursor
    // sobe pra fora do editor (área do título), nos dois sentidos
    this.docHandlers = [
      ['dragover', (e) => this.autoScrollFromEvent(e)],
      ['dragend', () => this.stopAutoScroll()],
      ['drop', () => this.stopAutoScroll()],
    ]
    this.docHandlers.forEach(([n, h]) => document.addEventListener(n, h))
  }
  destroy() {
    this.stopAutoScroll()
    this.handlers.forEach(({ name, handler }) => this.editorView.dom.removeEventListener(name, handler))
    this.docHandlers.forEach(([n, h]) => document.removeEventListener(n, h))
  }
  autoScrollFromEvent(event) {
    if (!this.editorView.dragging) return // só durante arraste de blocos
    this.lastY = event.clientY
    if (!this.scrollEl) this.scrollEl = findScrollParent(this.editorView.dom)
    this.startAutoScroll()
  }
  update(editorView, prevState) {
    if (this.cursorPos != null && prevState.doc != editorView.state.doc) {
      if (this.cursorPos > editorView.state.doc.content.size) this.setCursor(null)
      else this.updateOverlay()
    }
  }
  setCursor(pos) {
    if (pos == this.cursorPos) return
    this.cursorPos = pos
    if (pos == null) {
      this.element?.parentNode?.removeChild(this.element)
      this.element = null
    } else {
      this.updateOverlay()
    }
  }
  updateOverlay() {
    const $pos = this.editorView.state.doc.resolve(this.cursorPos)
    const isBlock = !$pos.parent.inlineContent
    let rect
    const editorDOM = this.editorView.dom
    const editorRect = editorDOM.getBoundingClientRect()
    const scaleX = editorRect.width / editorDOM.offsetWidth
    const scaleY = editorRect.height / editorDOM.offsetHeight
    if (isBlock) {
      const before = $pos.nodeBefore
      const after = $pos.nodeAfter
      if (before || after) {
        const node = this.editorView.nodeDOM(this.cursorPos - (before ? before.nodeSize : 0))
        if (node) {
          const nodeRect = node.getBoundingClientRect()
          let top = before ? nodeRect.bottom : nodeRect.top
          if (before && after)
            top = (top + this.editorView.nodeDOM(this.cursorPos).getBoundingClientRect().top) / 2
          const halfWidth = (this.width / 2) * scaleY
          rect = { left: nodeRect.left, right: nodeRect.right, top: top - halfWidth, bottom: top + halfWidth }
        }
      }
    }
    if (!rect) {
      const coords = this.editorView.coordsAtPos(this.cursorPos)
      const halfWidth = (this.width / 2) * scaleX
      rect = { left: coords.left - halfWidth, right: coords.left + halfWidth, top: coords.top, bottom: coords.bottom }
    }
    const parent = this.editorView.dom.offsetParent
    if (!this.element) {
      this.element = parent.appendChild(document.createElement('div'))
      if (this.class) this.element.className = this.class
      this.element.style.cssText = 'position: absolute; z-index: 50; pointer-events: none;'
      this.element.style.backgroundColor = this.color
    }
    this.element.classList.toggle('prosemirror-dropcursor-block', isBlock)
    this.element.classList.toggle('prosemirror-dropcursor-inline', !isBlock)
    let parentLeft, parentTop
    if (!parent || (parent == document.body && getComputedStyle(parent).position == 'static')) {
      parentLeft = -window.pageXOffset
      parentTop = -window.pageYOffset
    } else {
      const r = parent.getBoundingClientRect()
      const psX = r.width / parent.offsetWidth
      const psY = r.height / parent.offsetHeight
      parentLeft = r.left - parent.scrollLeft * psX
      parentTop = r.top - parent.scrollTop * psY
    }
    this.element.style.left = (rect.left - parentLeft) / scaleX + 'px'
    this.element.style.top = (rect.top - parentTop) / scaleY + 'px'
    this.element.style.width = (rect.right - rect.left) / scaleX + 'px'
    this.element.style.height = (rect.bottom - rect.top) / scaleY + 'px'
  }
  scheduleRemoval(timeout) {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.setCursor(null), timeout)
  }
  // rola suavemente o container quando o cursor chega perto do topo/fundo
  startAutoScroll() {
    if (this.scrollRAF) return
    const edge = 72
    const maxSpeed = 18
    const step = () => {
      const el = this.scrollEl
      if (!el) {
        this.scrollRAF = 0
        return
      }
      const rect = el.getBoundingClientRect()
      let dy = 0
      if (this.lastY < rect.top + edge) dy = -Math.ceil(((rect.top + edge - this.lastY) / edge) * maxSpeed)
      else if (this.lastY > rect.bottom - edge) dy = Math.ceil(((this.lastY - (rect.bottom - edge)) / edge) * maxSpeed)
      if (dy) el.scrollTop += dy
      this.scrollRAF = requestAnimationFrame(step)
    }
    this.scrollRAF = requestAnimationFrame(step)
  }
  stopAutoScroll() {
    if (this.scrollRAF) cancelAnimationFrame(this.scrollRAF)
    this.scrollRAF = 0
    this.scrollEl = null
  }
  dragover(event) {
    if (!this.editorView.editable) return
    const view = this.editorView
    const dragging = view.dragging
    const doc = view.state.doc

    // arrastando uma TABELA: alvo só em borda de bloco (linha horizontal),
    // nunca dentro de tabela nem entre letras de um texto
    if (dragging && dragging.slice) {
      const src = topLevelRange(doc, view.state.selection.from)
      if (src && src.node.type.name === 'table') {
        const target = blockDropPos(view, event.clientX, event.clientY)
        if (target == null || (target >= src.from && target <= src.to) || isInsideTable(doc, target)) {
          this.setCursor(null)
          this.scheduleRemoval(5000)
          return
        }
        this.setCursor(target)
        this.scheduleRemoval(5000)
        return
      }
    }

    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
    const node = pos && pos.inside >= 0 && doc.nodeAt(pos.inside)
    const disable = node && node.type.spec.disableDropCursor
    const disabled = typeof disable == 'function' ? disable(view, pos, event) : disable
    if (pos && !disabled) {
      let target = pos.pos
      if (dragging && dragging.slice) {
        const point = dropPoint(doc, target, dragging.slice)
        if (point != null) target = point
        // dentro de uma tabela não é zona de drop -> sem linha
        if (isInsideTable(doc, target)) {
          this.setCursor(null)
          this.scheduleRemoval(5000)
          return
        }
        // esconde a linha se a soltura cair coladinha no bloco arrastado (no-op)
        const sel = view.state.selection
        if (target === sel.from || target === sel.to) {
          this.setCursor(null)
          this.scheduleRemoval(5000)
          return
        }
      }
      this.setCursor(target)
      this.scheduleRemoval(5000)
    }
  }
  dragend() {
    this.stopAutoScroll()
    this.scheduleRemoval(20)
  }
  drop() {
    this.stopAutoScroll()
    this.scheduleRemoval(20)
  }
  dragleave(event) {
    // não para o auto-scroll aqui: ao subir pro topo o cursor sai do editor
    // e ainda queremos rolar pra cima (o drop/dragend é que param)
    if (!this.editorView.dom.contains(event.relatedTarget)) this.setCursor(null)
  }
}

export const SmartDropcursor = Extension.create({
  name: 'smartDropcursor',
  addOptions() {
    return { color: 'var(--accent)', width: 4, class: 'nova-dropcursor' }
  },
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({ view: (editorView) => new DropCursorView(editorView, options) }),
      new Plugin({
        props: {
          handleDrop(view, event) {
            const dragging = view.dragging
            if (!dragging || !dragging.slice) return false
            const doc = view.state.doc
            // bloco top-level que está sendo arrastado (o pacote pode ter
            // selecionado uma linha/célula; subimos até o nó de verdade)
            const src = topLevelRange(doc, view.state.selection.from)

            if (!src || src.node.type.name !== 'table') {
              // não-tabela: só impede soltar dentro de uma tabela; o resto segue o padrão
              const posInfo = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (posInfo) {
                let t = dropPoint(doc, posInfo.pos, dragging.slice)
                if (t == null) t = posInfo.pos
                if (isInsideTable(doc, t)) {
                  event.preventDefault()
                  return true
                }
              }
              return false
            }

            // TABELA: move de verdade (deleta origem + insere), só em borda de bloco
            const target = blockDropPos(view, event.clientX, event.clientY)
            if (
              target == null ||
              isInsideTable(doc, target) ||
              (target >= src.from && target <= src.to)
            ) {
              event.preventDefault()
              return true
            }
            const node = doc.nodeAt(src.from)
            if (!node) return false
            const tr = view.state.tr.delete(src.from, src.to)
            const insertPos = tr.mapping.map(target)
            tr.insert(insertPos, node)
            try {
              tr.setSelection(NodeSelection.create(tr.doc, insertPos))
            } catch {}
            view.dispatch(tr.scrollIntoView())
            event.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})
