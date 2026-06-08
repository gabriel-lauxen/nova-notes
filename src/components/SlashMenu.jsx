import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

// Menu que aparece ao digitar "/" — navegável por teclado e mouse.
const SlashMenu = forwardRef(function SlashMenu({ items, command }, ref) {
  const [sel, setSel] = useState(0)
  useEffect(() => setSel(0), [items])

  const pick = (i) => {
    const item = items[i]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSel((s) => (s + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSel((s) => (s + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        pick(sel)
        return true
      }
      return false
    },
  }))

  if (!items.length) return <div className="slash-menu"><div className="slash-empty">Nada encontrado</div></div>

  return (
    <div className="slash-menu">
      {items.map((it, i) => (
        <button
          key={it.title}
          className={'slash-item' + (i === sel ? ' active' : '')}
          onMouseEnter={() => setSel(i)}
          onMouseDown={(e) => { e.preventDefault(); pick(i) }}
        >
          <span className="slash-ico">{it.icon}</span>
          <span className="slash-text">
            <span className="slash-t">{it.title}</span>
            <span className="slash-s">{it.subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  )
})

export default SlashMenu
