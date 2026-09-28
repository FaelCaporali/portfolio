/**
 * O ROBÔ da mesa (FICHA §1 e §4.2): o agente do produto, glb do estúdio (`3d/export/props/ai.glb`, raiz `ai` →
 * `ai_robo`). Preso à mesa (../ancora.ts, como a prancheta do Solutions Architect), em volta da origem de `ai_robo`
 * (centro da base no plano da mesa), com escala e deslocamento por tela (GRUPO_ROBO). Na cena 2 ele se MONTA peça a
 * peça: cada peça parte do `explodido_m` dela (extras do glb) na `ordem_montagem`. Os servos: `ai_pescoco` gira (Y) e
 * `ai_cabeca` inclina (X), nos ângulos dos extras (`olhar_camera_graus`, `olhar_fael_graus`) ou virados para a cena
 * ativa, dentro das faixas (±60° de giro, −15°/+30° de inclinação). A tela troca o material pelo canvas do rosto.
 * Nada alocado por quadro.
 */
import * as THREE from 'three'
import type { Formato } from '../devops/composicao'
import type { Grupo } from '../ancora'

/**
 * Ajuste do grupo da mesa por tela (medido com volta_prop.mjs ai, LOG da v1, seção TD): o topo da cabeça do robô abaixo
 * do lábio inferior do Fael, os pés ≥ 16 px da borda de baixo, longe do "Contact me" e da coluna do chat.
 */
export const GRUPO_ROBO: Record<Formato, Grupo> = {
  largo: { escala: 0.62, desloc: [-0.045, 0.05, 0] },
  medio: { escala: 0.7, desloc: [-0.06, 0.03, 0] },
  estreito: { escala: 0.5, desloc: [-0.03, 0.09, 0] },
}

const GIRO: readonly [number, number] = [-60, 60]
const INCL: readonly [number, number] = [-15, 30]
const RAD = Math.PI / 180
/**
 * Distância máxima (m) de onde cada peça parte: a direção é a do `explodido_m`, mas a 0,45–0,65 m ela nasceria fora
 * da tela e cruzaria a borda, a UI (no retrato, o indicador de vidas) e o chat; a peça aparece na vez dela, perto.
 */
const EXPLODIDO_MAX = 0.1

interface Peca {
  o: THREE.Object3D
  p0: THREE.Vector3
  d: THREE.Vector3
  ordem: number
}

const num2 = (v: unknown, d: readonly [number, number]): [number, number] =>
  Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' ? [v[0], v[1]] : [d[0], d[1]]

/** Prepara o robô dentro da raiz `root` (a cópia da cena do glb). */
export function prepararRobo(root: THREE.Object3D) {
  const robo = root.getObjectByName('ai_robo') ?? null
  const pescoco = root.getObjectByName('ai_pescoco') ?? null
  const cabeca = root.getObjectByName('ai_cabeca') ?? null
  const pecas: Peca[] = []
  root.traverse((o) => {
    const e = o.userData.explodido_m as unknown
    if (!Array.isArray(e) || e.length !== 3) return
    const [x, y, z] = e.map(Number)
    const d = new THREE.Vector3(x, y, z)
    pecas.push({
      o,
      p0: o.position.clone(),
      d: d.setLength(Math.min(d.length(), EXPLODIDO_MAX)),
      ordem: Number(o.userData.ordem_montagem) || 1,
    })
  })
  const n = Math.max(1, ...pecas.map((p) => p.ordem))
  const camera = num2(pescoco?.userData.olhar_camera_graus, [57, -7])
  const fael = num2(pescoco?.userData.olhar_fael_graus, [-57, 22])
  // Caixa do robô montado (espaço da raiz) e os cantos da sola: as zonas e o fio são medidos com ela.
  root.updateMatrixWorld(true)
  const caixa = new THREE.Box3()
  if (robo) caixa.setFromObject(robo, true)
  const cantos = new Float32Array(24)
  for (let i = 0; i < 8; i++) {
    cantos[i * 3] = i & 1 ? caixa.max.x : caixa.min.x
    cantos[i * 3 + 1] = i & 2 ? caixa.max.y : caixa.min.y
    cantos[i * 3 + 2] = i & 4 ? caixa.max.z : caixa.min.z
  }
  const base = new Float32Array([caixa.min.x, caixa.min.y, caixa.min.z, caixa.max.x, caixa.min.y, caixa.max.z])
  // O eixo do pescoço em repouso (espaço da raiz), para mirar a cena ativa.
  const eixo = new THREE.Vector3()
  pescoco?.getWorldPosition(eixo)
  // Calibração dos servos: a direção da câmera do site dá o giro e a inclinação do extra `olhar_camera_graus`.
  const cam = new THREE.Vector3(0, 0.2, 1.05)
  const dir = new THREE.Vector3()
  const angulos = (alvo: THREE.Vector3, origem: THREE.Vector3): [number, number] => {
    dir.subVectors(alvo, origem)
    return [Math.atan2(dir.x, dir.z) / RAD, Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) / RAD]
  }
  const [yc, ec] = angulos(cam, eixo)
  const y0 = yc - camera[0]
  const e0 = ec - camera[1]
  const qGiro = new THREE.Quaternion()
  const qIncl = new THREE.Quaternion()
  const eY = new THREE.Vector3(0, 1, 0)
  const eX = new THREE.Vector3(1, 0, 0)
  const atual: [number, number] = [camera[0], camera[1]]
  const origem = new THREE.Vector3()

  /** Montagem 0 (explodido) → 1 (montado): cada peça entra na sua vez, com freio no fim. */
  const montar = (k: number) => {
    for (const p of pecas) {
      const ini = ((p.ordem - 1) / n) * 0.72
      const u = Math.min(1, Math.max(0, (k - ini) / 0.32))
      const falta = (1 - u) ** 3
      p.o.visible = u > 0
      p.o.position.copy(p.p0).addScaledVector(p.d, falta)
    }
  }
  /** Ângulos [giro, inclinação] para olhar o ponto `alvo` (espaço da raiz, com a mesa `g` aplicada ao eixo). */
  const mirar = (alvo: THREE.Vector3, g: Grupo, pivo: THREE.Vector3, out: [number, number]) => {
    origem.copy(eixo).sub(pivo).multiplyScalar(g.escala).add(pivo)
    origem.x += g.desloc[0]
    origem.y += g.desloc[1]
    origem.z += g.desloc[2]
    const [y, e] = angulos(alvo, origem)
    out[0] = Math.min(GIRO[1], Math.max(GIRO[0], y - y0))
    out[1] = Math.min(INCL[1], Math.max(INCL[0], e - e0))
    return out
  }
  /** Servos para [giro, inclinação] (graus), amortecidos por `k` (0–1 por quadro; 1 = na hora). */
  const servos = (alvo: readonly [number, number], k: number) => {
    atual[0] += (alvo[0] - atual[0]) * k
    atual[1] += (alvo[1] - atual[1]) * k
    pescoco?.quaternion.copy(qGiro.setFromAxisAngle(eY, atual[0] * RAD))
    cabeca?.quaternion.copy(qIncl.setFromAxisAngle(eX, -atual[1] * RAD))
  }
  return { robo, cantos, base, camera, fael, montar, mirar, servos }
}
