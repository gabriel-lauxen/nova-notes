import { useEffect, useRef } from "react";

// Loader "cometa": uma cabeça de partícula brilhante orbita o centro e deixa
// um rastro de partículas que desvanece. Cor primária do tema.
export default function Spinner() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const SIZE = 92;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // cor primária -> rgb
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
      "#26c8ec";
    const n = ctx.fillStyle;
    let r, g, b;
    if (n[0] === "#") {
      r = parseInt(n.slice(1, 3), 16);
      g = parseInt(n.slice(3, 5), 16);
      b = parseInt(n.slice(5, 7), 16);
    } else {
      const m = n.match(/\d+/g) || [38, 200, 236];
      [r, g, b] = m.map(Number);
    }
    const RGB = `${r},${g},${b}`;

    const cx = SIZE / 2,
      cy = SIZE / 2,
      R = 28;
    let parts = [];
    let a = 0,
      raf;

    const loop = () => {
      a += 0.085;
      const hx = cx + Math.cos(a) * R;
      const hy = cy + Math.sin(a) * R;
      // emite partículas do rastro na posição da cabeça
      for (let i = 0; i < 2; i++) {
        parts.push({
          x: hx + (Math.random() - 0.5) * 3,
          y: hy + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          life: 1,
          size: 1.4 + Math.random() * 2.2,
        });
      }

      ctx.clearRect(0, 0, SIZE, SIZE);

      // rastro (de trás pra frente, desvanecendo)
      for (const p of parts) {
        p.life -= 0.028;
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = `rgba(${RGB},${Math.max(0, p.life * 0.75)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.3, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
      }
      parts = parts.filter((p) => p.life > 0);

      // cabeça do cometa (brilhante, com glow)
      ctx.shadowColor = `rgba(${RGB},0.9)`;
      ctx.shadowBlur = 9;
      ctx.fillStyle = `rgba(${RGB},1)`;
      ctx.beginPath();
      ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
      ctx.fill();
      // núcleo branco
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="page-loader">
      <canvas ref={ref} className="pl-canvas" />
    </div>
  );
}
