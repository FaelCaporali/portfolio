<!-- Técnica do efeito de desintegração, 14/09/2026. URLs a revalidar antes de citar publicamente. -->

# Efeito "Desaparatar" (Harry Potter) — Three.js r180 + R3F v9: Pesquisa e Recomendação

## 1. Abordagens pesquisadas

### A) Dissolve por shader no mesh + partículas de borda

O tutorial da [Codrops (fev/2025)](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/) injeta lógica via `onBeforeCompile`, substituindo o `#include <dithering_fragment>`. Uniforms: `uProgress` (threshold 0→1), `uEdge` (largura da borda), `uFreq`/`uAmp` (frequência/amplitude do ruído Perlin `cnoise`), `uEdgeColor`. Lógica central:

```glsl
if (noise < uProgress) discard;
float edgeWidth = uProgress + uEdge;
if (noise > uProgress && noise < edgeWidth) {
  gl_FragColor = vec4(vec3(uEdgeColor), noise);
}
```

As partículas reusam a mesma geometria/ruído e só sobrevivem na faixa `[uProgress, uProgress+uEdge]`, dando a ilusão de emissão exatamente na frente de dissolução. Existe também a variante WebGPU/TSL mais recente — [Codrops "Gommage Effect" (jan/2026)](https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/) — que dissolve texto MSDF em poeira via TSL, útil como referência de porte para WebGPU futuro, mas não necessária agora.

### B) Particle morph via MeshSurfaceSampler + GPGPU

