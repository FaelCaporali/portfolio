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
