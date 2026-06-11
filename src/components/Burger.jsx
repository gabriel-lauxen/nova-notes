import { Menu } from "lucide-react";

// Burger dentro do container que rola (sticky, altura 0): repica junto com o
// conteúdo no overscroll, igual ao header. Pede pra abrir o drawer via evento.
export default function Burger() {
  return (
    <div className="burger-host">
      <button
        className="burger"
        aria-label="Abrir menu"
        onClick={() => window.dispatchEvent(new CustomEvent("nova:open-nav"))}
      >
        <Menu size={26} />
      </button>
    </div>
  );
}
