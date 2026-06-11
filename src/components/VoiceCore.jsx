import { useEffect, useRef } from "react";
import { getVoiceLevel } from "../lib/voiceLevel";

// Núcleo de energia "alienígena": camadas de espinhos neon radiais contra-girando,
// uma estrela central e brilho. Reage à voz (os espinhos se esticam/pulsam).
const C = 50;

// gera triângulos finos (espinhos) apontando pra fora a partir do centro
function spikes(count, r0, len, w, phase = 0) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx; // perpendicular (base do espinho)
    const bx = C + dx * r0, by = C + dy * r0;
    const tx = C + dx * (r0 + len), ty = C + dy * (r0 + len);
    arr.push(
      `${(bx + px * w).toFixed(1)},${(by + py * w).toFixed(1)} ` +
      `${tx.toFixed(1)},${ty.toFixed(1)} ` +
      `${(bx - px * w).toFixed(1)},${(by - py * w).toFixed(1)}`,
    );
  }
  return arr;
}

// estrela (hexagrama) central: dois triângulos sobrepostos
function triangle(r, rot) {
  const pts = [];
  for (let k = 0; k < 3; k++) {
    const a = rot + (k / 3) * Math.PI * 2;
    pts.push(`${(C + Math.cos(a) * r).toFixed(1)},${(C + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(" ");
}

const OUTER = spikes(9, 13, 30, 3.4);
const MIDDLE = spikes(9, 9, 18, 4.6, Math.PI / 9);

export default function VoiceCore() {
  const aRef = useRef(null);
  const bRef = useRef(null);
  const coreRef = useRef(null);

  useEffect(() => {
    let raf;
    const loop = () => {
      const amp = getVoiceLevel();
      // os espinhos de fora esticam um pouco, os de dentro pulsam mais (núcleo vivo)
      if (aRef.current) aRef.current.style.transform = `scale(${1 + amp * 0.55})`;
      if (bRef.current) bRef.current.style.transform = `scale(${1 + amp * 1.0})`;
      if (coreRef.current) coreRef.current.style.transform = `scale(${1 + amp * 1.3})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className="voice-core">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* espinhos externos */}
        <g className="vc-spin-a">
          <g ref={aRef} className="vc-scale">
            {OUTER.map((p, i) => (
              <polygon key={i} className="vc-spike" points={p} />
            ))}
          </g>
        </g>
        {/* espinhos internos (sentido oposto) */}
        <g className="vc-spin-b">
          <g ref={bRef} className="vc-scale">
            {MIDDLE.map((p, i) => (
              <polygon key={i} className="vc-spike vc-spike-in" points={p} />
            ))}
          </g>
        </g>
        {/* estrela central (hexagrama) girando */}
        <g className="vc-spin-c">
          <g ref={coreRef} className="vc-scale">
            <polygon className="vc-star" points={triangle(11, -Math.PI / 2)} />
            <polygon className="vc-star" points={triangle(11, Math.PI / 2)} />
            <circle className="vc-core-dot" cx={C} cy={C} r="3.4" />
          </g>
        </g>
      </svg>
    </span>
  );
}
