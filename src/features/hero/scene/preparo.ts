/**
 * Preparar uma peça antes de ela entrar em cena, sem travar a thread principal (#138). Num perfil novo do Chrome, cada
 * troca de vida levava 240–340 ms numa tarefa só, quase tudo esperando a GPU compilar shaders (getProgramInfoLog): o
 * adereço que sai de cena descarta os seus materiais, o three apagava o programa junto com o último material que o
 * usava, e a vida seguinte (ou a mesma, na volta) compilava de novo, de forma síncrona, no quadro da troca. Aqui:
 * - os shaders compilam em paralelo (compileAsync, KHR_parallel_shader_compile) e o 1º uso de cada programa (as
 *   leituras síncronas da GPU) acontece na preparação, um programa por tarefa;
 * - as texturas sobem à GPU uma por tarefa;
 * - os programas ficam vivos enquanto o canvas vive, e o material novo com a mesma chave os reaproveita sem compilar.
 */
import type * as THREE from 'three'
import { pausa } from './pausa'

const vistos = new WeakSet<THREE.WebGLProgram>()

/**
 * Segura cada programa de shader do renderer uma vez (uma referência a mais no contador de uso do three): o descarte
 * dos materiais não o apaga. Os programas são poucos (um por combinação de material), sem crescer a cada troca. Nada
 * alocado: roda a cada quadro, para pegar também os programas criados com a vida já em cena.
 */
export function fixarProgramas(gl: THREE.WebGLRenderer) {
  const programas = gl.info.programs
  if (!programas) return
  for (let i = 0; i < programas.length; i++) {
    const p = programas[i]
    if (!p || vistos.has(p)) continue
    vistos.add(p)
    p.usedTimes += 1
  }
}

/**
 * No ShaderMaterial a chave do programa leva o número que o three dá ao código do shader, e o número morre com o último
 * material que usa aquele código: a instância nova da vida ganharia número novo e programa novo. Um material por código
 * fica sem descarte (o dono o descarta, e nada acontece), segurando o número. São poucos: um por código de shader, por
 * renderer (o número é do renderer: o herói montado de novo, depois da /journey, segura os seus).
 */
const codigos = new WeakMap<THREE.WebGLRenderer, Set<string>>()
function segurarCodigo(gl: THREE.WebGLRenderer, m: THREE.Material) {
  const s = m as Partial<THREE.ShaderMaterial>
  if (s.isShaderMaterial !== true || s.vertexShader === undefined || s.fragmentShader === undefined) return
  const codigo = `${s.vertexShader}\n//\n${s.fragmentShader}`
  let doRenderer = codigos.get(gl)
  if (!doRenderer) {
    doRenderer = new Set()
    codigos.set(gl, doRenderer)
  }
  if (doRenderer.has(codigo)) return
  doRenderer.add(codigo)
  m.dispose = () => undefined
}

const isTexture = (v: unknown): v is THREE.Texture =>
  typeof v === 'object' && v !== null && (v as Partial<THREE.Texture>).isTexture === true

/** Texturas de um material: os mapas e, no ShaderMaterial, os uniforms. */
function texturasDe(m: THREE.Material, out: Set<THREE.Texture>) {
  for (const v of Object.values(m)) if (isTexture(v)) out.add(v)
  const uniforms = (m as Partial<THREE.ShaderMaterial>).uniforms
  if (uniforms) for (const u of Object.values(uniforms)) if (isTexture(u.value)) out.add(u.value)
}

function materiaisDe(objeto: THREE.Object3D) {
  const out = new Set<THREE.Material>()
  objeto.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material
    if (m) for (const x of Array.isArray(m) ? m : [m]) out.add(x)
  })
  return out
}

interface PropriedadesDoMaterial {
  /** Todos os programas do material (o transparente de dois lados tem um por face). */
  programs?: Map<string, THREE.WebGLProgram>
}

/** A peça ainda está na cena e o contexto vive (o canvas não desmontou, a vida não saiu dos bastidores). */
function vivo(gl: THREE.WebGLRenderer, cena: THREE.Scene, objetos: readonly THREE.Object3D[]) {
  if (gl.getContext().isContextLost()) return false
  return objetos.every((o) => {
    let r: THREE.Object3D = o
    while (r.parent) r = r.parent
    return r === cena
  })
}

