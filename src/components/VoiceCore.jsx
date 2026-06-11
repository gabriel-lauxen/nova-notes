import { useEffect, useRef } from "react";
import { getVoiceLevel } from "../lib/voiceLevel";

// Duas formas 3D (cubos wireframe) girando em eixos diferentes, uma dentro da
// outra. Só as arestas, em neon. Reage à voz (escala).
const FACES = ["fr", "bk", "rt", "lf", "tp", "bt"];

export default function VoiceCore() {
  const ref = useRef(null);

  useEffect(() => {
    let raf;
    const loop = () => {
      const amp = getVoiceLevel();
      if (ref.current) ref.current.style.transform = `scale(${1 + amp * 0.5})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className="voice-core" ref={ref}>
      <span className="vc3-scene">
        <span className="vc3 vc3-a">
          {FACES.map((f) => (
            <i key={f} className={"vf vf-" + f} />
          ))}
        </span>
        <span className="vc3 vc3-b">
          {FACES.map((f) => (
            <i key={f} className={"vf vf-" + f} />
          ))}
        </span>
      </span>
    </span>
  );
}
