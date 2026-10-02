/**
 * Os filtros da trajetória no endereço (/journey?tools=React&from=2023; src/features/journey/useFilters.ts). Com algum
 * deles, o Worker marca o <html> (FILTERING_ATTR) e a lista fica invisível até o navegador aplicar o filtro: o HTML do
 * build traz todos os marcos, e sem a marca a página pularia (CLS 0,37 medido em 02/10).
 */
const FILTER_PARAMS = ['from', 'to', 'tools', 'concepts', 'skills'] as const

export const FILTERING_ATTR = 'data-filtering'

/** O endereço pede a trajetória filtrada. */
export const wantsFilteredJourney = (path: string, search: URLSearchParams) =>
  path === '/journey' && FILTER_PARAMS.some((p) => search.has(p))