/** Quanto a fila espera os programas de uma peça ficarem prontos na GPU (ms). */
const ESPERA_MAX_MS = 5000

const espera = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Espera os programas ficarem prontos (KHR_parallel_shader_compile), como o compileAsync do three, mas sem quebrar se a
 * peça sair no meio: a espera para (false) se a peça sair da cena ou o contexto se perder. Sem a extensão, uma espera
 * curta e segue.
 */
async function esperarProgramas(
  gl: THREE.WebGLRenderer,
  programas: ReadonlySet<THREE.WebGLProgram>,
  ainda: () => boolean,
) {
  if (gl.extensions.get('KHR_parallel_shader_compile') === null) {
    await espera(10)
    return ainda()
  }
  const faltam = new Set(programas as ReadonlySet<unknown> as ReadonlySet<{ isReady: () => boolean }>)
  // Nenhuma espera sem limite na fila (ela é uma por vez): passado este tempo, segue (o 1º uso espera a GPU, e só).
  const ate = performance.now() + ESPERA_MAX_MS
  for (;;) {
    if (!ainda()) return false
    if (performance.now() > ate) return true
    for (const p of faltam) if (p.isReady()) faltam.delete(p)
    if (faltam.size === 0) return true
    await espera(10)
  }
}

/** Os programas (todos os de cada material) e as texturas de tudo sob `objetos`; segura os códigos de shader. */
function coletar(gl: THREE.WebGLRenderer, objetos: readonly THREE.Object3D[]) {
  const programas = new Set<THREE.WebGLProgram>()
  const texturas = new Set<THREE.Texture>()
  for (const objeto of objetos) {
    for (const m of materiaisDe(objeto)) {
      segurarCodigo(gl, m)
      const doMaterial = (gl.properties.get(m) as PropriedadesDoMaterial).programs
      if (doMaterial) for (const p of doMaterial.values()) programas.add(p)
      texturasDe(m, texturas)
    }
  }
  return { programas, texturas }
}

/**
 * Depois da parte síncrona do compile: espera TODOS os programas dos materiais ficarem prontos (não só o atual de
 * cada um: o transparente de dois lados tem um por face), faz o 1º uso de cada um e sobe as texturas, uma coisa por
 * tarefa. Para no meio (false) se a peça sair da cena ou o canvas desmontar: nada é criado para quem já saiu.
 */
async function concluir(gl: THREE.WebGLRenderer, cena: THREE.Scene, objetos: readonly THREE.Object3D[]) {
  const ainda = () => vivo(gl, cena, objetos)
  fixarProgramas(gl)
  const { programas, texturas } = coletar(gl, objetos)
  if (!(await esperarProgramas(gl, programas, ainda))) return false
  // 1º uso: as leituras síncronas do programa (uniforms, atributos e, em desenvolvimento, o log de erros).
  for (const p of programas) {
    await pausa()
    if (!ainda()) return false
    p.getUniforms()
    p.getAttributes()
  }
  for (const t of texturas) {
    if (t.isRenderTargetTexture) continue
    await pausa()
    if (!ainda()) return false
    gl.initTexture(t)
  }
  return true
}

/**
 * Uma peça por vez (as leituras síncronas de uma esperariam a GPU compilar os shaders da outra), a de menor
 * `prioridade` primeiro, lida na hora de escolher (a ordem do carrossel muda com o indicador).
 */
interface Vez {
  prioridade: () => number
  tarefa: () => Promise<boolean>
  fim: (pronta: boolean) => void
}
const esperando: Vez[] = []
let ocupado = false
async function atender() {
  if (ocupado) return
  ocupado = true
  for (;;) {
    let i = -1
    for (let k = 0; k < esperando.length; k++) {
      const e = esperando[k]
      const melhor = esperando[i]
      if (e && (!melhor || e.prioridade() < melhor.prioridade())) i = k
    }
    const vez = esperando.splice(i, 1)[0]
    if (!vez) break
    let pronta = false
    try {
      pronta = await vez.tarefa()
    } catch (e) {
      // Uma peça que não prepara não para a fila; ela só não fica pronta (o erro vai para o console).
      console.error(e)
    }
    vez.fim(pronta)
  }
  ocupado = false
}
/** Resolve com true quando a peça ficou pronta; false se ela saiu no meio (ou falhou). */
function naVez(prioridade: () => number, tarefa: () => Promise<boolean>) {
  return new Promise<boolean>((resolve) => {
    esperando.push({ prioridade, tarefa, fim: resolve })
    void atender()
  })
}

