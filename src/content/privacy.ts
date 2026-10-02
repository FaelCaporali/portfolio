/**
 * A página /privacy (e /pt/privacy): o aviso de privacidade do site (LGPD, art. 9º), D-MON2
 * (.wai/monitoramento/02-plano.md). Diz exatamente o que o Worker grava (worker/visits.ts, worker/contact.ts, o
 * registro do MCP) e por quanto tempo; muda junto com o código.
 */
type Text = { en: string; pt: string }
/** Um item; `link`: uma página do site citada no texto, que vira link no fim dele. */
type Item = Text & { link?: '/mcp' }

interface Section {
  id: string
  title: Text
  items: Item[]
}

/** As seções com o tipo de item explícito (o `link` opcional não some na inferência). */
const sections = (list: Section[]) => list

export const privacy = {
  eyebrow: { en: 'Privacy', pt: 'Privacidade' },
  title: { en: 'What this site records', pt: 'O que este site registra' },
  lede: {
    en: 'This is my personal portfolio. I record what helps me know who visits and how they found me, never your IP address, and I store nothing on your device except the language you pick.',
    pt: 'Este é o meu portfólio pessoal. Registro o que me ajuda a saber quem visita e como chegou aqui, nunca o seu endereço IP, e não guardo nada no seu aparelho além do idioma que você escolher.',
  } satisfies Text,
  controller: {
    en: 'Responsible for the data: Fael Caporali, Belo Horizonte, Brazil · fael@caporali.dev',
    pt: 'Responsável pelos dados: Fael Caporali, Belo Horizonte, Brasil · fael@caporali.dev',
  } satisfies Text,
  sections: sections([
    {
      id: 'visits',
      title: { en: 'Visits, kept for 3 months', pt: 'Visitas, guardadas por 3 meses' },
      items: [
        {
          en: 'The page, the language, the site that sent you here and the campaign tags in the link (utm).',
          pt: 'A página, o idioma, o site que trouxe você até aqui e as marcas de campanha do link (utm).',
        },
        {
          en: 'Country, region, city and the network you are on, as Cloudflare estimates them from the connection. The IP address itself is not saved.',
          pt: 'País, região, cidade e a rede em que você está, como a Cloudflare os estima pela conexão. O endereço IP em si não é gravado.',
        },
        {
          en: 'Whether the page was asked by a person, a search engine or an AI assistant, and the type of device.',
          pt: 'Se a página foi pedida por uma pessoa, por um buscador ou por um assistente de IA, e o tipo de aparelho.',
        },
        {
          en: 'How long the page was on screen and what you did on it, from a fixed list: dragged the bust, picked a life, opened the journey, jumped to the content, downloaded the résumé, opened LinkedIn or GitHub, copied a contact or the MCP address, opened or sent the contact form, clicked an offer, switched languages, filtered the journey.',
          pt: 'Quanto tempo a página ficou na tela e o que você fez nela, de uma lista fechada: arrastou o busto, escolheu uma vida, abriu a trajetória, desceu para o conteúdo, baixou o currículo, abriu o LinkedIn ou o GitHub, copiou um contato ou o endereço do MCP, abriu ou enviou o formulário, clicou numa oferta, trocou o idioma, filtrou a trajetória.',
        },
        {
          en: 'A random code joins the pages of one visit while the tab is open. It lives in memory only and is gone when you close the tab.',
          pt: 'Um código aleatório junta as páginas de uma mesma visita enquanto a aba está aberta. Ele só existe na memória e some quando você fecha a aba.',
        },
        {
          en: 'Cloudflare Web Analytics also counts page views and measures how fast the pages load, with no cookie and without saving the IP; Cloudflare keeps that for 6 months.',
          pt: 'O Web Analytics da Cloudflare também conta as páginas vistas e mede a velocidade de carregamento, sem cookie e sem gravar o IP; a Cloudflare guarda isso por 6 meses.',
        },
      ],
    },
    {
      id: 'contact',
      title: { en: 'Messages, kept for 90 days', pt: 'Mensagens, guardadas por 90 dias' },
      items: [
        {
          en: 'What you write in the contact form (name, how to reach you, message) and your country. It reaches me by e-mail and is deleted after 90 days.',
          pt: 'O que você escreve no formulário de contato (nome, como falar com você, mensagem) e o seu país. Chega a mim por e-mail e é apagado depois de 90 dias.',
        },
        {
          en: 'Calls from AI assistants to the MCP server: what is recorded is on the page about it.',
          pt: 'Chamadas de assistentes de IA ao servidor MCP: o que fica registrado está na página dele.',
          link: '/mcp',
        },
      ],
    },
    {
      id: 'never',
      title: { en: 'Never', pt: 'Nunca' },
      items: [
        {
          en: 'Your IP address, in the records of visits, messages and the MCP. The request logs of this site at Cloudflare, used only to fix errors, include it and are deleted after 3 days.',
          pt: 'O seu endereço IP, nos registros de visitas, de mensagens e do MCP. Os logs de requisição deste site na Cloudflare, usados só para corrigir erros, o incluem e são apagados em 3 dias.',
        },
        {
          en: 'Tracking cookies, tracking across other sites, advertising, selling or sharing data.',
          pt: 'Cookies de rastreamento, rastreamento em outros sites, publicidade, venda ou compartilhamento de dados.',
        },
      ],
    },
    {
      id: 'cookies',
      title: { en: 'Cookies', pt: 'Cookies' },
      items: [
        {
          en: 'Mine: only “lang”, saved when you switch the language yourself, so the site remembers it for a year.',
          pt: 'Meu: só o “lang”, gravado quando você troca o idioma, para o site lembrar a escolha por um ano.',
        },
        {
          en: 'Cloudflare’s: its bot protection may set “__cf_bm” (30 minutes) and “cf_clearance” to tell people from bots. They are needed for the site’s security and are not used for tracking.',
          pt: 'Da Cloudflare: a proteção contra robôs pode gravar o “__cf_bm” (30 minutos) e o “cf_clearance” para distinguir pessoas de robôs. São necessários à segurança do site e não servem para rastrear.',
        },
      ],
    },
    {
      id: 'why',
      title: { en: 'Why, and where', pt: 'Por quê, e onde' },
      items: [
        {
          en: 'To know which pages and offers interest people and where they come from (search engines, AI assistants, links), and to answer messages. Visits are measured on the basis of legitimate interest (LGPD, art. 7, IX, and art. 10); messages are kept to answer you, at your request.',
          pt: 'Para saber quais páginas e ofertas interessam e de onde as pessoas vêm (buscadores, assistentes de IA, links), e para responder às mensagens. As visitas são medidas com base no legítimo interesse (LGPD, art. 7º, IX, e art. 10); as mensagens são guardadas para responder a você, a seu pedido.',
        },
        {
          en: 'Everything runs on Cloudflare, Inc., and may be processed in the United States and in its global network.',
          pt: 'Tudo roda na Cloudflare, Inc., e pode ser tratado nos Estados Unidos e na rede global dela.',
        },
      ],
    },
    {
      id: 'rights',
      title: { en: 'Your rights', pt: 'Seus direitos' },
      items: [
        {
          en: 'Write to fael@caporali.dev to access, correct or delete your data, or to object to the measurement (LGPD, art. 18). Messages are found by your name or contact; visits carry no name or identifier that leads to you, so they cannot be told apart and simply expire after 3 months.',
          pt: 'Escreva para fael@caporali.dev para acessar, corrigir ou apagar os seus dados, ou para se opor à medição (LGPD, art. 18). As mensagens são achadas pelo seu nome ou contato; as visitas não têm nome nem identificador que leve a você, por isso não dá para separá-las, e elas simplesmente expiram em 3 meses.',
        },
      ],
    },
  ]),
  updated: { en: 'Last updated: October 2, 2026', pt: 'Atualizado em 2 de outubro de 2026' } satisfies Text,
}
