/**
 * Anel de alerta (vida qa, E5: alertas proativos de erro de API e de UI): acende no ponto de captura ANTES do bug
 * chegar e pulsa; apaga quando o bug trava na lente. Vermelho do acento da vida (#e0324b), fino, sem brilho de neon
 * (cor exata, sem luz nem tom): um anel fixo e uma onda que se abre e some. Duas malhas, a mesma geometria.
 */
import * as THREE from 'three'
import { withDissolve } from '../../dissolve'

/** Raio interno e largura (m no glb, antes da escala da lupa): logo fora do aro da lente (raio 0,0414 no glb). */
const RAIO = 0.044
const LARGURA = 0.0022
const COR = '#e0324b'
/** Alfa do anel fixo e da onda; a onda abre até 1 + ABRE do raio. */
const ALFA = { anel: 0.9, onda: 0.55 }
const ABRE = 0.12
/** Um pouco à frente da lente, para a câmera. */
const FRENTE = 0.004

export function criarAlerta() {
  const geo = new THREE.RingGeometry(RAIO, RAIO + LARGURA, 72, 1)
  const mat = () =>
    withDissolve(
      new THREE.MeshBasicMaterial({
        color: COR,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    )
  const mAnel = mat()
  const mOnda = mat()
  mAnel.name = 'qa_anel'
  mOnda.name = 'qa_anel'
  const anel = new THREE.Mesh(geo, mAnel)
  const onda = new THREE.Mesh(geo, mOnda)
  anel.name = 'qa_anel_fixo'
  onda.name = 'qa_anel_onda'
  const grupo = new THREE.Group()
  grupo.name = 'qa_anel'
  grupo.add(anel, onda)
  grupo.renderOrder = 3
  anel.renderOrder = 3
  onda.renderOrder = 3

  /** Intensidade 0–1, fase do pulso 0–1, centro (o ponto de captura) e escala (a da lupa). */
  const atualizar = (intensidade: number, fase: number, centro: THREE.Vector3, escala: number) => {
    grupo.visible = intensidade > 0.001
    if (!grupo.visible) return
    grupo.position.set(centro.x, centro.y, centro.z + FRENTE)
    grupo.scale.setScalar(escala)
    mAnel.opacity = ALFA.anel * intensidade * (0.8 + 0.2 * fase)
    onda.scale.setScalar(1 + ABRE * fase)
    mOnda.opacity = ALFA.onda * intensidade * (1 - fase)
  }
  const dispose = () => {
    geo.dispose()
    mAnel.dispose()
    mOnda.dispose()
  }
  return { grupo, atualizar, dispose }
}
