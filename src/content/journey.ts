/**
 * A jornada do hero. Cada etapa = um slot da frase "Today I am a [slot]".
 * Ordem definida pelo Fael em 2026-09-14. Props reais (.glb) substituem `placeholder`
 * quando `model` existir em public/models/props/.
 */
export type Lang = 'pt' | 'en'

export type PlaceholderProp =
  | 'coins'
  | 'rocket'
  | 'sail'
  | 'wheel-tears'
  | 'bug-lens'
  | 'brackets'
  | 'team'
  | 'compass'
  | 'neural'

export interface Stage {
  id: string
  slot: Record<Lang, string>
  /** Cor de destaque da etapa: tinge partículas, base e props. */
  accent: string
  /** Arquivo em public/models/props/<model>. Ausente enquanto o Fael não modelar. */
  model?: string
  placeholder: PlaceholderProp
  /** Tom emocional da cabeça: usado para animações da própria cabeça. */
  mood: 'neutral' | 'proud' | 'crying' | 'focused'
  /** Duração em ms antes do avanço automático. */
  hold: number
}

export const stages: Stage[] = [
  { id: 'financeiro', slot: { pt: 'administrador financeiro', en: 'financial manager' }, accent: '#c9a227', placeholder: 'coins', mood: 'neutral', hold: 3200 },
  { id: 'empreendedor', slot: { pt: 'empreendedor', en: 'entrepreneur' }, accent: '#ff7a1a', placeholder: 'rocket', mood: 'proud', hold: 3200 },
  { id: 'vela', slot: { pt: 'professor de barco a vela', en: 'sailing instructor' }, accent: '#2ea8ff', placeholder: 'sail', mood: 'proud', hold: 3200 },
  { id: 'uber', slot: { pt: 'motorista de Uber', en: 'Uber driver' }, accent: '#8a8a8a', placeholder: 'wheel-tears', mood: 'crying', hold: 4200 },
  { id: 'qa', slot: { pt: 'QA tester', en: 'QA tester' }, accent: '#e0324b', placeholder: 'bug-lens', mood: 'focused', hold: 3200 },
  { id: 'fullstack', slot: { pt: 'fullstack dev', en: 'fullstack dev' }, accent: '#3ddc84', placeholder: 'brackets', mood: 'focused', hold: 3200 },
  { id: 'techlead', slot: { pt: 'tech lead', en: 'tech lead' }, accent: '#b388ff', placeholder: 'team', mood: 'proud', hold: 3200 },
  { id: 'cto', slot: { pt: 'FDE CTO', en: 'FDE CTO' }, accent: '#ffd166', placeholder: 'compass', mood: 'focused', hold: 3200 },
  { id: 'ai', slot: { pt: 'AI software developer', en: 'AI software developer' }, accent: '#00e5ff', placeholder: 'neural', mood: 'proud', hold: 4000 },
]
