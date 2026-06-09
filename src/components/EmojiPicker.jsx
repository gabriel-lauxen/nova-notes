import { useEffect } from 'react'

// Seletor de emojis simples (sem dependências). Clique escolhe; Esc/fora fecha.
const GROUPS = [
  { label: 'Frequentes', items: '📄 📝 ✅ ⭐ 🎯 🔥 💡 🚀 📌 ❤️ 🎵 💪 🧠 📚 ☕'.split(' ') },
  { label: 'Rostos', items: '😀 😄 😁 😊 🙂 😉 😍 🤩 😎 🤔 😅 😌 😴 😭 😡 🥳 🤯 🙃 😬 🥺 😇 🤓'.split(' ') },
  { label: 'Gestos & pessoas', items: '👍 👎 👏 🙏 💪 🦾 🫶 ✌️ 🤞 👀 🧘 🏃 🚶 🏋️ 🚴 🧗 💃'.split(' ') },
  { label: 'Natureza', items: '🌟 ✨ ⚡ 🌈 💧 🌊 🌱 🌳 🍃 🍁 🍀 🌸 🌙 ☀️ ⛅ ❄️ 🪐 🌍 🐾 🦋'.split(' ') },
  { label: 'Objetos', items: '📖 ✏️ 🖊️ 📒 📓 💻 📱 ⌚ 🎧 📷 🔑 🔒 💰 🛒 🎁 🏆 🥇 ⏰ ⏳ 📅 🗓️ 📊 📈 📉 💼 🎒 🩺 💊'.split(' ') },
  { label: 'Comida', items: '🍎 🍌 🥦 🥗 🍳 🍞 ☕ 🍵 🍫 🍪 🥤 🍕 🍣 🥑'.split(' ') },
  { label: 'Atividades', items: '⚽ 🏀 🎮 👾 🎸 🎹 🎨 ✈️ 🚗 🏠 🎬 🎤 🎲 🧩'.split(' ') },
  { label: 'Símbolos', items: '❤️ 🧡 💛 💚 💙 💜 🖤 ✅ ❌ ⚠️ ❗ ❓ 💯 ➕ ➖ ☑️ 🔵 🟢 🟣 🔴'.split(' ') },
]

export default function EmojiPicker({ onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="emoji-backdrop" onClick={onClose} />
      <div className="emoji-picker">
        {GROUPS.map((g) => (
          <div className="emoji-group" key={g.label}>
            <div className="emoji-group-label">{g.label}</div>
            <div className="emoji-grid">
              {g.items.map((e, i) => (
                <button key={g.label + i} className="emoji-opt" onClick={() => onPick(e)}>{e}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
