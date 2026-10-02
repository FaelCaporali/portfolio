/**
 * O conteúdo objetivo da home, abaixo do herói (contratos de 30/09 e 01/10, .wai/pagina-objetiva/05-contrato.md,
 * 08-contrato-v2.md e 11-contrato-v3.md): ofertas, o que já entreguei, stack, perguntas frequentes e fechamento, em
 * inglês e em português.
 * Texto em overview.json (sem nome de empregador, cliente ou contrato: eles ficam na trajetória); aqui o tipo, que o
 * compilador confere contra o JSON, e a âncora e a cor de cada marco na trajetória. Vai no HTML de / e /pt
 * (react-router.config.ts): buscadores e IAs leem sem JavaScript.
 */
import type { Lang } from '../../shared/i18n'
import { localePath } from '../i18n/lang'
import type { StageId } from './journey'
import data from './overview.json'
import { journeyPath } from './profile'

type Text = Record<Lang, string>
type TextList = Record<Lang, string[]>

/** Um trabalho que prova a oferta, com o marco da trajetória onde ele é contado (o id em journey.json). */
interface Proof extends Text {
  journeyId: string
}

export interface Overview {
  cta: Text
  /** O fecho de cada lista ("and many more"): leva ao início da trajetória; `label` é o nome acessível do link. */
  more: { text: Text; label: Text }
  offers: {
    title: Text
    lede: Text
    /** `action`: o rótulo do CTA da oferta (o título dela vai como assunto ao formulário). */
    items: { title: Text; text: Text; proof: Proof[]; tags: string[]; action: Text }[]
    facts: Text[]
    action: Text
  }
  experience: {
    title: Text
    story: Text
    /** O que foi feito, num contexto genérico (sem empresa nem período: a trajetória tem os dois). */
    items: { journeyId: string; context: Text; role: Text; results: TextList }[]
    before: { text: Text; link: Text }
  }
  stack: { title: Text; groups: { label: Text; items: string[] }[]; source: Text }
  faq: { title: Text; items: { q: Text; a: Text }[] }
  closing: { title: Text; text: Text; action: Text }
}

export const overview: Overview = data

/** A região abaixo do herói: o alvo do CTA "Cut the BS" (/#overview, /pt#overview). */
export const OVERVIEW_ID = 'overview'

/**
 * O marco em que uma vida do herói começa tem o id da vida na página da trajetória (Checkpoint.tsx: /journey#qa, não
 * #brickup-quality). Só os marcos citados aqui; o teste (overview.test.ts) confere contra journey.json, que a home não
 * baixa.
 */
export const LIFE_ANCHORS: Readonly<Record<string, StageId>> = {
  mpc: 'ai',
  'brickup-quality': 'qa',
  'beamble-lead': 'techlead',
  'beamble-architecture': 'devops',
}

/**
 * A vida em que cada marco citado pousa na trajetória (a última que começou até ele; JourneyPage.tsx): a cor do link
 * que leva a ele. O teste confere contra journey.json.
 */
export const LIFE_OF: Readonly<Record<string, StageId>> = {
  ...LIFE_ANCHORS,
  previa: 'devops',
  'brickup-ai': 'qa',
  'brickup-lead': 'qa',
  bid: 'devops',
}

/** O endereço do marco na trajetória, no idioma da página: /journey#ai, /pt/journey#bid. */
export const journeyHref = (lang: Lang, journeyId: string) =>
  `${localePath(lang, journeyPath)}#${LIFE_ANCHORS[journeyId] ?? journeyId}`

/** O início da trajetória, o prólogo (antes da tecnologia): a seção #prologue da página. */
export const prologueHref = (lang: Lang) => `${localePath(lang, journeyPath)}#prologue`

/** O início da trajetória, sem âncora: o destino de "and many more". */
export const journeyStartHref = (lang: Lang) => localePath(lang, journeyPath)
