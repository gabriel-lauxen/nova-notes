import { useEffect, useRef } from 'react'
import { getWarp } from '../lib/warp'

const TAU = Math.PI * 2

// Fundo de estrelas (cintilando) para todas as páginas. Fica atrás do
// conteúdo; cards e painéis semitransparentes deixam ele aparecer.
// Durante o "carregando" entra em modo hiperespaço (riscos saindo do centro).
export default function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, raf, t = 0, warpLevel = 0
    let stars = []
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let warpRGB = '255,255,255'
    let wasWarp = false

    // cor primária clarinha (mistura o --accent com branco) p/ os riscos do warp
    const computeWarpColor = () => {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a855f7'
        ctx.fillStyle = v
        const n = ctx.fillStyle // normalizado p/ #rrggbb ou rgb()
        let r, g, b
        if (n[0] === '#') {
          r = parseInt(n.slice(1, 3), 16); g = parseInt(n.slice(3, 5), 16); b = parseInt(n.slice(5, 7), 16)
        } else {
          const m = n.match(/\d+/g) || [168, 85, 247]
          r = +m[0]; g = +m[1]; b = +m[2]
        }
        // clareia ~55% em direção ao branco
        r = Math.round(r + (255 - r) * 0.55)
        g = Math.round(g + (255 - g) * 0.55)
        b = Math.round(b + (255 - b) * 0.55)
        warpRGB = `${r},${g},${b}`
      } catch {
        warpRGB = '255,255,255'
      }
    }

    const build = () => {
      const n = Math.min(260, Math.round((W * H) / 6500))
      const maxDim = Math.max(W, H)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() < 0.12 ? 1.4 + Math.random() * 1.1 : 0.4 + Math.random() * 0.9,
        tw: Math.random() * TAU,
        sp: 0.4 + Math.random() * 1.4,
        base: 0.2 + Math.random() * 0.4,
        // campos do modo hiperespaço
        wa: Math.random() * TAU,
        wr: Math.random() * maxDim * 0.5,
        ws: 2 + Math.random() * 4.5,
      }))
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
      // entra/sai do hiperespaço suavemente
      const warpOn = getWarp()
      if (warpOn && !wasWarp) computeWarpColor() // recalcula a cor ao iniciar
      wasWarp = warpOn
      warpLevel += ((warpOn ? 1 : 0) - warpLevel) * 0.06
      ctx.clearRect(0, 0, W, H)

      const warping = warpLevel > 0.02
      const scx = W / 2, scy = H / 2
      const maxDim = Math.hypot(W, H) * 0.62

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        if (warping) {
          // hiperespaço: a estrela vira um risco saindo do centro, acelerando
          s.wr += s.ws * warpLevel * (1 + s.wr * 0.022)
          if (s.wr > maxDim) {
            s.wr = 6 + Math.random() * 30
            s.wa = Math.random() * TAU
          }
          const dx = Math.cos(s.wa), dy = Math.sin(s.wa)
          const tail = Math.min(s.wr * 0.6, 180) * warpLevel
          const x1 = scx + dx * s.wr, y1 = scy + dy * s.wr
          const x0 = scx + dx * (s.wr - tail), y0 = scy + dy * (s.wr - tail)
          const a = Math.min(1, 0.12 + s.wr / maxDim) * warpLevel
          ctx.strokeStyle = `rgba(${warpRGB},${a})`
          ctx.lineWidth = Math.max(0.6, s.size * (0.6 + (s.wr / maxDim) * 1.4))
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()
        } else {
          const a = s.base + Math.sin(t * s.sp + s.tw) * 0.22
          ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.size, 0, TAU)
          ctx.fill()
        }
      }
      raf = requestAnimationFrame(render)
    }
    render()

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="starfield" />
}
