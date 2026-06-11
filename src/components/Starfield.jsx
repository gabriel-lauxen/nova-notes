import { useEffect, useRef } from 'react'
import { getStarSpin } from '../lib/warp'

const TAU = Math.PI * 2
const SPIN_DUR = 1.4 // segundos do giro (bem lento)
const SPIN_DELTA = 0.16 // quanto gira no total (rad) — bem sutil, flutuando

// Fundo de estrelas (cintilando) para todas as páginas. Fica atrás do
// conteúdo; cards e painéis semitransparentes deixam ele aparecer.
// Durante o "carregando" as estrelas giram calmamente em torno do centro
// e ganham a cor primária clarinha.
export default function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, raf, t = 0
    let stars = []
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let warpR = 255, warpG = 255, warpB = 255
    // estado do giro único
    let rot = 0, prevRot = 0, spinBase = 0, spinT = 0, spinning = false, lastSpin = 0

    // cor primária clarinha (mistura o --accent com branco)
    const computeWarpColor = () => {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a855f7'
        ctx.fillStyle = v
        const n = ctx.fillStyle
        let r, g, b
        if (n[0] === '#') {
          r = parseInt(n.slice(1, 3), 16); g = parseInt(n.slice(3, 5), 16); b = parseInt(n.slice(5, 7), 16)
        } else {
          const m = n.match(/\d+/g) || [168, 85, 247]
          r = +m[0]; g = +m[1]; b = +m[2]
        }
        // mantém praticamente a cor primária (clareia só um pouco p/ destacar)
        warpR = Math.round(r + (255 - r) * 0.15)
        warpG = Math.round(g + (255 - g) * 0.15)
        warpB = Math.round(b + (255 - b) * 0.15)
      } catch {
        warpR = warpG = warpB = 255
      }
    }

    const build = () => {
      // distribui num DISCO que cobre os cantos da tela em qualquer rotação
      // (senão sobra canto em branco ao girar). Raio = meia-diagonal + folga.
      const R = (Math.hypot(W, H) / 2) * 1.06
      const area = Math.PI * R * R
      const n = Math.min(440, Math.round(area / 7000))
      stars = Array.from({ length: n }, () => {
        const a0 = Math.random() * TAU
        const r0 = R * Math.sqrt(Math.random()) // distribuição uniforme no disco
        return {
          size: Math.random() < 0.12 ? 1.4 + Math.random() * 1.1 : 0.4 + Math.random() * 0.9,
          tw: Math.random() * TAU,
          sp: 0.4 + Math.random() * 1.4,
          base: 0.2 + Math.random() * 0.4,
          r0,
          a0,
        }
      })
    }

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      W = rect.width; H = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
    }
    window.addEventListener('resize', resize)
    resize()

    const render = () => {
      t += 0.016

      // dispara o giro único quando chega um novo timestamp
      const ss = getStarSpin()
      if (ss && ss !== lastSpin) {
        lastSpin = ss
        spinT = 0
        spinning = true
        spinBase = rot
      }
      // giro lento e curto que desacelera até parar (sem rastro)
      if (spinning) {
        spinT += 0.016
        const p = Math.min(1, spinT / SPIN_DUR)
        const eased = 1 - Math.pow(1 - p, 2) // easeOut: desacelera até parar
        rot = spinBase + eased * SPIN_DELTA
        if (p >= 1) spinning = false
      }

      ctx.clearRect(0, 0, W, H)
      const cx = W / 2, cy = H / 2

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        const ang = s.a0 + rot
        const x = cx + s.r0 * Math.cos(ang)
        const y = cy + s.r0 * Math.sin(ang)
        const a = Math.max(0, s.base + Math.sin(t * s.sp + s.tw) * 0.22)
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.beginPath()
        ctx.arc(x, y, s.size, 0, TAU)
        ctx.fill()
      }
      raf = requestAnimationFrame(render)
    }
    render()

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="starfield" />
}
