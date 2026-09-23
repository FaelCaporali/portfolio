<!-- Benchmark de design, 14/09/2026. URLs a revalidar antes de citar publicamente. -->

# Benchmark: Portfólios de altíssimo nível (2023–2026)

## 1. 3D / avatar / busto do autor (3+)

**1. Bruno Simon — bruno-simon.com** | Autor: Bruno Simon (Immersive Garden) | 2019, atualização c/ devlogs até 2025 | Awwwards Site of the Month (jan/2026), Portfolio Honors (dez/2025), FWA.

- Faz bem: carro dirigível como metáfora de navegação, mundo Blender coeso, som espacializado por objeto.
- Tech: Three.js (com TSL/WebGPU na atualização recente), Blender, Cannon.js física.
- Roubar isso: transformar a navegação do site em uma mecânica jogável em vez de scroll — cria retenção que nenhum menu consegue.

**2. Jordan Breton — jordan-breton.com** | Freelance fullstack/creative dev | 2025 | FWA Site of the Day (2 out 2025).

- Faz bem: ilha flutuante com câmera por pontos fixos (grama, cachoeira, fogo, borboletas) — dosagem cinematográfica sem exigir controle de jogo.
- Tech: Three.js, shaders custom, provavelmente GSAP para as transições de câmera.
- Roubar isso: navegação por "pontos fixos" em vez de free-cam dá espetáculo 3D sem sacrificar legibilidade/UX.

**3. Thibault Introvigne — thibault-introvigne.com** | Dev criativo | 2024-25 | listado em curadoria Three.js.

- Faz bem: personagem "espaçonauta" controlável coletando itens — narrativa de jornada literal (viagem espacial = carreira).
- Tech: Three.js, física simples, provavelmente R3F.
- Roubar isso: usar a metáfora do avatar coletando "conquistas" (certificações, empresas) como progressão de scroll.

**4. Jay Ransijn — jayransijn.com** | Dev independente | 2024-25.

- Faz bem: mundo jogável completo (passear com cachorro, andar de bike, procurar carro escondido) — Easter eggs recompensam exploração.
- Tech: Three.js, reflexos/lighting customizados.
- Roubar isso: um Easter egg escondido (ex.: velejar um barquinho) reforça a bio pessoal sem virar gimmick central.

## 2. Tipografia cinética / word-swap hero (3+)

**5. Mat Voyce — matvoyce.tv** (redesign por Uncommon Studio) | 2025 | Awwwards SOTD + indicado GSAP Site of the Year 2025.

- Faz bem: letras esticam e recombinam no scroll, sistema de escala dinâmica que ajusta proporção do texto ao viewport.
- Tech: GSAP (timelines), React Three Fiber para offload de render, Canvas/WebGL para efeitos pesados, FreezeFrame.js.
- Roubar isso: tratar a tipografia como elemento físico deformável (stretch/squash) casa bem com narrativa "de QA a tech lead" — a palavra literalmente muda de forma.

**6. Erika Moreira — portfolio (Behance/Awwwards)** | Bruno Arizio & Luis Bizarro | SOTD 7.6.

- Faz bem: hero com loading typography animation + microinterações SVG-mask no hover, tipografia serifada elegante.
- Tech: GSAP, Webpack, Express.
- Roubar isso: usar o preloader como primeira palavra que se "resolve" letra a letra — dá tempo pro asset 3D carregar sem tela em branco.

**7. Aristide Benoist — aristidebenoist.com** | Dev independente (motion/interação) | múltiplas edições 2017-2024 | Awwwards Honorable Mention, FWA, One Page Love.

- Faz bem: kinetic type combinada com navegação não-linear e imagens de projeto, tudo com sensação artesanal (não parece template).
- Tech: GSAP/animação JS custom, sem framework 3D pesado.
- Roubar isso: navegação lateral/circular em vez de scroll vertical padrão separa o portfólio dos "mais um scroll longo".

**8. By-Kin — by-kin.com** | Estúdio | 2025-26 | Awwwards SOTD, Developer Award, FWA, CSSDA.

- Faz bem: "tipografia editorial confiante" com scroll suave pesado e transições que "nunca chamam atenção para si mesmas" — restraint como diferencial.
- Tech: Next.js, GSAP, Strapi.
- Roubar isso: quando a transição é boa o suficiente, ela é invisível — parar de perseguir "uau" e perseguir fluidez.

