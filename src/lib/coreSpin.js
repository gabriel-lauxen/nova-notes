// Multiplicador da velocidade de rotação natural do JarvisCore (eixo das
// partículas). 1 = normal. Aumenta durante o carregar/fechar do holograma.
let v = 1
export function setCoreSpin(x) {
  v = x
}
export function getCoreSpin() {
  return v
}

// colapso (0..1): puxa as partículas pro centro do core (implosão)
let c = 0
export function setCoreCollapse(x) {
  c = x
}
export function getCoreCollapse() {
  return c
}
