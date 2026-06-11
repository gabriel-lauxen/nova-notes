// Nível de áudio compartilhado (0..1) entre a gravação na Home e o JarvisCore.
// Mantido fora do React para não causar re-render a cada frame.

let level = 0 // valor suavizado, lido pelo canvas
let active = false // se há gravação em andamento

export function setVoiceLevel(v) {
  // suaviza pra um movimento mais orgânico (menor fator = mais suave)
  const t = Math.max(0, Math.min(1, v))
  level += (t - level) * 0.18
}
export function getVoiceLevel() {
  return active ? level : (level *= 0.9) // decai suave ao parar
}
export function setVoiceActive(on) {
  active = on
  if (!on) level *= 0.5
}
export function isVoiceActive() {
  return active
}