## 3. Partículas / dissolve / tornado WebGL (3+)

**9. Codrops — "Implementing a Dissolve Effect with Shaders and Particles in Three.js"** (tutorial, fev/2025) — tympanus.net/codrops/2025/02/17/...

- Faz bem: converte malha em nuvem de pontos que se desintegra com shader material customizado.
- Tech: Three.js, GLSL custom, Points/BufferGeometry.
- Roubar isso: usar o dissolve exatamente na transição entre seções "quem fui" → "quem sou" (ex-empreendedor se desintegrando em tech lead).

**10. Codrops — "WebGPU Gommage Effect: Dissolving MSDF Text into Dust and Petals with Three.js & TSL"** (jan/2026).

- Faz bem: texto MSDF se dissolve em poeira + pétalas com bloom seletivo — tipografia e partícula na mesma peça.
- Tech: WebGPU, TSL (Three Shading Language), MSDF font rendering, bloom pass.
- Roubar isso: aplicar esse efeito ao próprio nome no hero — a marca pessoal se desmancha e remonta como transição de carregamento.

**11. Codrops — "Crafting a Dreamy Particle Effect with Three.js and GPGPU"** (dez/2024).

- Faz bem: GPGPU permite milhares de partículas com física em tempo real sem travar a CPU.
- Tech: Three.js, GPGPU (compute em textura), shaders.
- Roubar isso: usar um campo de partículas ambiente sutil no fundo do hero (não centro das atenções) para dar profundidade sem competir com o texto.

## 4. Portfólios sóbrios premium sem 3D (3+)

**12. Uncommon Studio — uncommonstudio.com.au** | Estúdio australiano | Awwwards SOTD + Developer Award + FWA.

- Faz bem: grid rítmico com "quebras confiantes", transições tipo câmera sem WebGL pesado.
- Tech: GSAP, grid/CSS avançado.
- Roubar isso: ritmo visual definido por grid rigoroso é o que substitui o "uau" do 3D quando se quer sobriedade.

**13. Minh Pham — minhpham.design** | Designer (Vietnã) | Awwwards SOTD, score dev 7.77.

- Faz bem: contrasta duas narrativas (formal vs. honesta) na mesma landing — ótimo modelo para "multi-hat" (empreendedor/QA/tech lead/IA).
- Tech: GSAP + Three.js/WebGL usado com moderação (framing, não espetáculo).
- Roubar isso: uma dualidade explícita no hero ("o que o recrutador vê" vs. "o que eu realmente sou") é um gancho de copy fácil de portar.

**14. Huy Phan — huyml.co (Vol. 1 e 2)** | Art director independente (Ho Chi Minh) | 13x Awwwards SOTD, FWA of the Day, 4 indicações Independent of the Year.

- Faz bem: identidade visual reconhecível ano após ano — o portfólio muda mas a assinatura tipográfica/cor permanece.
- Tech: animação/micro-interação custom, branding forte, pouco 3D.
- Roubar isso: manter uma paleta e uma fonte de assinatura estáveis entre reformulações constrói reconhecimento de marca pessoal.

**15. Gionatan Nese '26 — gionatannese.com** | Designer/dev | Awwwards SOTD (5 set 2026) + Developer Award.

- Faz bem: toda imagem vira círculo reativo ao mouse mantendo aparência de "filme"; paleta preto e branco, scroll infinito.
- Tech: GSAP, Three.js, WebGL — mas aplicado a poucos elementos, não ao layout inteiro.
- Roubar isso: um único micro-efeito reaproveitado consistentemente (o círculo) rende mais que cinco efeitos diferentes e desconexos.

---

## Padrões que se repetem nos vencedores

