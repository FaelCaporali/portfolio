// Limites dos portões mecânicos do estúdio 3D (ESTUDIO §4 e §5). Mudar um limite exige motivo no HANDOFF da versão.
// Medidas em px CSS da tela. "Cabeça" = contorno do busto acima do queixo aproximado (y 0,04 do glb).
export const LIMITES = {
  silhueta: {
    // Parte da peça escondida atrás da cabeça: a silhueta chega truncada e o que ela carrega some.
    ocultaMax: 0.1,
    // Contorno da peça que encosta na cabeça: acima disso a mancha se funde com a da cabeça e não se lê sozinha.
    contornoNaCabecaMax: 0.25,
  },
  tamanho: {
    // Régua do ESTUDIO §4 como proporção: cabeça ~100 × adereço ~30–80 → maior lado da peça entre 0,3 e 0,8 da
    // altura da cabeça, em cada tela.
    razaoMin: 0.3,
    razaoMax: 0.8,
    // Nenhuma parte com menos de 2 px de maior lado em nenhuma tela (ESTUDIO §4: abaixo disso é desperdício).
    parteMinPx: 2,
    // Densidade de triângulos por px² do retângulo da parte na tela de referência (1440×900): acima de 0,5 o
    // triângulo médio tem menos de 2 px² e o detalhe de geometria não aparece (serrilha, relevo, gravação).
    densidadeMax: 0.5,
  },
  arteCena: {
    // Respiro em volta de cada retângulo de texto, cabeçalho, indicador e balão.
    margemUi: 4,
    pxSobreUiMax: 0,
    // Olhos e boca nunca cobertos.
    pxRostoMax: 0,
    ocultaMax: 0.1,
    // A peça não encosta na borda da tela (seria cortada).
    bordaMinPx: 2,
  },
  orcamento: {
    bytesMax: 150 * 1024,
    // Chamadas de desenho da peça medidas na página (renderer.info com e sem a peça). O busto inteiro custa 12.
    chamadasMax: 10,
    triangulosMax: 30000,
    texturaLadoMax: 1024,
    // Compressão de geometria esperada no glb (modelador-3d §4.7, tecnico-web-3d §2).
    compressao: ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'],
    mimes: ['image/jpeg', 'image/webp', 'image/ktx2'],
  },
}

/**
 * Exceções por vida, com o motivo na ficha da vida; as outras vidas ficam nos limites acima.
 * uber (FICHA-PRODUCAO.md, ADENDO 6): volante, duas mãos realistas com pele e normal próprios, lágrimas e celular (em
 * teste); a ficha fixa 350 kB e 12 chamadas de desenho.
 * fullstack (FICHA-PRODUCAO.md, FECHAMENTO): notebook (tampa, base com teclado) e 12 adesivos num atlas; a ficha fixa
 * 250 kB, 10 chamadas e 20 k triângulos.
 * qa (FICHA-PRODUCAO.md, Elementos): bug com élitros, asas e patas articulados, mão realista com a lupa (vidro) e a caixa
 * entomológica com os espécimes; a ficha fixa 300 kB, 12 chamadas e 25 k triângulos.
 */
export const POR_VIDA = {
  uber: { orcamento: { bytesMax: 350 * 1024, chamadasMax: 12 } },
  fullstack: { orcamento: { bytesMax: 250 * 1024, chamadasMax: 10, triangulosMax: 20000 } },
  qa: { orcamento: { bytesMax: 300 * 1024, chamadasMax: 12, triangulosMax: 25000 } },
}

/** Limites valendo para a vida (os gerais com as exceções dela por cima). */
export function limitesDa(vida) {
  const exc = POR_VIDA[vida] ?? {}
  return Object.fromEntries(Object.entries(LIMITES).map(([k, v]) => [k, { ...v, ...(exc[k] ?? {}) }]))
}
