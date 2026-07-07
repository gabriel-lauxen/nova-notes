// Símbolo cata-vento (inline) — usa currentColor, então segue a cor primária
// do tema onde for aplicado (sidebar, loader, login…).
export default function PinwheelIcon({ className, size = 28, style }) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="7.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <g transform="translate(50 50) scale(1.5) translate(-50 -50)">
        <path d="M50 47 C55 39 65 38 72 42" />
        <g transform="rotate(60 50 50)"><path d="M50 47 C55 39 65 38 72 42" /></g>
        <g transform="rotate(120 50 50)"><path d="M50 47 C55 39 65 38 72 42" /></g>
        <g transform="rotate(180 50 50)"><path d="M50 47 C55 39 65 38 72 42" /></g>
        <g transform="rotate(240 50 50)"><path d="M50 47 C55 39 65 38 72 42" /></g>
        <g transform="rotate(300 50 50)"><path d="M50 47 C55 39 65 38 72 42" /></g>
      </g>
    </svg>
  )
}
