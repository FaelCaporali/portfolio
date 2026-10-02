/**
 * O texto da página /mcp (e /pt/mcp): como conectar o assistente de IA ao servidor MCP do portfólio (worker/mcp/),
 * o que ele pode fazer e o que fica registrado. Direção em .wai/mcp/04-direcao-mcp.md (P2, D-MCP15); os passos de
 * cada cliente saem das páginas oficiais, lidas em 01/10/2026 (.wai/mcp/03-conexao-fontes.md), e cada painel leva o
 * link delas: os menus mudam. Sem React, para o teste do Worker conferir as ferramentas contra o servidor.
 */
import type { Lang } from '../../shared/i18n'
import { MCP_URL } from '../../shared/mcp'

type Text = Record<Lang, string>

/** O nome curto do servidor nos exemplos de configuração (o cliente aceita qualquer um). */
const SERVER = 'fael'

/** Um passo: texto corrido com os nomes de menu em `**negrito**` (McpPage os marca com <strong>). */
interface Client {
  name: string
  /** Em que plano dá para usar. */
  plans: Text
  steps: Record<Lang, string[]>
  source: string
}

/** Um bloco de código: o rótulo (o terminal ou o arquivo) e o texto que o botão copia. */
interface Snippet {
  name: string
  label: string
  code: string
}

/** O JSON de configuração com o endereço, no formato de cada cliente. */
const json = (value: unknown) => JSON.stringify(value, null, 2)

