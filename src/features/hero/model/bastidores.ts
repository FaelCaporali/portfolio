/**
 * Quem se prepara nos bastidores (#138, D-138d: "preparar 2 em primeiro acesso e depois preparar o próximo apenas"):
 * a vida atual e UMA próxima, a que o carrossel vai mostrar. Os downloads não mudam (a fila de carga segue baixando
 * todas); só a montagem escondida e o preparo (fundo, shaders, texturas) ficam restritos a essas duas. Sem React.
 */

/**
 * A próxima vida a preparar, entre as candidatas da troca em ordem (a escolhida no indicador, só ela, ou as seguintes
 * da volta, sem a atual e sem as que falharam): a já reservada, se continua candidata e baixada (uma vida que chega
 * depois não desfaz um preparo em curso); senão a 1ª já baixada — a que falhou ou ainda baixa é pulada, como no
 * relógio, que troca para a 1ª candidata pronta. undefined: nenhuma a preparar agora (a atual fica até uma chegar).
 */
export function proximaNosBastidores<T>(
  candidatas: readonly T[],
  baixadas: ReadonlySet<T>,
  reservada: T | null,
): T | undefined {
  if (reservada !== null && baixadas.has(reservada) && candidatas.includes(reservada)) return reservada
  return candidatas.find((c) => baixadas.has(c))
}
