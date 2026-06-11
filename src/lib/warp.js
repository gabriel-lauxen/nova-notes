// Dispara um giro rápido único nas estrelas de fundo (ao entrar na nota criada).
// O Starfield observa o timestamp e toca a animação uma vez.
let spinAt = 0
export function triggerStarSpin() {
  spinAt = performance.now()
}
export function getStarSpin() {
  return spinAt
}
