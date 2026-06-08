import { useEffect, useRef } from 'react'

// Fundo de estrelas (cintilando) para todas as páginas. Fica atrás do
// conteúdo; cards e painéis semitransparentes deixam ele aparecer.
export default function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, raf, t = 0
    let stars = []
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const build = () => {
      const n = Math.min(260, Math.round((W * H) / 6500))
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() < 0.12 ? 1.4 + Math.random() * 1.1 : 0.4 + Math.random() * 0.9,
        tw: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 1.4,
        base: 0.2 + Math.random() * 0.4,
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
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        const a = s.base + Math.sin(t * s.sp + s.tw) * 0.22
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(render)
    }
    render()

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="starfield" />
}
