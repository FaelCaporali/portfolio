/**
 * Pintura gravada (#138): o pincel dos fundos (ai, devops, techlead) pinta num contexto 2D que só GRAVA cada chamada e
 * cada atribuição, com os argumentos daquele instante; depois a gravação toca no canvas de verdade, em fatias, na mesma
 * ordem e com os mesmos valores — o resultado sai pixel a pixel igual, sem a pintura inteira numa tarefa só.
 * O que o desenho lê enquanto pinta (o estado que ele mesmo escreveu, a medida de texto) vem do estado gravado, fiel ao
 * canvas de verdade: valor inválido não entra (o canvas o ignora; a validade de cada valor é conferida uma vez num
 * canvas de teste), restore sem save não muda nada, e a medida de texto sai de um canvas de medir com a mesma fonte.
 * Gradiente criado na pintura grava as paradas de cor como passos: entram na mesma ordem da pintura. Leitura de pixel,
 * de caminho ou de matriz durante a gravação é erro (nenhum pincel faz).
 */
type Ctx = CanvasRenderingContext2D
/** [alvo (contexto ou gradiente), nome, argumentos (chamada) ou null (atribuição), valor atribuído]. */
type Op = readonly [object, string, unknown[] | null, unknown]

/** O que pesa na medida de texto (o resto do estado não muda a largura). */
const DO_TEXTO = [
  'font',
  'letterSpacing',
  'wordSpacing',
  'fontKerning',
  'fontStretch',
  'fontVariantCaps',
  'textRendering',
  'direction',
] as const
const GRADIENTE = new Set(['createLinearGradient', 'createRadialGradient', 'createConicGradient'])
/** Leem pixel, caminho ou matriz: impossível responder antes de tocar. */
const LE = new Set(['getImageData', 'getTransform', 'isPointInPath', 'isPointInStroke'])

const novoContexto = () => {
  const cv = document.createElement('canvas')
  cv.width = 1
  cv.height = 1
  const c = cv.getContext('2d')
  if (!c) throw new Error('gravação: canvas 2D indisponível')
  return c
}

let apoio: { medir: Ctx; padrao: Ctx; teste: Ctx; aplicado: Map<string, unknown> } | null = null
const contextos = () =>
  (apoio ??= { medir: novoContexto(), padrao: novoContexto(), teste: novoContexto(), aplicado: new Map() })

/** Valores válidos em alguma propriedade de estado, para testar as outras (o que muda uma, vale como alternativa). */
const ALTERNATIVAS: readonly unknown[] = [
  '#123456',
  '13px serif',
  0.37,
  3,
  'round',
  'bevel',
  'right',
  'bottom',
  'rtl',
  'copy',
  'none',
  'small-caps',
  'condensed',
  'optimizeSpeed',
  '1px',
  'high',
]
const alternativas = new Map<string, unknown>()
/** Um valor válido da propriedade, diferente do padrão (undefined: nenhum da lista serve). */
function alternativa(t: Record<string, unknown>, ctx: Ctx, nome: string) {
  if (alternativas.has(nome)) return alternativas.get(nome)
  ctx.save()
  const padrao = t[nome]
  let achada: unknown = undefined
  for (const a of ALTERNATIVAS) {
    t[nome] = a
    if (t[nome] !== padrao) {
      achada = t[nome]
      break
    }
  }
  ctx.restore()
  alternativas.set(nome, achada)
  return achada
}

/**
 * Se o canvas aceita o valor na propriedade (o inválido ele ignora, e o estado não muda), conferido uma vez por
 * (propriedade, valor) num canvas de teste: a atribuição pega se muda o valor que estava, a partir do padrão ou de uma
 * alternativa válida (o valor pode ser o próprio padrão).
 */
const validos = new Map<string, Map<unknown, boolean>>()
function valido(nome: string, v: unknown) {
  if (typeof v !== 'string' && typeof v !== 'number') return true
  let daPropriedade = validos.get(nome)
  if (!daPropriedade) {
    daPropriedade = new Map()
    validos.set(nome, daPropriedade)
  }
  let ok = daPropriedade.get(v)
  if (ok === undefined) {
    const ctx = contextos().teste
    const t = ctx as unknown as Record<string, unknown>
    ctx.save()
    const padrao = t[nome]
    t[nome] = v
    ok = t[nome] !== padrao
    if (!ok) {
      const alt = alternativa(t, ctx, nome)
      if (alt === undefined) ok = true
      else {
        const pegar = (x: unknown) => {
          t[nome] = x
        }
        pegar(alt)
        pegar(v)
        ok = t[nome] !== alt
      }
    }
    ctx.restore()
    daPropriedade.set(v, ok)
  }
  return ok
}