1. **Grid rigoroso por baixo do caos aparente** — mesmo os 3D mais "soltos" (Jordan Breton, Bruno Simon) mantêm hierarquia de texto em grid clássico nas seções de apoio.
2. **Tipografia em duas escalas extremas** — display gigante (view-height) no hero + corpo de texto pequeno/denso nas seções "sobre"/"experiência"; quase nunca há tamanho médio.
3. **Paleta escura dominante com 1 acento vivo** — preto/cinza-escuro de fundo, um accent color saturado (roxo, âmbar) usado só no highlight/CTA.
4. **Cursor custom com propósito, não decoração** — vira lupa, label de projeto ou luz pontual (spotlight sobre avatar 3D); nunca é só um ponto redondo genérico.
5. **Preloader que carrega a narrativa, não só a barra de %** — texto se resolve/desintegra enquanto assets 3D carregam (Erika Moreira, Codrops dissolve).
6. **Scroll suave (Lenis/GSAP ScrollSmoother) universal** — sem exceção nos vencedores 2024-26; virou tabela-stakes, não diferencial.
7. **3D como moldura, não como conteúdo** — nos vencedores maduros (Minh Pham, Gionatan Nese) o WebGL orna 10-20% da tela; o texto/copy carrega a mensagem.
8. **Mobile vira modo "estático elegante"** — a maioria desliga a cena 3D pesada em telas pequenas e substitui por imagem/gradient estático + a mesma tipografia cinética simplificada (menos partículas, mesmo ritmo).
9. **Seção "sobre" sempre com prova social/dado concreto** — número (anos, projetos, prêmios) perto do texto, nunca só adjetivo.
10. **Transição de seção = a peça de assinatura, repetida** — um efeito (círculo, dissolve, stretch de letra) reaparece em cada transição de scroll, criando "sotaque" reconhecível em vez de galeria de efeitos soltos.

## Anti-padrões (o que os feios fazem)

- Cena 3D pesada carregando 8s+ sem preloader informativo — usuário assume que quebrou.
- Texto pequeno sobre fundo 3D movimentado, sem overlay/contraste — ilegível, falha WCAG.
- Cursor custom que esconde o cursor nativo sem oferecer nada (nem hover state) — perda pura de affordance.
- Parallax em profundidade excessiva em mobile, causando jank/scroll-jacking que trava o thumb do usuário.
- Seção "projetos" que é só logo + nome sem contexto de problema/solução — recrutador não entende o trabalho.
- Efeitos diferentes em cada seção sem fio condutor — vira demo-reel de biblioteca JS, não portfólio de uma pessoa.
- Menu/nav escondido atrás de "descubra clicando" — obriga o recrutador a caçar informação básica (contato, CV).

---

Sources:

- [Bruno's Portfolio Case Study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- [Bruno Simon](https://bruno-simon.com/)
- [Best Three.js Websites & Portfolio Examples (2026)](https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025)
- [Jordan's Portofolio - The FWA](https://thefwa.com/cases/jordans-portofolio)
- [Jordan Breton](https://jordan-breton.com/)
- [Best Three.js Websites | Web Design Inspiration](https://www.awwwards.com/websites/three-js/)
- [Case Study: Mat Voyce](https://www.awwwards.com/case-study-mat-voyce-designing-a-digital-home-for-a-kinetic-creative.html)
- [Hero typography loading animation - Erika Moreira Portfolio](https://www.awwwards.com/inspiration/hero-typography-loading-animation-erika-moreira-portfolio)
- [Erika Moreira — Portfolio - Awwwards SOTD](https://www.awwwards.com/sites/erika-moreira-portfolio)
- [Aristide Benoist — Independent developer](https://aristidebenoist.com/)
- [Aristide Benoist - Awwwards Honorable Mention](https://www.awwwards.com/sites/aristide-benoist)
- [10 Best Award-Winning Websites of 2026 (Judged by a Juror)](https://www.hontran.dev/blog/best-award-winning-websites-2026)
- [Implementing a Dissolve Effect with Shaders and Particles in Three.js | Codrops](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/)
- [WebGPU Gommage Effect: Dissolving MSDF Text into Dust and Petals with Three.js & TSL | Codrops](https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/)
- [Crafting a Dreamy Particle Effect with Three.js and GPGPU | Codrops](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/)
- [Minh Pham - Designer - Awwwards SOTD](https://www.awwwards.com/sites/minh-pham-designer)
- [Huy Phan - Awwwards](https://www.awwwards.com/huyml/)
- [Designer Spotlight: Huy Phan | Codrops](https://tympanus.net/codrops/2025/03/21/designer-spotlight-huy-phan/)
- [Gionatan Nese '26 - Awwwards SOTD](https://www.awwwards.com/sites/gionatan-nese-26)
