// Gera uma paleta completa de UI a partir de UMA cor base.
// A ideia: você escolhe a cor, e o app deriva variações mais claras/escuras
// para fundo, superfícies, bordas, texto e destaques — tudo harmônico.

export function hexToHsl(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let hue = 0
  let sat = 0
  const lig = (max + min) / 2
  if (max !== min) {
    const d = max - min
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break
      case g: hue = (b - r) / d + 2; break
      default: hue = (r - g) / d + 4
    }
    hue /= 6
  }
  return { h: hue * 360, s: sat * 100, l: lig * 100 }
}

const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v))

export function hsl(h, s, l, a = 1) {
  const str = `${h.toFixed(1)} ${clamp(s).toFixed(1)}% ${clamp(l).toFixed(1)}%`
  return a === 1 ? `hsl(${str})` : `hsl(${str} / ${a})`
}

// Constrói o conjunto de variáveis CSS. mode: 'dark' | 'light'
export function buildPalette(baseHex, mode = 'dark') {
  const { h, s } = hexToHsl(baseHex)
  // saturação base com piso/teto pra cor nunca ficar "lavada" nem estourada
  const S = clamp(s, 45, 95)

  if (mode === 'dark') {
    return {
      '--accent': hsl(h, S, 62),
      '--accent-strong': hsl(h, S, 70),
      '--accent-soft': hsl(h, S, 55, 0.16),
      '--accent-dim': hsl(h, S, 60, 0.35),
      '--accent-glow': hsl(h, S, 65, 0.45),
      '--accent-contrast': hsl(h, 12, 8),

      // fundos com um leve tom da cor escolhida (não cinza puro)
      '--bg': hsl(h, clamp(S * 0.4, 12, 30), 6),
      '--bg-elev': hsl(h, clamp(S * 0.35, 10, 26), 9),
      '--surface': hsl(h, clamp(S * 0.32, 10, 24), 12),
      '--surface-hover': hsl(h, clamp(S * 0.32, 10, 24), 16),
      '--border': hsl(h, clamp(S * 0.3, 8, 22), 22, 0.7),
      '--border-strong': hsl(h, S, 60, 0.4),

      '--text': hsl(h, 14, 95),
      '--text-dim': hsl(h, 12, 70),
      '--text-faint': hsl(h, 10, 50),

      '--hue': `${h}`,
      '--sat': `${S}%`,
    }
  }

  // modo claro
  return {
    '--accent': hsl(h, S, 48),
    '--accent-strong': hsl(h, S, 40),
    '--accent-soft': hsl(h, S, 55, 0.14),
    '--accent-dim': hsl(h, S, 50, 0.3),
    '--accent-glow': hsl(h, S, 55, 0.25),
    '--accent-contrast': hsl(h, 20, 99),

    '--bg': hsl(h, clamp(S * 0.4, 12, 40), 97),
    '--bg-elev': hsl(h, clamp(S * 0.35, 10, 34), 99),
    '--surface': hsl(h, clamp(S * 0.3, 8, 28), 100),
    '--surface-hover': hsl(h, clamp(S * 0.3, 8, 28), 96),
    '--border': hsl(h, clamp(S * 0.3, 8, 24), 80, 0.8),
    '--border-strong': hsl(h, S, 50, 0.4),

    '--text': hsl(h, 25, 12),
    '--text-dim': hsl(h, 15, 35),
    '--text-faint': hsl(h, 12, 55),

    '--hue': `${h}`,
    '--sat': `${S}%`,
  }
}

export function applyPalette(palette) {
  const root = document.documentElement
  Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v))
}

// Retorna a cor de destaque pura (hex aproximado) para usar no Three.js
export function accentForThree(baseHex, mode = 'dark') {
  const { h, s } = hexToHsl(baseHex)
  const S = clamp(s, 45, 95)
  return { h: h / 360, s: S / 100, l: mode === 'dark' ? 0.62 : 0.5 }
}

export const FONTS = [
  { id: 'space', label: 'Space Grotesk', stack: "'Space Grotesk', system-ui, sans-serif" },
  { id: 'inter', label: 'Inter', stack: "'Inter', system-ui, sans-serif" },
  { id: 'sora', label: 'Sora', stack: "'Sora', system-ui, sans-serif" },
]

export const PRESET_COLORS = [
  { label: 'Violeta matrix', value: '#a855f7' },
  { label: 'Ciano Jarvis', value: '#22d3ee' },
  { label: 'Verde matrix', value: '#22c55e' },
  { label: 'Magenta', value: '#ec4899' },
  { label: 'Âmbar', value: '#f59e0b' },
  { label: 'Azul real', value: '#3b82f6' },
]
