import { useMemo } from 'react'

// "Digital rain" da Matrix em 1–2 cantos aleatórios: colunas de símbolos/
// letras caindo devagar, bem discretas, na cor primária. Não bloqueia cliques.

const CORNERS = ['tl', 'tr', 'bl', 'br']
const POOL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノﾊﾋﾌﾍﾎ0123456789ABCDFHKLMNXZ#$%&*<>=+:'
const rand = (a, b) => a + Math.random() * (b - a)
const pick = () => POOL[Math.floor(Math.random() * POOL.length)]

function Column({ x, off, bottom }) {
  const { chars, dur, delay } = useMemo(() => {
    const len = 3 + Math.floor(Math.random() * 38) // comprimentos bem variados (curtas e bem longas)
    return {
      chars: Array.from({ length: len }, pick),
      dur: rand(6, 11).toFixed(1),
      delay: rand(0, 6).toFixed(1),
    }
  }, [])
  return (
    <div className="mr-col" style={{ left: x, top: off }}>
      <div className="mr-stream" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
        {chars.concat(chars).map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    </div>
  )
}

const WIDTH = 168

const SLOT = 15 // espaçamento base entre colunas

function Corner({ pos }) {
  const cols = useMemo(() => {
    const n = Math.floor(WIDTH / SLOT) + 1
    // grade com bastante jitter: gera sobreposições e alguns espaços em branco
    // off enviesado pra borda (cobre a borda; a variação fica no comprimento)
    return Array.from({ length: n }, (_, i) => ({ x: Math.round(i * SLOT + rand(-8, 8)), off: Math.round(rand(-45, 6)) }))
  }, [])
  return (
    <div className={'matrix-rain ' + pos} aria-hidden="true">
      {cols.map((c, i) => (
        <Column key={i} x={c.x} off={c.off} />
      ))}
    </div>
  )
}

const DIAGONALS = [['tl', 'br'], ['tr', 'bl']]

export default function MatrixGlitch() {
  const corners = useMemo(() => {
    // um único canto, ou dois em diagonal oposta (nunca adjacentes)
    if (Math.random() < 0.5) return [CORNERS[Math.floor(Math.random() * 4)]]
    return DIAGONALS[Math.floor(Math.random() * 2)]
  }, [])
  return (
    <>
      {corners.map((c) => (
        <Corner key={c} pos={c} />
      ))}
    </>
  )
}
