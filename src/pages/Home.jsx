import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowRight, Target, CalendarCheck } from "lucide-react";
import JarvisCore from "../components/JarvisCore";
import { habitsApi } from "../lib/store";
import { useAuth } from "../context/AuthContext";

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

// mesmos parâmetros da cena (JarvisCore) para o ícone orbitar igual
const INCL = 0.35;
const GALAXY_SPEED = 0.13;

export default function Home({ onNewNote }) {
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
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const [clock, setClock] = useState("");
  const [habits, setHabits] = useState([]);
  const [open, setOpen] = useState(false);

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

  // posição na órbita (mesma matemática da galáxia)
  const computePos = () => {
    const home = homeRef.current;
    if (!home) return { x: 0, y: 0, scale: 1 };
    const W = home.clientWidth;
    const H = home.clientHeight;
    const maxR = Math.min(W, H) * 0.5;
    const rr = maxR * 0.82;
    const focal = maxR * 2.4;
    const cx = W / 2;
    // no mobile sobe um pouco o centro (acompanha o texto deslocado pra cima)
    const cy = H / 2 - 20 - (W <= 760 ? H * 0.06 : 0);
    const spin =
      (GALAXY_SPEED * tRef.current) / Math.max(0.4, rr / (maxR * 0.5));
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
      // mais profundidade: encolhe bem na parte de trás, cresce na frente
      scale: 0.27 + scale * 0.63,
    };
  };

  const startOrbit = () => {
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      if (orbitRef.current && homeRef.current) {
        const p = computePos();
        gsap.set(orbitRef.current, {
          x: p.x,
          y: p.y,
          scale: p.scale,
          opacity: 1,
        });
        tRef.current += 0.016;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };
  const stopOrbit = () => cancelAnimationFrame(rafRef.current);

  useEffect(() => {
    startOrbit();
    return stopOrbit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openMenu = () => {
    stopOrbit();
    setOpen(true);
    const el = orbitRef.current;
    const W = homeRef.current.clientWidth;
    const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat")) || 0;
    gsap.to(el, {
      x: W - 216,
      y: sat + 10,
      scale: 1,
      opacity: 1,
      duration: 0.55,
      ease: "power3.out",
    });
  };

  const closeMenu = () => {
    const el = orbitRef.current;
    // encolhe (menu vira ícone) e volta voando pra órbita
    gsap.to(el, {
      scale: 0.4,
      opacity: 0.5,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        setOpen(false);
        requestAnimationFrame(() => {
          const p = computePos();
          gsap.to(el, {
            x: p.x,
            y: p.y,
            scale: p.scale,
            opacity: 1,
            duration: 0.5,
            ease: "power3.out",
            onComplete: startOrbit,
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

  return (
    <div className="home" ref={homeRef}>
      <JarvisCore />
      <div className="home-clock">{clock}</div>

      {open && <div className="orbit-backdrop" onClick={closeMenu} />}

      <div className={"habit-orbit" + (open ? " open" : "")} ref={orbitRef}>
        {!open ? (
          <button
            className="orbit-icon"
            onClick={openMenu}
            title="Hábitos de hoje"
          >
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
