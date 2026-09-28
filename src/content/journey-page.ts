/**
 * Texto da página da trajetória (/journey), da origem até hoje. Renderizado para HTML no build (journey.html); nada
 * daqui vai para o JavaScript do navegador.
 * Requisitos do Fael em .wai/trajetoria/REQUISITOS.md: antes da tecnologia, curto e com o porquê de cada vida estar
 * ali; na tecnologia, o resumo como chamariz e os detalhes em "What I did"; a força é a atuação de mercado, não a
 * formação. Fonte de cada fato no comentário da entrada (Lattes, CV 2026-09, falas do Fael).
 */
import type { StageId } from './journey'

export interface Entry {
  /** Vida do herói que começa aqui: vira âncora (/journey#<id>), marco com a frase do herói e a cor da vida. */
  life?: StageId
  /** Período. Ausente quando nenhuma fonte dá o ano. */
  when?: string
  /** Organização ou, sem organização, o assunto da entrada. */
  title: string
  role?: string
  summary: string
  /** O que a vida deixou para o trabalho de hoje (antes da tecnologia). */
  carry?: string
  /** "What I did": abre com um clique. */
  details?: string[]
  stack?: string[]
  link?: { label: string; href: string }
  /** Entrada de passagem, sem destaque (o Uber, por decisão do Fael). */
  minor?: true
}

export interface Chapter {
  id: string
  title: string
  span: string
  entries: Entry[]
}

export const lede =
  'Ten years running my own ventures, then the switch to software in 2023. Every stop below left something I still use.'

