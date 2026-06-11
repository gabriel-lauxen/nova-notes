import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowRight, Target, CalendarCheck, Mic, Loader2 } from "lucide-react";
import JarvisCore from "../components/JarvisCore";
import VoiceCore from "../components/VoiceCore";
import { habitsApi, notesApi } from "../lib/store";
import { useAuth } from "../context/AuthContext";
import { transcribe, generateNote } from "../lib/ai";
import { setVoiceLevel, setVoiceActive } from "../lib/voiceLevel";
import { setWarp } from "../lib/warp";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const pad = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// mesmos parâmetros da cena (JarvisCore) para os ícones orbitarem igual
const INCL = 0.35;
const GALAXY_SPEED = 0.13;

export default function Home({ onNewNote, onRefresh, pendingVoice, onVoiceConsumed }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = (
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    ""
  ).split(" ")[0];
  const overlay = useRef(null);
  const homeRef = useRef(null);
  const orbitRef = useRef(null);
  const voiceRef = useRef(null);
  const rafRef = useRef(0);
  const tRef = useRef(0);
  // flags de órbita (lidas pelo loop a cada frame)
  const habitOrbiting = useRef(true);
  const voiceOrbiting = useRef(true);

  const [clock, setClock] = useState("");
  const [habits, setHabits] = useState([]);
  const [open, setOpen] = useState(false);
  const [recState, setRecState] = useState("idle"); // idle | connecting | recording | processing
  const [voiceErr, setVoiceErr] = useState("");
  const media = useRef(null); // { stream, recorder, audioCtx, ampRaf }

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    habitsApi
      .list()
      .then(setHabits)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({ delay: 0.3 })
        .to(".home-clock", { opacity: 1, duration: 0.8 })
        .to(".home-hello", { opacity: 1, y: 0, duration: 0.8 }, "-=0.4")
        .fromTo(
          ".home-title",
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
          "-=0.3",
        )
        .to(".home-sub", { opacity: 1, duration: 0.8 }, "-=0.5")
        .to(".home-actions", { opacity: 1, y: 0, duration: 0.7 }, "-=0.4");
    }, overlay);
    return () => ctx.revert();
  }, []);

  // posição na órbita (mesma matemática da galáxia). phase desloca o ângulo.
  const computePos = (phase = 0) => {
    const home = homeRef.current;
    if (!home) return { x: 0, y: 0, scale: 1 };
    const W = home.clientWidth;
    const H = home.clientHeight;
    const maxR = Math.min(W, H) * 0.5;
    const rr = maxR * 0.82;
    const focal = maxR * 2.4;
    const cx = W / 2;
    const cy = H / 2 - 20 - (W <= 760 ? H * 0.06 : 0);
    const spin =
      (GALAXY_SPEED * tRef.current) / Math.max(0.4, rr / (maxR * 0.5)) + phase;
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const rx = rr * cs;
    const rz = -rr * sn;
    const y2 = -rz * Math.sin(INCL);
    const z2 = rz * Math.cos(INCL);
    const scale = focal / (focal + z2);
    return {
      x: cx + rx * scale - 24,
      y: cy + y2 * scale - 24,
      scale: 0.27 + scale * 0.63,
    };
  };

  // loop único: avança o tempo e posiciona cada ícone que estiver em órbita
  useEffect(() => {
    const loop = () => {
      if (homeRef.current) {
        tRef.current += 0.016;
        if (habitOrbiting.current && orbitRef.current) {
          const p = computePos(0);
          gsap.set(orbitRef.current, { x: p.x, y: p.y, scale: p.scale, opacity: 1 });
        }
        if (voiceOrbiting.current && voiceRef.current) {
          const p = computePos(Math.PI); // lado oposto da órbita
          gsap.set(voiceRef.current, { x: p.x, y: p.y, scale: p.scale, opacity: 1 });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- menu de hábitos (ícone que voa pro topo) ---------------- */
  const openMenu = () => {
    habitOrbiting.current = false;
    const el = orbitRef.current;
    setOpen(true);
    requestAnimationFrame(() => {
      const parent = el.offsetParent || homeRef.current;
      const pr = parent.getBoundingClientRect();
      const menuW = el.offsetWidth || 196;
      const burger = document.querySelector(".burger");
      const topY =
        burger && burger.getClientRects().length
          ? burger.getBoundingClientRect().top
          : 16;
      const tx = window.innerWidth - menuW - 16 - pr.left;
      const ty = topY - pr.top;
      gsap.to(el, { x: tx, y: ty, scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" });
    });
  };

  const closeMenu = () => {
    const el = orbitRef.current;
    gsap.to(el, {
      scale: 0.5,
      opacity: 0.5,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => {
        setOpen(false);
        requestAnimationFrame(() => {
          const p = computePos(0);
          gsap.to(el, {
            x: p.x, y: p.y, scale: p.scale, opacity: 1,
            duration: 0.45, ease: "power3.out",
            onComplete: () => { habitOrbiting.current = true; },
          });
        });
      },
    });
  };

  const done = (h) => !!(h.log || {})[todayKey()];
  const toggleToday = (h) => {
    const k = todayKey();
    const log = { ...(h.log || {}) };
    if (log[k]) delete log[k];
    else log[k] = true;
    setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, log } : x)));
    habitsApi.update(h.id, { log });
  };

  /* ---------------- gravação de voz (ícone que voa pro canto) ----------------
     O voo usa TRANSIÇÃO CSS (transform), que roda na thread de composição.
     Assim, mesmo quando o getUserMedia congela a thread principal ao conectar
     o microfone, o ícone continua deslizando até o canto e o loader segue girando. */
  const setFlyTransition = (on) => {
    const el = voiceRef.current;
    if (el) el.style.transition = on ? "transform 0.55s cubic-bezier(0.22,1,0.36,1)" : "none";
  };
  const flyVoiceToCorner = () => {
    const el = voiceRef.current;
    if (!el) return;
    const parent = el.offsetParent || homeRef.current;
    const pr = parent.getBoundingClientRect();
    const w = el.offsetWidth || 50;
    const h = el.offsetHeight || 50;
    const isMobile = window.innerWidth <= 760;
    // o núcleo (VoiceCore) transborda o botão; calculo a margem a partir do
    // tamanho do core pra o espaço VISUAL ficar certo nos dois lados.
    const coreSize = isMobile ? 104 : 200;
    const overflow = Math.max(0, (coreSize - h) / 2);
    const visual = isMobile ? 24 : 34; // folga visual
    const mx = overflow + visual;
    const my = overflow + (isMobile ? 40 : visual); // mobile: folga extra pra bottom bar
    const tx = window.innerWidth - mx - w - pr.left;
    const ty = window.innerHeight - my - h - pr.top;
    setFlyTransition(true);
    void el.offsetWidth; // garante que o estado atual foi registrado antes da transição
    el.style.transform = `translate(${tx}px, ${ty}px) scale(1)`;
    el.style.opacity = "1";
  };
  const flyVoiceBack = () => {
    const el = voiceRef.current;
    if (!el) return;
    const p = computePos(Math.PI);
    setFlyTransition(true);
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
    setTimeout(() => {
      setFlyTransition(false); // devolve o controle pro loop de órbita
      voiceOrbiting.current = true;
    }, 580);
  };

  const finishRecording = async (chunks, type) => {
    setRecState("processing");
    try {
      const blob = new Blob(chunks, { type: type || "audio/webm" });
      const text = await transcribe(blob);
      if (!text) throw new Error("Não entendi o áudio. Tente falar de novo.");
      const { content, title, emoji } = await generateNote(text, true);
      const note = await notesApi.create({
        content: content || text,
        title: title || "Nota de voz",
        emoji: emoji || "🎙️",
      });
      onRefresh?.();
      media.current = null;
      // deixa o zoom rápido do core tocar antes de entrar na nota
      await new Promise((r) => setTimeout(r, 620));
      navigate(`/note/${note.id}`);
    } catch (e) {
      setVoiceErr(e.message || "Falha ao processar o áudio.");
      setRecState("idle");
      media.current = null;
      flyVoiceBack();
    }
  };

  const startRecording = async () => {
    setVoiceErr("");
    voiceOrbiting.current = false;
    setRecState("connecting"); // loader (CSS) gira enquanto conecta
    // dispara o voo pro canto via CSS e espera 2 frames pra a transição
    // ser commitada na composição ANTES da chamada que congela a thread.
    flyVoiceToCorner();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceErr("Não consegui acessar o microfone.");
      setRecState("idle");
      flyVoiceBack();
      return;
    }
    const mime = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => finishRecording(chunks, recorder.mimeType || mime);

    // analisador para alimentar a vibração das partículas
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    setVoiceActive(true);
    const SPEAK = 0.04; // limiar de fala
    const SILENCE_MS = 2000; // para sozinho após esse silêncio (depois de falar)
    const MAX_MS = 60000; // trava de segurança
    const tickAmp = () => {
      const m = media.current;
      if (!m) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      setVoiceLevel(Math.min(1, rms * 6)); // mais sensível

      const now = performance.now();
      if (rms > SPEAK) {
        m.lastSound = now;
        m.spoke = true;
      }
      // para automaticamente: já falou e ficou em silêncio, ou estourou o tempo
      if ((m.spoke && now - m.lastSound > SILENCE_MS) || now - m.started > MAX_MS) {
        stopRecording();
        return;
      }
      m.ampRaf = requestAnimationFrame(tickAmp);
    };

    media.current = {
      stream, recorder, audioCtx, ampRaf: 0,
      started: performance.now(),
      lastSound: performance.now(),
      spoke: false,
    };
    tickAmp();
    recorder.start();
    setRecState("recording");
  };

  const stopRecording = () => {
    const m = media.current;
    if (!m) return;
    setVoiceActive(false);
    cancelAnimationFrame(m.ampRaf);
    try { m.recorder.state !== "inactive" && m.recorder.stop(); } catch {}
    m.stream.getTracks().forEach((t) => t.stop());
    try { m.audioCtx.close(); } catch {}
  };

  const onVoiceClick = () => {
    if (recState === "idle") startRecording();
    else if (recState === "recording") stopRecording();
    // connecting / processing: ignora cliques
  };

  // atalho global (Cmd/Ctrl+J): App navega pra Home e sinaliza pra gravar
  useEffect(() => {
    if (pendingVoice) {
      onVoiceConsumed?.();
      if (recState === "idle") startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoice]);

  // modo hiperespaço nas estrelas de fundo durante o processamento
  useEffect(() => {
    setWarp(recState === "processing");
    return () => setWarp(false);
  }, [recState]);

  // limpeza ao desmontar
  useEffect(() => {
    return () => {
      const m = media.current;
      if (m) {
        setVoiceActive(false);
        cancelAnimationFrame(m.ampRaf);
        try { m.recorder.state !== "inactive" && m.recorder.stop(); } catch {}
        m.stream?.getTracks().forEach((t) => t.stop());
        try { m.audioCtx?.close(); } catch {}
      }
    };
  }, []);

  return (
    <div
      className={
        "home" +
        (recState !== "idle" ? " voice-active" : "") +
        (recState === "processing" ? " home-zoom" : "")
      }
      ref={homeRef}
    >
      <JarvisCore />
      <div className="home-clock">{clock}</div>

      {open && <div className="orbit-backdrop" onClick={closeMenu} />}

      {/* ícone de hábitos do dia */}
      <div className={"habit-orbit" + (open ? " open" : "")} ref={orbitRef}>
        {!open ? (
          <button className="orbit-icon" onClick={openMenu} title="Hábitos de hoje">
            <CalendarCheck size={20} />
          </button>
        ) : (
          <div className="orbit-menu">
            <button className="orbit-menu-head" onClick={closeMenu}>
              <CalendarCheck size={15} /> Hoje
            </button>
            <div className="orbit-habits">
              {habits.length ? (
                habits.map((h) => (
                  <label className="orbit-habit" key={h.id}>
                    <span>{h.name}</span>
                    <input
                      type="checkbox"
                      checked={done(h)}
                      onChange={() => toggleToday(h)}
                    />
                  </label>
                ))
              ) : (
                <div className="orbit-empty">Nenhum hábito ainda.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ícone de voz: grava e gera uma nota */}
      <div className="voice-orbit" ref={voiceRef}>
        <button
          className={"voice-btn " + recState}
          onClick={onVoiceClick}
          disabled={recState === "processing" || recState === "connecting"}
          title={
            recState === "recording"
              ? "Parar e gerar nota"
              : recState === "connecting"
                ? "Conectando o microfone…"
                : recState === "processing"
                  ? "Processando…"
                  : "Falar para criar uma nota"
          }
        >
          {recState === "recording" ? (
            <VoiceCore />
          ) : recState === "connecting" || recState === "processing" ? (
            <Loader2 size={20} className="voice-spin" />
          ) : (
            <Mic size={20} />
          )}
        </button>
      </div>

      {voiceErr && <div className="voice-err">{voiceErr}</div>}

      <div className="home-overlay" ref={overlay}>
        <div className="home-hello">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </div>
        <h1 className="home-title">NOVA</h1>
        <p className="home-sub">
          Seu segundo cérebro. Capture ideias, organize notas e acompanhe seus
          objetivos.
        </p>
        <div className="home-actions">
          <button className="btn-neon clear" onClick={() => navigate("/goals")}>
            <Target size={16} style={{ verticalAlign: "middle" }} /> Meus
            objetivos
          </button>
          <button className="btn-neon outline" onClick={onNewNote}>
            Nova nota <ArrowRight size={16} style={{ verticalAlign: "middle" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
