import type { PropId } from '../../../../content/journey'
import { Ai } from './ai/Ai'
import { Empreendedor } from './empreendedor/Empreendedor'
import { Arquiteto } from './devops/Arquiteto'
import { Fullstack } from './fullstack/Fullstack'
import { Calculadora } from './ledger/Calculadora'
import { Ledger } from './ledger/Ledger'
import { Qa } from './qa/Qa'
import { TechLead } from './techlead/TechLead'
import { Uber } from './uber/Uber'
import { Vela } from './vela/Vela'

/**
 * Adereços por vida — BLOCKOUT em primitivas, para aprovar forma, tamanho e posição antes da modelagem no Blender.
 * Coordenadas no espaço do glb do S13 (metros na escala do scan, Y para cima, rosto para +Z), medidas na malha:
 * topo da cabeça y 0,32; olhos y 0,18, z −0,02, x ±0,04; orelhas x ±0,09, y 0,17–0,19, z −0,08 a −0,18;
 * crânio a y 0,22: x ±0,09, z −0,30 a 0,01; boca y 0,10, z 0,02.
 */
export function Props({ id }: { id: PropId }) {
  switch (id) {
    case 'ai':
      return <Ai />
    case 'qa':
      return <Qa />
    case 'ledger':
      return (
        <>
          <Ledger />
          <Calculadora />
        </>
      )
    case 'fullstack':
      return <Fullstack />
    case 'rocket':
      return <Empreendedor />
    case 'techlead':
      return <TechLead />
    case 'sailor':
      return <Vela />
    case 'architect':
      return <Arquiteto />
    case 'uber':
      return <Uber />
  }
}