export const chapters: Chapter[] = [
  {
    id: 'before-code',
    title: 'Before code',
    span: '2006 – 2022',
    entries: [
      {
        // Lattes (ETFG/SEBRAE-MG 2006–2008); fala do Fael 22/09 (a produtora, o MEI de 2012); Receita e JUCEMG.
        when: '2006 – 2012',
        title: 'First business',
        summary:
          "Business administration at SEBRAE's technical school, then my first company: a music production venture with a friend. He produced, I ran the business. That company became HC Consultorias, my software company.",
      },
      {
        // Lattes (Immersus 2013–2017, Coordenador Financeiro, BI em VBA); HISTORIA empreendedor ("de assistente até
        // coordenador").
        life: 'financeiro',
        when: '2013 – 2017',
        title: 'Immersus Language School',
        role: 'Financial Assistant → Financial Coordinator',
        summary: 'Financial administration, planning with the board, management reports automated in VBA.',
        carry: 'Numbers first, then the decision.',
      },
      {
        // HISTORIA empreendedor, fala do Fael 25/09.
        life: 'empreendedor',
        title: 'Brownies, a confectionery, a hostel',
        summary:
          'Sold brownies on the street, cakes at fairs and guesthouse breakfasts, and opened a hostel near Brumadinho.',
        carry: 'Cost, price and customer, learned face to face.',
      },
      {
        // HISTORIA vela e empreendedor, falas do Fael 25/09; CRAL = Clube de Regatas Afonso Ligório.
        life: 'vela',
        title: 'Sailing: from translator to school owner',
        summary:
          'Hired to translate a sailing course for two British kids, I stayed: instructor, then partner in the school at Lagoa dos Ingleses, then my own, SUP Lagoa Santa. Laser, Snipe, Tahiti 16 and Optimist, students of all ages, until the pandemic stopped everything on the water.',
        carry: 'Teaching, and building a school.',
      },
    ],
  },
  {
    id: 'switch',
    title: 'The switch',
    span: '2020 – 2023',
    entries: [
      {
        // HISTORIA uber, fala do Fael 26/09 ("em BH pelo tempo da transição de carreira", "a lenda dos volantes").
        life: 'uber',
        title: 'Uber, Belo Horizonte',
        summary:
          'Drove to pay the bills while I studied to become a developer. One rider’s review became a nickname: “the legend of the wheel”.',
        carry: 'Resilience, tenacity, and doing everything well.',
        minor: true,
      },
      {
        // Lattes (Trybe 2022–2023, 1500 h; CS50 2022; CTFL 2021–2022; ENAP 2023); ementa da Trybe (4 módulos).
        life: 'fullstack',
        when: '2022 – 2023',
        title: 'Trybe',
        role: 'Full-Stack Web Development',
        summary:
          '1,500 hours, project-based: web fundamentals, front-end, back-end and computer science. Alongside: CS50 (Harvard), CTFL (ISTQB) and data analysis at ENAP.',
      },
      {
        // Fala do Fael 28/09: "logo antes de trabalhar na brickup. utest e em crowdtest.com.br".
        title: 'uTest and Crowdtest',
        role: 'Crowdtester',
        summary: 'Hunting bugs in real products for global and Brazilian clients, right before Brickup.',
      },
    ],
  },
  {
    id: 'building',
    title: 'Building software',
    span: '2023 – today',
    entries: [
      {
        // Lattes (Brickup: Tech Lead, Product Owner e QA; 300 → <100); CV-en (bug smash, PHD Engenharia).
        life: 'qa',
        when: 'Jun 2023 – present',
        title: 'Brickup · construction tech',
        role: 'QA → Tech Lead, Product Owner and QA',
        summary:
          'Joined as QA engineer and built the company’s quality function, then took on scrum master, product owner and, for a period, tech lead of a five-person team.',
        details: [
          'Introduced feature flags (GrowthBook/OpenFeature) and Datadog RUM: open defects went from about 300 to under 100, and the biweekly “bug smash” stopped.',
          'Automated end-to-end tests with Cypress and Cucumber/Gherkin; release gate for the backend.',
          'Ran hiring and trained the QA who took over the role.',
          'Modeled the product’s AI features: construction schedule and budget planning, progress insights and a financial assistant.',
          'Built Prévia, the AI-assisted planner, with two engineers from PHD Engenharia: React/TypeScript monorepo, Expo app, n8n and LangChain agents, CI/CD with quality gates on AWS.',
          'Designed and deployed microservices, including the integrations service (Python/FastAPI on AWS Lambda) with HubSpot, Asaas and Datadog.',
        ],
        stack: ['React', 'TypeScript', 'Expo', 'Python', 'FastAPI', 'AWS Lambda', 'Cypress', 'Datadog'],
      },
      {
        // Lattes (LFF QA e Tech Lead); falas do Fael 09/09 ("em paralelo com brickup"; Dalegig) e 22/09 (onboarding).
        life: 'techlead',
        when: 'Jan – Dec 2025',
        title: 'La Fabrique Flottante · software house',
        role: 'QA Engineer → Tech Lead',
        summary: 'In parallel with Brickup. Started in QA on Beamble; from April, tech lead for the studio’s projects.',
        details: [
          'QA: mobile and web release validation and defect triage for Beamble.',
          'Dalegig, a marketplace for musicians and bookers: built the React web interface and the AI onboarding agent, which talked with newly registered musicians and built their profiles from web search and scraping.',
          'Everywhr, villa bookings with Stripe and Hostaway: restructured the infrastructure and the AI agent, with backend and frontend work.',
        ],
        stack: ['React', 'Node.js', 'n8n', 'Flowise', 'AWS'],
      },
      {
        // Lattes (LFF Tech Lead); fala do Fael 22/09 ("Eu desenhei e implantei toda a arquitetura escalável da
        // beamble").
        life: 'devops',
        when: '2025',
        title: 'Beamble · via La Fabrique Flottante',
        role: 'Solutions architecture',
        summary:
          'Live video shopping for a French client, with iOS and Android apps. Designed and deployed the whole scalable architecture on AWS and led the move from the legacy system to microservices.',
        details: [
          'AWS: ECS, RDS and load balancing through CloudFormation; scheduled jobs on Lambda.',
          'Legacy to microservices: media upload, messaging and scheduled routines as separate services.',
          'Logistics integrations with Uber, UPS and DHL.',
          'Coordinated the Laravel API, React Native app and CRM fronts, working directly with the client.',
        ],
        stack: ['AWS ECS', 'RDS', 'CloudFormation', 'Lambda', 'Node.js', 'Laravel', 'React Native'],
      },
      {
        // JUCEMG (sócio-administrador desde 12/03/2025); Receita (MEI de 2012).
        when: '2025',
        title: 'HC Consultorias e Desenvolvimento de Software',
        role: 'Managing partner',
        summary: 'The company I opened in 2012 became a software company: contract engineering and my own products.',
      },
      {
        // Lattes (Immersus 2025–atual; "Plataforma web para escola de idiomas").
        when: '2025 – present',
        title: 'Immersus Language School',
        role: 'Technical consultant',
        summary:
          'Back at the school, now on the technical side: vendor coordination, the institutional landing page and a web platform with student, teaching and admin areas, a content manager and two-factor authentication.',
        stack: ['Laravel', 'React', 'TypeScript', 'Inertia.js', 'Tailwind CSS'],
      },
      {
        // Lattes (BID; produto "Agente de precificação"); CV-en; fala do Fael 10/09 ("eu assumi trabalho legado").
        when: 'Nov 2025 – Jul 2026',
        title: 'BID Tecnologia',
        role: 'Technical Consultant and Tech Lead',
        summary:
          'Took over a device trade-in and asset management platform spread across earlier versions and five AI-generated apps, and rebuilt it as a single React/TypeScript monorepo.',
        details: [
          'PostgreSQL with row-level security multi-tenancy, Terraform on GCP, CI and automated tests.',
          'Put the warehouse module (receiving, triage, inventory) into operation as an internal tool, integrated with the GestãoClick ERP, WhatsApp, n8n and Telegram.',
          'Built and validated a pricing agent that reads photos of a device, identifies model and parts with a vision language model, checks prices on the web and returns an offer.',
        ],
        stack: ['React', 'TypeScript', 'PostgreSQL', 'Terraform', 'GCP', 'Vitest'],
      },
      {
        // Lattes (Diogenes/MPC: time de 5, RAG, avaliação, tokens, Provimento CNJ 213/2026, "encerrado e transferido").
        life: 'ai',
        when: 'Jan – Sep 2026',
        title: 'Marketing para Cartórios – AI · D-Rocket group',
        role: 'Tech Lead and Full-Stack Engineer',
        summary:
          'Designed and led, with a team of five, a multi-tenant platform of AI agents serving Brazilian notary offices over WhatsApp, in production.',
        details: [
          'RAG knowledge base on PostgreSQL with pgvector, audio transcription, and an internal agent-evaluation tool (scenarios, personas, scoring).',
          'Token-based billing and compliance with CNJ Provision 213/2026.',
          'CI/CD with unit, integration and end-to-end tests; Docker Swarm with Traefik.',
          'Defined stack, pricing and roadmap with the founder, and supported the client’s PO and QA as they grew into their roles. Handed over in September 2026.',
        ],
        stack: ['TypeScript', 'Express', 'tRPC', 'React', 'Prisma', 'pgvector', 'Redis', 'OpenAI', 'Playwright'],
      },
      {
        // Lattes (produção técnica: Triadora, CFTV, mini-games, WAI Framework); mercearia itinerante (2025); CV-en
        // (adapter).
        when: '2025 – 2026',
        title: 'Own products · HC Consultorias',
        summary: 'Products of my own, from the idea to the code.',
        details: [
          'Triadora: AI customer-service agents whose conversation path is an explicit, auditable decision tree; the model only writes the reply. WhatsApp Cloud API, visual flow editor, simulator, spending cap per customer.',
          'CCTV cloud backup: DVR/NVR recorders send video over FTPS to the cloud; queued processing, a video worker, self-service sign-up and a playback dashboard.',
          'Mini-games platform: one shared foundation to launch mini-games and mini-apps on web and mobile.',
          'Mobile grocery management: point of sale, inventory, orders and deliveries for a grocery that sells from a truck in rural France.',
          'WAI Framework: a method for software development assisted by AI agents.',
          'Claude Code CLI adapter: an HTTP server exposing the Anthropic Messages API over the Claude Code CLI.',
        ],
        stack: ['TypeScript', 'Node.js', 'Express', 'tRPC', 'Prisma', 'PostgreSQL', 'React', 'AWS CDK'],
      },
      {
        // Este repositório; docs/PIPELINE-3D.md.
        when: '2026',
        title: 'This portfolio',
        summary:
          'A 3D bust built from code-driven Blender recipes, nine lives in one hero, served by a single Cloudflare Worker.',
        link: { label: 'View source on GitHub', href: 'https://github.com/FaelCaporali/portfolio' },
      },
    ],
  },
]
