// Sinaliza o modo "hiperespaço" (estrelas viram riscos saindo do centro),
// compartilhado entre a Home (durante o processamento) e o JarvisCore.
let active = false
export function setWarp(v) {
  active = !!v
}
export function getWarp() {
  return active
}
