import { OPENING, stages, type Stage } from '../../content/journey'
import { profile } from '../../content/profile'
import { MESSAGES, useLang } from '../../i18n/lang'
import { abertura } from './model/text'

const openingStage = stages.find((s) => s.id === OPENING)
if (!openingStage) throw new Error('BotHero: vida de abertura fora da lista')
/** As 9 vidas, a de abertura primeiro (só ela ganha loading="eager", P2): o resto na ordem cronológica. */
const ORDER: readonly Stage[] = [openingStage, ...stages.filter((s) => s.id !== OPENING)]

/**
 * A variante dos robôs do herói (camada 1, R2/R3/R4 de 03-plano-versao-robos.md): as 9 vidas inteiras, cada uma com a
 * frase da vida (a MESMA função `abertura` do herói humano, HeroCopy.tsx — nunca texto reescrito, decisão 7) e uma
 * imagem estática da cena (capturada no site real, decisão do Fael, P1/P2: WebP ~480×480, até 40 KB). Sem <canvas>,
 * sem three.js, sem glb: só HTML e imagem, tudo de uma vez (o "infinite scroll" sem rolagem, R4). A rota que a usa
 * (routes/home-bot.tsx) não hidrata (D-ROBO-HIDR, Capítulo 7 do plano): este componente não tem estado nem interação.
 */
export function BotHero() {
  const lang = useLang()
  const m = MESSAGES[lang]
  return (
    <header>
      <h1>{profile.name}</h1>
      <ul>
        {ORDER.map((s, i) => (
          <li key={s.id}>
            <img
              src={`/hero-bot/${s.id}.webp`}
              width={480}
              height={480}
              alt={m.hero.slots[s.id]}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <p>
              {abertura(m, s)} {m.hero.slots[s.id]}
            </p>
          </li>
        ))}
      </ul>
    </header>
  )
}
