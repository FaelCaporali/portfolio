/**
 * Os textos de interface em português do Brasil (/pt e /pt/journey), um a um contra o inglês (en.ts): o tipo obriga
 * as mesmas chaves. Tom colaborativo e curto como o inglês. Os marcos da trajetória vêm de journey.json (já em pt) e
 * os conceitos e habilidades das tags, de pt-tags.ts.
 */
import type { Messages } from './en'

const FALLBACK = 'Não foi possível enviar agora. Fale comigo pelos contatos abaixo.'

export const pt: Messages = {
  meta: {
    home: {
      title: 'Fael Caporali',
      description: 'Rafael Caporali — desenvolvedor full-stack sênior, Belo Horizonte.',
    },
    journey: {
      title: 'A trajetória completa · Fael Caporali',
      description:
        'A carreira de Fael Caporali: dos negócios próprios ao QA, à liderança técnica e à engenharia de produtos com IA.',
    },
  },
  lang: { short: 'PT', switchTo: 'Ler em português' },
  errors: {
    notFoundTitle: 'Página não encontrada · Fael Caporali',
    notFound: 'Página não encontrada',
    notFoundText: 'Este endereço não existe.',
    failedTitle: 'Algo deu errado · Fael Caporali',
    failed: 'Algo deu errado',
    failedText: 'Não foi possível exibir a página. Tente novamente.',
    home: 'Voltar ao início',
  },
  hero: {
    section: 'Apresentação',
    // Sem artigo: "Hoje sou Tech Lead", "Ontem fui Motorista de Uber".
    opening: (past: boolean) => (past ? 'Ontem fui' : 'Hoje sou'),
    loadingOpening: 'Hoje estou',
    loading: 'carregando',
    slots: {
      financeiro: 'Assistente Financeiro',
      empreendedor: 'Empreendedor',
      vela: 'Instrutor de Vela',
      uber: 'Motorista de Uber',
      fullstack: 'Dev FullStack',
      qa: 'Analista de QA',
      devops: 'Arquiteto de Soluções',
      techlead: 'Tech Lead',
      ai: 'AI Product Engineer',
    },
    titlesLabel: 'Títulos',
    titles: ['Dev FullStack', 'Analista de QA', 'TechLead'],
    linksLabel: 'Links',
    journeyLink: 'Ver a trajetória completa',
    resume: 'Currículo',
    timeline: 'Linha do tempo',
    source: 'Ver o código no GitHub',
    sourceTitle: 'Ver o código',
  },
  contact: {
    open: 'Fale comigo',
    title: 'Mande uma mensagem',
    name: 'Nome',
    contact: 'E-mail ou WhatsApp para eu responder',
    message: 'Mensagem',
    send: 'Enviar',
    sending: 'Enviando…',
    verifying: 'Verificando…',
    sent: 'Obrigado! Mensagem recebida. Respondo em breve.',
    another: 'Enviar outra mensagem',
    direct: 'Ou fale comigo diretamente',
    hints: {
      name: 'Informe seu nome.',
      contact: 'Informe um e-mail ou um telefone.',
      message: (min: number) => `Escreva pelo menos ${min} caracteres.`,
    },
    fallback: FALLBACK,
    stillVerifying: 'Ainda confirmando que você não é um robô. Aguarde um instante e tente de novo.',
    errors: {
      method: 'Não foi possível enviar o formulário por aqui. Fale comigo pelos contatos abaixo.',
      forbidden: 'Esta página não tem permissão para enviar o formulário. Fale comigo pelos contatos abaixo.',
      unsupported:
        'Seu navegador enviou o formulário num formato que não consigo ler. Fale comigo pelos contatos abaixo.',
      rate_limited: 'Muitas tentativas. Tente de novo em um minuto.',
      too_large: 'A mensagem está longa demais. Encurte o texto e tente de novo.',
      invalid: 'Não consegui ler parte do formulário. Confira e tente de novo.',
      verification_failed: 'A verificação anti-robô falhou. Tente de novo.',
      busy: 'O limite de mensagens de hoje foi atingido. Fale comigo pelos contatos abaixo.',
      unavailable: FALLBACK,
    },
    copy: {
      list: 'Contato',
      email: { title: 'Copiar e-mail', copied: 'E-mail copiado' },
      phone: { title: 'Copiar telefone', copied: 'Telefone copiado' },
      failed: 'Não foi possível copiar. Selecione o texto.',
    },
  },
  journey: {
    title: { before: 'A ', word: 'trajetória', after: ' completa' },
    parts: { prologue: 'Prólogo', story: 'A história' },
    today: 'hoje',
    months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
    present: 'hoje',
    lives: 'Vidas',
    map: 'Mapa da trajetória',
    filter: 'Filtrar o mapa',
    years: 'Anos',
    from: 'De',
    to: 'Até',
    groups: { tools: 'Ferramentas', concepts: 'Conceitos', skills: 'Habilidades' },
    search: (group: string) => `Buscar ${group.toLowerCase()}`,
    removeFilter: (tag: string) => `Remover filtro: ${tag}`,
    clear: 'Limpar',
    empty: 'Nada no mapa corresponde a esses filtros.',
    clearAll: 'Limpar filtros',
    readStory: 'Ler a história',
    closeStory: 'Fechar a história',
  },
}
