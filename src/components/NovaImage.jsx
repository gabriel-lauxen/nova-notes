import { useEffect, useRef, useState } from 'react'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { uploadImage, signedUrl, isImageFile } from '../lib/images'

const esc = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Node view: guarda o CAMINHO do Storage em `src`, exibe via URL assinada e
// permite redimensionar arrastando o canto. Imagens com largura definida ficam
// centralizadas.
function ImageView({ node, updateAttributes, selected, editor }) {
  const src = node.attrs.src || ''
  const alt = node.attrs.alt || ''
  const width = node.attrs.width
  const imgRef = useRef(null)
  const [url, setUrl] = useState(/^(https?:|data:|blob:)/.test(src) ? src : '')
  const [err, setErr] = useState(false)

  useEffect(() => {
    let live = true
    setErr(false)
    signedUrl(src)
      .then((u) => live && setUrl(u))
      .catch(() => live && setErr(true))
    return () => {
      live = false
    }
  }, [src])

  const onResizeDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = imgRef.current ? imgRef.current.getBoundingClientRect().width : width || 300
    const maxW = imgRef.current?.parentElement?.parentElement?.getBoundingClientRect().width || 760
    const onMove = (ev) => {
      const w = Math.max(80, Math.min(maxW, Math.round(startW + (ev.clientX - startX))))
      updateAttributes({ width: w })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <NodeViewWrapper className={'note-img' + (selected ? ' selected' : '')}>
      <div className="note-img-box">
        {err ? (
          <div className="note-img-ph">imagem indisponível</div>
        ) : url ? (
          <img
            ref={imgRef}
            src={url}
            alt={alt}
            draggable={false}
            contentEditable={false}
            style={{ width: width ? width + 'px' : undefined }}
          />
        ) : (
          <div className="note-img-ph">carregando imagem…</div>
        )}
        {editor.isEditable && url && !err && (
          <span className="img-resize" onPointerDown={onResizeDown} title="Arraste para redimensionar" />
        )}
      </div>
    </NodeViewWrapper>
  )
}

// faz upload de cada arquivo e insere o nó de imagem (mantém a ordem)
export async function insertImageFiles(editor, fileList, pos) {
  const files = Array.from(fileList || []).filter(isImageFile)
  let at = pos
  for (const file of files) {
    try {
      const path = await uploadImage(file)
      const attrs = { src: path, alt: (file.name || '').replace(/\.[^.]+$/, '') }
      if (at == null) {
        editor.chain().focus().insertContent({ type: 'image', attrs }).run()
      } else {
        editor.chain().insertContentAt(at, { type: 'image', attrs }).run()
        at += 1
      }
    } catch (e) {
      console.error('[NOVA] falha ao enviar imagem', e)
    }
  }
}

export const NovaImage = Image.extend({
  priority: 200,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('width') || el.style?.width
          const n = parseInt(w, 10)
          return Number.isFinite(n) && n > 0 ? n : null
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },

  // markdown: sem largura -> ![alt](path); com largura -> bloco HTML (persiste o tamanho)
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const { src, alt, width } = node.attrs
          if (width) {
            state.write(`<div data-nova-img="1"><img src="${esc(src)}" alt="${esc(alt)}" width="${Math.round(width)}"></div>`)
          } else {
            state.write(`![${esc(alt)}](${src || ''})`)
          }
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          // colar imagem (print/clipboard)
          handlePaste(view, event) {
            const items = event.clipboardData?.items
            if (!items) return false
            const files = []
            for (const it of items) {
              if (it.kind === 'file' && /^image\//.test(it.type)) {
                const f = it.getAsFile()
                if (f) files.push(f)
              }
            }
            if (!files.length) return false
            event.preventDefault()
            insertImageFiles(editor, files, view.state.selection.from)
            return true
          },
          // arrastar arquivo de imagem de fora pra dentro da nota
          handleDrop(view, event) {
            const files = event.dataTransfer?.files
            const imgs = files ? Array.from(files).filter(isImageFile) : []
            if (!imgs.length) return false
            event.preventDefault()
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
            insertImageFiles(editor, imgs, pos)
            return true
          },
        },
      }),
    ]
  },
})