function medir(estado: ReadonlyMap<string, unknown>, texto: string) {
  const { medir: m, padrao, aplicado } = contextos()
  const alvo = m as unknown as Record<string, unknown>
  const base = padrao as unknown as Record<string, unknown>
  // Só o que mudou desde a última medida (atribuir a fonte custa: o navegador a interpreta de novo).
  for (const k of DO_TEXTO) {
    const v = estado.has(k) ? estado.get(k) : base[k]
    if (aplicado.has(k) && aplicado.get(k) === v) continue
    alvo[k] = v
    aplicado.set(k, v)
  }
  return m.measureText(texto)
}

/** Se o nome é um método do contexto 2D (lido uma vez por nome). */
const metodos = new Map<string, boolean>()
function ehMetodo(real: Ctx, nome: string) {
  let m = metodos.get(nome)
  if (m === undefined) {
    m = typeof Reflect.get(real, nome) === 'function'
    metodos.set(nome, m)
  }
  return m
}

type Funcao = (...a: unknown[]) => unknown
const metodo = (alvo: object, nome: string) => Reflect.get(alvo, nome) as Funcao

export class Gravacao {
  private readonly ops: Op[] = []
  /** Gradiente entregue à pintura (gravador) → o de verdade. */
  private readonly reais = new WeakMap<object, object>()

  /** O valor como o canvas de verdade o recebe: cópia de lista, gradiente de verdade no lugar do gravador. */
  private valor(v: unknown): unknown {
    if (Array.isArray(v)) return [...(v as unknown[])]
    if (typeof v === 'object' && v !== null) return this.reais.get(v) ?? v
    return v
  }

  /** Gradiente de verdade (criado já) cujas paradas de cor são gravadas na ordem da pintura. */
  private gradiente(real: Ctx, nome: string, a: unknown[]) {
    const g = metodo(real, nome).apply(real, a) as CanvasGradient
    const gravador = new Proxy(g, {
      get: (_, k) =>
        k === 'addColorStop'
          ? (...b: unknown[]) => {
              this.ops.push([g, 'addColorStop', b, undefined])
            }
          : (Reflect.get(g, k) as unknown),
    })
    this.reais.set(gravador, g)
    return gravador
  }

  /** Contexto que grava no lugar de `real` (o estado começa no padrão: o canvas é novo). */
  contexto(real: Ctx): Ctx {
    const ops = this.ops
    let estado = new Map<string, unknown>()
    const pilha: Map<string, unknown>[] = []
    const funcoes = new Map<string, Funcao>()
    const chamar = (nome: string): Funcao => {
      if (nome === 'measureText') return (...a) => medir(estado, a[0] as string)
      if (nome === 'getLineDash') return () => [...((estado.get('lineDash') as number[] | undefined) ?? [])]
      if (GRADIENTE.has(nome)) return (...a) => this.gradiente(real, nome, a)
      if (nome === 'createPattern') return (...a) => metodo(real, nome).apply(real, a)
      if (LE.has(nome)) throw new Error(`gravação: ${nome} durante a pintura`)
      return (...a) => {
        const args = a.map((v) => this.valor(v))
        ops.push([real, nome, args, undefined])
        if (nome === 'save') pilha.push(new Map(estado))
        // Restore sem save: o canvas não muda nada.
        else if (nome === 'restore') estado = pilha.pop() ?? estado
        else if (nome === 'reset') {
          estado = new Map()
          pilha.length = 0
        } else if (nome === 'setLineDash') {
          const d = args[0]
          // Tracejado com valor não finito ou negativo: o canvas ignora. Número ímpar de valores: ele duplica a lista.
          if (Array.isArray(d) && d.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) {
            const lista = d as number[]
            estado.set('lineDash', lista.length % 2 ? [...lista, ...lista] : lista)
          }
        }
      }
    }
    return new Proxy(real, {
      get(_, nome) {
        if (typeof nome !== 'string' || nome === 'canvas') return Reflect.get(real, nome) as unknown
        if (!ehMetodo(real, nome)) return estado.has(nome) ? estado.get(nome) : (Reflect.get(real, nome) as unknown)
        let f = funcoes.get(nome)
        if (!f) {
          f = chamar(nome)
          funcoes.set(nome, f)
        }
        return f
      },
      set: (_, nome, valor) => {
        if (typeof nome !== 'string') return false
        const v = this.valor(valor)
        ops.push([real, nome, null, v])
        if (valido(nome, v)) estado.set(nome, v)
        return true
      },
    })
  }

  /** Toca a gravação no canvas de verdade, na ordem; um passo por chamada (quem roda decide as fatias). */
  *tocar(): Generator<void, void> {
    for (const [alvo, nome, args, valor] of this.ops) {
      if (args === null) Reflect.set(alvo, nome, valor)
      else metodo(alvo, nome).apply(alvo, args)
      yield
    }
    this.ops.length = 0
  }
}
