import { useNavigation } from 'react-router'
import { cx } from '../lib/cx'

/**
 * Retorno da troca de página pelo roteador (U2, D-143): enquanto a próxima página carrega (useNavigation fora de
 * 'idle'), uma barra fina no topo corre de um lado a outro; some quando a página nova pinta (o roteador só volta a
 * 'idle' no commit dela). Vale para as duas direções (herói → trajetória e a volta), por estar na raiz.
 * Só transform e opacity (index.css: .nav-progress), que o compositor anima mesmo com o processador ocupado montando a
 * página nova; com movimento reduzido, a barra fica parada. Decorativa: o leitor de tela recebe a página nova.
 */
export function NavigationProgress() {
  const busy = useNavigation().state !== 'idle'
  return <div aria-hidden className={cx('nav-progress', busy && 'is-busy')} />
}
