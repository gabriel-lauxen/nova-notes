import { useEffect, useRef } from "react";
import { getVoiceLevel } from "../lib/voiceLevel";

// Dois cubos neon (só as arestas) girando em 3D, tipo um mini "jarvis core".
// Reage à voz: escala/pulsa um pouco conforme a amplitude.
const FACES = ["front", "back", "right", "left", "top", "bottom"];

export default function CubeCore() {
  const ref = useRef(null);

  useEffect(() => {
    let raf;
    const loop = () => {
      const amp = getVoiceLevel();
      if (ref.current) {
        const s = 1 + amp * 0.95; // mexe bastante quando fala
        ref.current.style.transform = `scale(${s})`;
        ref.current.style.setProperty("--amp", amp.toFixed(3));
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className="cube-core" ref={ref}>
      <span className="cube cube-out">
        {FACES.map((f) => (
          <span key={f} className={"cf cf-" + f} />
        ))}
      </span>
      <span className="cube cube-in">
        {FACES.map((f) => (
          <span key={f} className={"cf cf-" + f} />
        ))}
      </span>
    </span>
  );
}
