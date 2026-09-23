import type { PropId } from '../../../../content/journey'
import { Compass, Magnifier, Rocket, Sailboat, Wheel } from './floating'
import { Brim, Dome, Headphones, Sunglasses, Tears } from './head'
import { Coins, Neural } from './orbits'

/**
 * Adereços por vida — BLOCKOUT em primitivas, para aprovar forma, tamanho e posição antes da modelagem no Blender.
 * Coordenadas no espaço do glb do S13 (metros na escala do scan, Y para cima, rosto para +Z), medidas na malha:
 * topo da cabeça y 0,32; olhos y 0,18, z −0,02, x ±0,04; orelhas x ±0,09, y 0,17–0,19, z −0,08 a −0,18;
 * crânio a y 0,22: x ±0,09, z −0,30 a 0,01; boca y 0,10, z 0,02.
 */
export function Props({ id }: { id: PropId }) {
  switch (id) {
    case 'neural':
      return <Neural />
    case 'magnifier':
      return <Magnifier />
    case 'coins':
      return <Coins />
    case 'headphones':
      return <Headphones />
    case 'rocket':
      return <Rocket />
    case 'headset':
      return <Headphones color="#26222e" mic />
    case 'sailor':
      return (
        <>
          <Dome color="#f4f4f2" />
          <Brim color="#1d3557" />
          <Sunglasses />
          <Sailboat />
        </>
      )
    case 'compass':
      return <Compass />
    case 'uber':
      return (
        <>
          <Dome color="#111214" />
          <Brim color="#111214" />
          <Wheel />
          <Tears />
        </>
      )
  }
}