/**
 * Compila os shaders de tudo sob `objeto` (visível ou não) para a luz e o ambiente de `cena`, faz o 1º uso de cada
 * programa e sobe as texturas, sem tarefa longa. Resolve (true) quando a peça pode ser desenhada sem esperar a GPU.
 */
export const prepararObjeto = (
  gl: THREE.WebGLRenderer,
  objeto: THREE.Object3D,
  camera: THREE.Camera,
  cena: THREE.Scene,
) =>
  naVez(
    () => -1,
    () => {
      if (!vivo(gl, cena, [objeto])) return Promise.resolve(false)
      gl.compile(objeto, camera, cena)
      return concluir(gl, cena, [objeto])
    },
  )

/** Marca dos grupos das vidas no `frame` (Props.tsx): o resto do frame é o busto e o furacão. */
export const BASTIDOR = { bastidor: true } as const
const ehBastidor = (o: THREE.Object3D) => o.userData.bastidor === true
const temLuz = (o: THREE.Object3D) => o.getObjectsByProperty('isLight', true).length > 0
/**
 * Prepara uma vida escondida (`grupo`, filho do `frame`) com a luz que a cena terá quando ela entrar: as luzes dela
 * acesas e as das outras vidas apagadas. Só pela duração das chamadas síncronas do compile, sem quadro no meio: nada
 * aparece. O compile soma as luzes visíveis da cena às do objeto compilado; para a luz da vida contar uma vez só, o
 * grupo fica escondido enquanto as raízes dela compilam. A vida que traz luz (fullstack) muda o número de luzes da
 * cena, e o busto e o furacão também ganham um programa para ela (com os ancestrais visíveis: antes da 'cena' o busto
 * está escondido e a luz não contaria); sem isso, recompilavam no quadro da entrada. `prioridade`: a posição da vida
 * no carrossel. Resolve com false se a vida saiu dos bastidores antes de ficar pronta.
 */
export function prepararVida(
  gl: THREE.WebGLRenderer,
  grupo: THREE.Object3D,
  camera: THREE.Camera,
  cena: THREE.Scene,
  prioridade: () => number,
  /** Antes do compile, na mesma vez da fila (o fundo que a vida pinta e os mapas que ele põe nos materiais). */
  primeiro: () => Promise<void> = () => Promise.resolve(),
) {
  return naVez(prioridade, async () => {
    if (!vivo(gl, cena, [grupo])) return false
    await primeiro()
    if (!vivo(gl, cena, [grupo])) return false
    const irmaos = grupo.parent?.children ?? []
    const resto = temLuz(grupo) ? irmaos.filter((o) => !ehBastidor(o)) : []
    const raizes = [...grupo.children]
    const antes = new Map<THREE.Object3D, boolean>()
    const mostrar = (o: THREE.Object3D, v: boolean) => {
      if (!antes.has(o)) antes.set(o, o.visible)
      o.visible = v
    }
    for (const o of irmaos) if (o !== grupo && ehBastidor(o)) mostrar(o, false)
    for (const raiz of raizes) mostrar(raiz, true)
    for (let o: THREE.Object3D | null = grupo; o; o = o.parent) mostrar(o, true)
    for (const o of resto) gl.compile(o, camera, cena)
    mostrar(grupo, false)
    for (const o of raizes) gl.compile(o, camera, cena)
    for (const [o, v] of antes) o.visible = v
    // De volta à luz de agora: o compile deixa em cada material o programa da luz que ele viu, e o furacão e os olhos
    // (sem luz) desenhariam em cena com o da luz da vida, recém-ligado. Os dois programas ficam prontos na espera.
    for (const o of resto) gl.compile(o, camera, cena)
    return concluir(gl, cena, [grupo, ...resto])
  })
}