export const mcp = {
  address: MCP_URL,
  /** O endereço quebrado só depois do ponto (04 §2.4): o hífen de "fael-caporali" nunca quebra. */
  addressParts: ['https://fael-caporali.', MCP_URL.slice('https://fael-caporali.'.length)] as const,
  /** O ícone fixo da home (D-MCP16): o rótulo da pílula e o nome do link; a seta vai só no visível. */
  fab: { en: 'Connect your AI assistant', pt: 'Conecte o seu assistente de IA' },
  /** A forma completa na primeira menção (política de marcas da LF Projects), com a sigla que o resto usa. */
  eyebrow: { en: 'Model Context Protocol (MCP)', pt: 'Model Context Protocol (MCP)' },
  title: { en: 'Ask your AI assistant about my work', pt: 'Pergunte sobre o meu trabalho ao seu assistente de IA' },
  lede: {
    en: 'Connect Claude, ChatGPT or any MCP client to the address below. Your assistant reads what this site shows (profile, the full journey with its filters, what I have delivered), answers with links to the page and can send me a message when you ask.',
    pt: 'Conecte o Claude, o ChatGPT ou qualquer cliente MCP ao endereço abaixo. O seu assistente lê o que este site mostra (perfil, a trajetória completa com os filtros, o que eu entreguei), responde com o link da página e pode me mandar uma mensagem quando você pedir.',
  },
  addressLabel: { en: 'Server address', pt: 'Endereço do servidor' },
  copy: {
    address: { en: 'Copy address', pt: 'Copiar endereço' },
    code: { en: 'Copy', pt: 'Copiar' },
    copied: { en: 'Copied', pt: 'Copiado' },
  },
  /** O endereço da barra do navegador não serve (Bot Fight Mode na zona, D-MCP11). */
  addressNote: {
    en: 'Use this address, not the one in your browser bar: assistants connect through this one.',
    pt: 'Use este endereço, não o da barra do navegador: os assistentes se conectam por este.',
  },
  asks: {
    title: { en: 'For example', pt: 'Por exemplo' },
    items: [
      {
        q: {
          en: 'Has Fael shipped AI agents to production? Where is the proof?',
          pt: 'O Fael já colocou agentes de IA em produção? Onde está a prova?',
        },
        tools: ['get_profile', 'search_journey'],
      },
      {
        q: {
          en: 'Which projects used n8n or LangGraph, and in which years?',
          pt: 'Em quais projetos ele usou n8n ou LangGraph, e em que anos?',
        },
        tools: ['search_journey'],
      },
      {
        q: {
          en: 'Tell Fael I would like to talk about a role on my team.',
          pt: 'Avise o Fael que eu quero conversar sobre uma vaga no meu time.',
        },
        tools: ['beacon', 'send_message'],
      },
    ],
  },
  clients: {
    title: { en: 'Add it to Claude or ChatGPT', pt: 'Adicione no Claude ou no ChatGPT' },
    source: { en: 'Official guide', pt: 'Guia oficial' },
    items: [
      {
        name: 'Claude',
        plans: {
          en: 'Web, desktop and mobile apps, on every plan (one custom connector on Free). On Team and Enterprise, an admin adds it first in Organization settings › Connectors.',
          pt: 'Na web, no app de computador e no celular, em todos os planos (um conector personalizado no gratuito). No Team e no Enterprise, um administrador o adiciona antes em Organization settings › Connectors.',
        },
        steps: {
          en: [
            'Open **Customize › Connectors** and click **Add custom connector**.',
            'Paste the server address. If asked about authentication, choose **No sign-in**.',
            'Click **Add**.',
            'In a chat, open **+ › Connectors** and turn it on.',
          ],
          pt: [
            'Abra **Customize › Connectors** e clique em **Add custom connector**.',
            'Cole o endereço do servidor. Se pedir autenticação, escolha **No sign-in**.',
            'Clique em **Add**.',
            'Numa conversa, abra **+ › Connectors** e ligue o conector.',
          ],
        },
        source: 'https://claude.com/docs/connectors/custom/remote-mcp',
      },
      {
        name: 'ChatGPT',
        plans: {
          en: 'On the web, with developer mode (Plus, Pro, Business, Enterprise and Edu).',
          pt: 'Na web, com o modo de desenvolvedor (Plus, Pro, Business, Enterprise e Edu).',
        },
        steps: {
          en: [
            'Open **Settings › Security and login** and turn on **Developer mode**.',
            'In **Plugins**, click **+** and create an app with the server address and no authentication.',
            'Messages and the interest signal ask for your confirmation before they go.',
          ],
          pt: [
            'Abra **Settings › Security and login** e ligue o **Developer mode**.',
            'Em **Plugins**, clique em **+** e crie um app com o endereço do servidor, sem autenticação.',
            'Mensagem e sinal de interesse pedem a sua confirmação antes de sair.',
          ],
        },
        source: 'https://developers.openai.com/api/docs/guides/developer-mode',
      },
    ] satisfies Client[],
  },
  others: {
    title: { en: 'Other clients', pt: 'Outros clientes' },
    text: {
      en: 'Any MCP client that connects by address works. The three most common:',
      pt: 'Qualquer cliente MCP que conecta por endereço funciona. Os três mais comuns:',
    },
    items: [
      {
        name: 'Claude Code',
        label: 'Terminal',
        code: `claude mcp add --transport http ${SERVER} ${MCP_URL}`,
      },
      {
        name: 'Cursor',
        label: '~/.cursor/mcp.json',
        code: json({ mcpServers: { [SERVER]: { url: MCP_URL } } }),
      },
      {
        name: 'VS Code',
        label: '.vscode/mcp.json',
        code: json({ servers: { [SERVER]: { type: 'http', url: MCP_URL } } }),
      },
    ] satisfies Snippet[],
  },
  tools: {
    title: { en: 'What your assistant can do', pt: 'O que o seu assistente pode fazer' },
    items: [
      {
        name: 'get_profile',
        text: {
          en: 'Who I am, what I can be hired for (with proof), contacts, links and résumés.',
          pt: 'Quem eu sou, para o que posso ser contratado (com prova), contatos, links e currículos.',
        },
      },
      {
        name: 'list_filters',
        text: {
          en: 'Every stack item, concept and skill in the journey, with how many steps cite it.',
          pt: 'Cada item de stack, conceito e habilidade da trajetória, com quantos marcos o citam.',
        },
      },
      {
        name: 'search_journey',
        text: {
          en: 'Finds journey steps by stack, concepts, skills, years and text, with the link to the filtered page.',
          pt: 'Acha marcos da trajetória por stack, conceitos, habilidades, anos e texto, com o link da página filtrada.',
        },
      },
      {
        name: 'get_checkpoint',
        text: { en: 'One step of the journey in full.', pt: 'Um marco da trajetória inteiro.' },
      },
      {
        name: 'get_delivered',
        text: {
          en: 'What I have delivered, my main stack and the common questions.',
          pt: 'O que eu entreguei, a minha stack principal e as perguntas frequentes.',
        },
      },
      {
        name: 'send_message',
        text: {
          en: 'Sends me a message through the same channel as the form on this site, only when you ask for it.',
          pt: 'Me manda uma mensagem pelo mesmo caminho do formulário deste site, só quando você pede.',
        },
      },
      {
        name: 'beacon',
        text: {
          en: 'Lets me know someone is interested, with no personal data needed. Your assistant is told to check with you before adding a name or contact, and to tell you it went.',
          pt: 'Me avisa que alguém se interessou, sem precisar de dado pessoal. O seu assistente é orientado a perguntar antes de incluir nome ou contato e a contar que enviou.',
        },
      },
    ],
  },
  log: {
    title: { en: 'What gets recorded', pt: 'O que fica registrado' },
    recorded: { en: 'Recorded for 90 days', pt: 'Registrado por 90 dias' },
    never: { en: 'Never recorded', pt: 'Nunca registrado' },
    items: [
      {
        en: 'Date and time, the tool and what was asked, the assistant’s name and version, the network and the country.',
        pt: 'Data e hora, a ferramenta e o que foi pedido, o nome e a versão do assistente, a rede e o país.',
      },
      {
        en: 'E-mails and phone numbers typed in a search are masked before they are saved.',
        pt: 'E-mails e telefones digitados numa busca são mascarados antes de gravar.',
      },
      {
        en: 'What goes in the interest signal (role, company, note), names included, reaches me by e-mail and stays in the record.',
        pt: 'O que vai no sinal de interesse (cargo, empresa, nota), nomes incluídos, chega a mim por e-mail e fica no registro.',
      },
      {
        en: 'A message is kept like one sent through the form on this site.',
        pt: 'A mensagem fica guardada como a enviada pelo formulário deste site.',
      },
    ] satisfies Text[],
    neverItems: [
      { en: 'Your IP address.', pt: 'O seu endereço IP.' },
      {
        en: 'Your conversation with your assistant: only the tool calls reach this server.',
        pt: 'A sua conversa com o assistente: só as chamadas de ferramenta chegam a este servidor.',
      },
    ] satisfies Text[],
  },
}