[MeshSurfaceSampler](https://threejs.org/docs/#examples/en/math/MeshSurfaceSampler) amostra N pontos na superfície de um mesh (posição, normal, cor via UV), permitindo gerar duas nuvens de pontos-alvo (config A e B) com a mesma contagem de partículas. Para animar A→B em GPU, o padrão estabelecido é **GPUComputationRenderer** com ping-pong de FBOs: um par de render targets alterna papéis frame a frame — enquanto um é lido, a simulação escreve no outro ([Codrops GPGPU tutorial, dez/2024](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/); [Barradeau "FBO particles"](https://barradeau.com/blog/?p=621)). O Three.js Journey tem duas aulas diretamente aplicáveis: [Particles Morphing Shader](https://threejs-journey.com/lessons/particles-morphing-shader) (troca de formas via atributos de posição alvo) e [GPGPU Flow Field Particles](https://threejs-journey.com/lessons/gpgpu-flow-field-particles-shaders) (campo de velocidade em textura).

### C) Points vs InstancedMesh vs GPUComputationRenderer vs TSL/WebGPU

- **Points**: menor custo por partícula (1 vértice, sem geometria extra), ideal para >50k partículas; limitação: sem profundidade de "volume" real, billboard só via `PointsMaterial`/shader customizado, sorting problemático com transparência.
- **InstancedMesh**: cada partícula é uma malha real (pode ter espessura/normal), mas o custo por-instância é maior; discussões no fórum three.js indicam ~16k instâncias com geometria simples como referência de bom desempenho ([fórum three.js](https://discourse.threejs.org/t/better-performance-instanced-mesh-or-points/20293)); acima disso GPU-side compute compensa.
- **GPUComputationRenderer (WebGL)**: atualização de posição/velocidade 100% na GPU via ping-pong textures — relatos de até ~800k partículas a 60fps em desktop com updates via fragment shader, contra ~450k em CPU ([comparação de técnicas de rendering de partículas](https://www.diva-portal.org/smash/get/diva2:1480568/FULLTEXT01.pdf)). É a opção certa quando o dataset de posições (A e B) precisa ser interpolado/deformado por vórtice em massa.
- **TSL/WebGPURenderer**: three.js r180 confirma WebGPU "production-ready" desde r171 (set/2025), import direto `three/webgpu` sem config, fallback automático para WebGL2 em browsers antigos ([release r180](https://github.com/mrdoob/three.js/releases/tag/r180); [Utsubo "What's New 2026"](https://www.utsubo.com/blog/threejs-2026-what-changed)). Ainda assim, ecossistema R3F (drei, postprocessing) é majoritariamente WebGL-first; migrar todo o pipeline para TSL agora é risco desnecessário para uma feature pontual.

### D) Carregamento GLB, variantes de mesh e shape keys em R3F v9 / drei v10

`useGLTF` (drei) carrega com Draco (`useDraco`) e mesh optimization habilitados por padrão; KTX2 via `extendLoader` (configurando `KTX2Loader` no `GLTFLoader`). Meshes nomeadas (cabelo_A, cabelo_B, roupa_casual, roupa_gala, etc.) ficam disponíveis em `nodes`, e visibilidade se alterna com `mesh.visible = bool` num efeito React (não JSX condicional, para evitar remontagem/perda de estado). Shape keys (morph targets) são lidas em `mesh.morphTargetInfluences[i]`, tipicamente tuneladas via GSAP (`gsap.to(mesh.morphTargetInfluences, {0: 1, duration: ...})`) dentro de uma timeline mestre que também controla o progress do shader de dissolução — padrão descrito em [Wawa Sensei — Dissolve Effect](https://wawasensei.dev/tuto/react-three-fiber-tutorial-dissolve-effect) e nas discussões de [scroll+GSAP em R3F](https://dev.to/wawasensei/scroll-animations-with-react-three-fiber-and-gsap-273j).

R3F v9 (confirmado via [GitHub releases](https://github.com/pmndrs/react-three-fiber/releases) e [v9 Migration Guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)): suporte React 19.0–19.2 (reconciler bundlado para compatibilidade), uniforms de `ShaderMaterial` agora com referência estável (permite `uniforms-uProgress-value={progress}` direto no JSX), StrictMode mais rigoroso (pode expor bugs de efeitos duplicados — testar). drei v10 acompanha essa base; `useFBO` (cria/descarta `WebGLRenderTarget` automaticamente) e `Environment`/`ContactShadows` confirmados via Context7 (`/pmndrs/drei`) sem mudanças de API quebrando o padrão v9.

### E) Iluminação e custo mobile

`<Environment files="busto.hdr" />` (self-hosted, nunca usar `preset=` em produção — depende de CDN externo) + tone mapping ACES + `<ContactShadows frames={1} />` para congelar a sombra quando o busto está estático (recalcula só ao animar). Em mobile: preferir Sky/ambient simples a HDR pesado, desligar `receiveShadow` em objetos sem nada por cima, e não usar `shadow-mapSize` alto. Fontes: [drei Environment docs](http://drei.docs.pmnd.rs/staging/environment), [Codrops "Efficient Three.js Scenes" (fev/2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/).

## 2. Tabela comparativa

| Abordagem                                | Fidelidade visual                                           | Custo GPU                               | Complexidade impl.                   | Escala mobile                       |
| ---------------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------ | ----------------------------------- |
| Dissolve-only (shader no mesh)           | Alta no mesh, mas sem "furacão" real de partículas migrando | Baixo                                   | Baixa                                | Excelente                           |
| Points + CPU update                      | Média (sem espessura)                                       | Médio (limitado ~10-20k mobile)         | Baixa/Média                          | Boa com cap                         |
| InstancedMesh partículas                 | Alta (partículas volumétricas)                              | Alto por partícula                      | Média                                | Ruim acima de ~5-8k mobile          |
| GPUComputationRenderer (WebGL) ping-pong | Alta, controle total de física                              | Baixo por partícula, alto fixo (2x FBO) | Alta                                 | Boa com contagem escalada por tier  |
| TSL/WebGPURenderer                       | Máxima, futuro-proof                                        | Baixo (compute shaders nativos)         | Muito alta (ecossistema R3F imaturo) | Depende de suporte WebGPU do device |

## 3. Recomendação de arquitetura

**Dissolve shader no busto (efeito "queima" local) + GPGPU Points para o furacão de partículas em GLSL/WebGL clássico**, orquestrado por uma timeline GSAP única. Não migrar para TSL/WebGPU agora — ganho marginal, risco alto (drei/postprocessing ainda não 100% TSL-first).

### Pipeline

**No Blender:**

1. Um único rig de busto com meshes separadas nomeadas por variante (`hair_short`, `hair_long`, `outfit_casual`, `outfit_formal`, `accessory_glasses`, …) todas sharing o mesmo skeleton/origem.
2. Shape keys de expressão no mesh de rosto (`smile`, `neutral`, `surprised`).
3. Export GLB único com Draco (posição/normal) e KTX2 (texturas), UV1 dedicado para o ruído de dissolução se quiser controle artístico por região (em vez de UV padrão).
4. Bake de um low-poly proxy (~5-8k tris) apenas para o **sampling de partículas** (não para render) — acelera `MeshSurfaceSampler` e reduz jitter em mobile.

**No código (R3F v9 + drei v10):**

1. `useGLTF('/busto.glb', true /*draco*/, true, (loader) => configurar KTX2Loader)`.
2. Alternar variantes: efeito React que seta `mesh.visible` (nunca desmonta) para trocar cabelo/roupa antes da "reaparatação".
3. Fase de dissolução (0→0.5 do progress): material do busto com `onBeforeCompile` injetando threshold+edge glow (seção A). Timeline GSAP anima `uProgress` 0→1 e, em paralelo, `morphTargetInfluences` do rosto para a expressão-alvo.
4. Partículas: pré-computar N pontos via `MeshSurfaceSampler` sobre o proxy nas duas configurações (A = atual, B = configuração final), armazenados em texturas de posição (RGBAFloat) do tamanho `sqrt(N) x sqrt(N)`.
5. `GPUComputationRenderer` com 2 variáveis: `positionTexture` e `velocityTexture`. Vertex/fragment de simulação aplica o campo de vórtice (pseudo-código abaixo), interpolando entre "explodir de A" (progress 0→0.5) e "convergir para B" (progress 0.5→1), com curl noise sobreposto para textura orgânica.
6. Render das partículas como `Points` com `ShaderMaterial` (billboard simples, soft-additive blending), lendo a textura de posição do FBO no vertex shader via `texture2D`.
7. Sincronização: uma única `gsap.timeline()` mestre controla `uProgress` do mesh, `uProgress`/`uSpin` das partículas e o crossfade de visibilidade das variantes de mesh no meio da timeline (quando as partículas cobrem o busto).

### Pseudo-código GLSL — vértice do "tornado" (parametrizado por `progress` 0→1)

```glsl
uniform float uProgress;   // 0 = forma A intacta, 1 = forma B recomposta
uniform float uTime;
uniform sampler2D uPositionA; // textura com posições amostradas na config A
uniform sampler2D uPositionB; // textura com posições amostradas na config B

// curl noise (baseado em simplex 3D — ver Bitangent Noise / Cyanilux)
vec3 curlNoise(vec3 p);

void main() {
  vec2 uv = uvFromParticleIndex(); // mapeamento index->texel
  vec3 posA = texture2D(uPositionA, uv).xyz;
  vec3 posB = texture2D(uPositionB, uv).xyz;

  // fase de desintegração (0 -> 0.5) e recomposição (0.5 -> 1)
  float phase = smoothstep(0.0, 0.5, uProgress);       // sobe
  float recompose = smoothstep(0.5, 1.0, uProgress);   // desce

  // altura de subida em espiral (efeito "sugado para cima")
  float height = mix(0.0, 3.0, phase) * (1.0 - recompose);

  // espiral: ângulo cresce com altura e com progress, raio decai perto do topo
  float angle = uTime * 2.0 + height * 4.0 + uv.x * 6.2831;
  float radius = mix(0.0, 0.6, sin(phase * 3.14159)) * (1.0 - recompose * 0.3);

  vec3 spiral = vec3(cos(angle) * radius, height, sin(angle) * radius);

  // curl noise para textura orgânica (vórtice não perfeitamente circular)
  vec3 curl = curlNoise(posA * 0.5 + vec3(0.0, uTime * 0.3, 0.0)) * 0.4 * phase;

  vec3 basePos = mix(posA + spiral + curl, posB, recompose);

  vec4 mvPosition = modelViewMatrix * vec4(basePos, 1.0);
  gl_PointSize = mix(4.0, 1.5, recompose) * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
```

## 4. Estratégia de degradação (dpr/GPU tier)

Usar [`detect-gpu`](https://github.com/pmndrs/detect-gpu) (`getGPUTier()`) para classificar em tier 0-3 (fps benchmark normalizado por resolução). Mapeamento sugerido:

- Tier 3 (desktop bom): 60-80k partículas, `dpr=[1,2]`, sombras de contato ativas, HDR completo.
- Tier 2 (notebook médio/mobile alto): 20-30k partículas, `dpr=[1,1.5]`, sombra estática (`frames=1`).
- Tier 1 (mobile médio): 6-10k partículas, sem contact shadow, ambient light simples em vez de HDR.
- Tier 0 (fallback): crossfade de opacidade simples (sem partículas), apenas dissolve no mesh.

Combinar com `window.devicePixelRatio` cap e `PerformanceMonitor` (drei) para downscale dinâmico em runtime se fps cair.

## 5. Riscos conhecidos

- **Transparência/sorting**: `Points` com blending aditivo não precisa de depth-sort, mas se houver partículas opacas ou com alpha-test, a ordem de desenho entre mesh dissolvendo e partículas pode causar artefatos — renderizar partículas em camada separada (`renderOrder`) e desabilitar `depthWrite` nelas.
- **Mobile precision `highp`**: iOS/Adreno mais antigos às vezes não suportam `highp` em fragment shader por padrão — forçar `precision highp float;` explícito e testar em dispositivo real; texturas de posição em `FloatType` podem não ter suporte completo em GPUs mobile antigas (fallback para `HalfFloatType`).
- **Memória de FBO**: duas variáveis (posição+velocidade) x double-buffer = 4 render targets `FloatType` — para 256x256 (65k partículas) isso já é ~4MB x algumas, controlável, mas cresce rápido se aumentar resolução da textura sem necessidade real de contagem de partículas.
- **Sincronização de timelines**: GSAP + `useFrame` competindo pelo mesmo clock pode gerar dessincronia sutil — usar `gsap.ticker` unificado com o loop do R3F (`invalidate()` em modo `frameloop="demand"` se quiser economizar bateria fora da animação).
- **Ecossistema TSL/WebGPU ainda imaturo no R3F**: drei/postprocessing não têm paridade total, então evitar essa rota agora conforme já indicado.

## Referências abertas

- https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/
- https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/
- https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/
- https://tympanus.net/codrops/2021/08/31/surface-sampling-in-three-js/
- https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/
- https://threejs-journey.com/lessons/particles-morphing-shader
- https://threejs-journey.com/lessons/gpgpu-flow-field-particles-shaders
- https://threejs-journey.com/lessons/fireworks-shaders
- https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/
- https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- https://barradeau.com/blog/?p=621
- https://threejs.org/docs/#examples/en/math/MeshSurfaceSampler
- https://www.cyanilux.com/tutorials/tornado-shader-breakdown/
- https://atyuwen.github.io/posts/bitangent-noise/
- https://github.com/mrdoob/three.js/releases/tag/r180
- https://www.utsubo.com/blog/threejs-2026-what-changed
- https://www.utsubo.com/blog/webgpu-threejs-migration-guide
- https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide
- https://github.com/pmndrs/react-three-fiber/releases
- http://drei.docs.pmnd.rs/staging/environment
- https://wawasensei.dev/tuto/react-three-fiber-tutorial-dissolve-effect
- https://github.com/pmndrs/detect-gpu
- https://discourse.threejs.org/t/better-performance-instanced-mesh-or-points/20293
- https://www.diva-portal.org/smash/get/diva2:1480568/FULLTEXT01.pdf
