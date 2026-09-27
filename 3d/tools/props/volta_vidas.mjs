// Padrões por vida de volta_prop.mjs (separados para o arquivo caber em 300 linhas).
/** Padrões por vida (nome da malha, de um ancestral até o frame, ou do material). */
export const VIDAS = {
  uber: {
    pecas: {
      tudo: '^uber$',
      volante: '^uber_volante$',
      maos: '^uber_mao_',
      rastro: '^uber_lagrima_(esq|dir)_rastro',
      gota: '^uber_lagrima_(esq|dir)_gota$',
      celular: '^uber_celular$',
      tela: '^uber_celular_tela',
    },
    // O que não pode cobrir olhos e boca (as lágrimas descem da pálpebra de propósito: medidas contra a íris).
    rosto: '^uber_(volante|mao_|celular)',
    iris: '^uber_lagrima_',
    // Respiro do lábio ao ARO (a malha do volante; as mãos, filhas dele, respondem pela zona da boca).
    aro: '^uber_volante_malha',
    maos: '^uber_mao_',
    // Centros dos olhos no glb (SITE.md) e raio da íris.
    olhos: [
      [-0.04, 0.18, 0.0],
      [0.04, 0.18, 0.0],
    ],
    irisRaio: 0.006,
  },
  // FICHA-PRODUCAO.md do fullstack, FECHAMENTO: notebook preso à mesa, adesivos numa malha só (um EMPTY por adesivo).
  fullstack: {
    pecas: {
      // O notebook (grupo da mesa); a chuva de código (fs_chuva, no fundo) é medida à parte (volta_prop_chuva.mjs).
      tudo: '^fs_mesa$',
      tampa: '^fs_notebook_tampa',
      base: '^fs_notebook_base',
      adesivos: '^fs_adesivos',
    },
    rosto: '^fs_(notebook|adesiv)',
    // Sem lágrimas: nenhuma íris a medir.
    iris: '^fs_nenhum$',
    // Respiro do lábio à borda de cima da TAMPA (adesivos incluídos, por garantia).
    aro: '^fs_(notebook_tampa|adesivos)',
    // No retrato estreito, nenhum adesivo sob o título (a tampa escura pode passar, com contraste ≥ 4,5:1).
    maos: '^fs_adesivos',
    rotuloMaos: 'adesivo',
    olhos: [],
    irisRaio: 0,
    adesivos: { malha: 'fs_adesivos_malha', prefixo: 'fs_adesivo_' },
    // Maior lado mínimo (px CSS) no 360: Node ≥ 24, nível 3 ≥ 8.
    legivel: { 360: { node: 24, r: 8, c: 8, laravel: 8 } },
    luz: 'fs_luz_tela',
  },
  // FICHA-PRODUCAO.md do qa: bug, mão com lupa, rastro e anel (espaço da cabeça) e a caixa na mesa. Nada sobre olhos e
  // boca; 0 px sobre TODA a interface, título incluído (sem a exceção de legibilidade do retrato estreito).
  qa: {
    pecas: {
      tudo: '^qa$',
      bug: '^qa_bug$',
      lupa: '^qa_lupa$',
      lente: '^qa_lupa_lente$',
      caixa: '^qa_caixa$',
      anel: '^qa_anel$',
      rastro: '^qa_rastro$',
    },
    rosto: '^qa_(bug|lupa|anel|rastro)',
    iris: '^qa_nenhum$',
    aro: '^qa_nenhum$',
    maos: '^qa_nenhum$',
    olhos: [],
    irisRaio: 0,
    tituloComoUi: true,
    // Todos os quadros contam até o fim da pausa de 3,5 s da vida qa (montagem + 1 s + 3,5 s = 4,5 s; Q17).
    janela: [0, 4.5],
    // Tamanhos mínimos (px CSS, maior lado) por largura de tela; o bug em voo sem a oclusão da cabeça.
    tamanhos: { 360: { bugVoo: 20, bugPreso: 32, lente: 48 } },
    // Fases do roteiro (s desde a montagem, props/qa/roteiro.ts): voo até a chegada, preso depois da trava.
    fases: { vooDe: 0.75, vooAte: 1.7, presoDe: 1.95, presoAte: 3.3 },
  },
}
