# Pipeline 3D — do scan ao herói do site

O herói mostra o busto do Fael e, a cada vida, um adereço animado. Tudo em 3D sai de **receitas reprodutíveis**: scripts
Python rodando no Blender 4.5 sem interface (`blender -b --python …`). Nada é modelado à mão e salvo sem receita: apagar
a saída e rodar de novo dá o mesmo arquivo. Custo zero (Blender, gltf-transform, meshoptimizer, Playwright).

```
fotos do celular ─▶ scan ─▶ escultura por receita (S07 → S13) ─▶ busto-s13.glb ─┐
                                                                               ├─▶ otimizar.mjs ─▶ 3d/export/ ─▶ site
receita do adereço (3d/tools/prop_<vida>*.py) ─▶ <vida>.glb ───────────────────┘   (meshopt)      (import ?url)
                                                     │
                                  provas no site real (portões, volta, colisão, CSP)
```

## 1. Busto

Scan fotogramétrico do rosto, depois uma cadeia de receitas que esculpe sobre ele, medindo contra as fotos (MediaPipe e
OpenCV) em cada passo. O busto entregue é o S13: cerca de 47 mil vértices no glb, 10 expressões (morphs no padrão
ARKit, como `mouthSmileLeft`, `browInnerUp`), pele em WebP. Detalhes, fontes e comandos em [3d/README.md](../3d/README.md).

Regras do busto: o arquivo abre no rosto neutro; nenhuma expressão entra sem passar no portão de expressões
(`3d/tools/r_exprgate.py`); nenhuma entrega sem as folhas de conferência pela câmera das fotos.

## 2. Adereços (um por vida)

| Vida            | Receita (`3d/tools/`)   | Saída (`3d/export/props/`)                 | Componente (`src/features/hero/scene/props/`) |
| --------------- | ----------------------- | ------------------------------------------ | --------------------------------------------- |
| Financeiro      | `props/financeiro/`     | `financeiro.glb`, `financeiro_direita.glb` | `ledger/`                                     |
| Empreendedor    | `prop_empreendedor*.py` | `empreendedor.glb`                         | `empreendedor/`                               |
| Vela            | `prop_vela*.py`         | `vela.glb`                                 | `vela/`                                       |
| Uber            | `prop_uber*.py`         | `uber.glb`                                 | `uber/`                                       |
| Fullstack       | `prop_fullstack*.py`    | `fullstack.glb`                            | `fullstack/`                                  |
| QA              | `prop_qa*.py`           | `qa.glb`                                   | `qa/`                                         |
| Solutions Arch. | `prop_devops*.py`       | `devops.glb`                               | `devops/`                                     |
| Tech Lead       | `prop_techlead*.py`     | `techlead.glb`                             | `techlead/`                                   |
| AI Product Eng. | `prop_ai*.py`           | `ai.glb`                                   | `ai/`                                         |

Cada receita monta a cena com o **mesmo busto do site** como referência e a **mesma câmera do site** nas três telas
(`3d/tools/props/camera-site.json`, gerada do próprio site). Assim o que se vê no Blender é o que o visitante vê.
Utilitários comuns em `3d/tools/props/comum.py` (espaços glTF ↔ Blender, câmera, render de argila e silhueta).

Divisão de trabalho entre arquivo e código: forma, materiais, texturas e animações que não dependem do visitante vão no
glb; o que reage ao relógio do carrossel, ao ponteiro ou ao arrasto é procedural no componente da vida.

## 3. Exportação para a web

`node 3d/tools/props/otimizar.mjs <entrada.glb> [saída.glb]` é o passo final de todo glb:

- compressão **meshopt** (`EXT_meshopt_compression`) e quantização (`KHR_mesh_quantization`), **sem Draco**: o
  decodificador do Draco vem de um CDN externo, que a CSP do site bloqueia; o do meshopt já está no bundle;
- relê a saída e compara o inventário (nós, malhas, skins, clipes, materiais, vértices, imagens, morfos); se algo mudou,
  não grava;
- `--webp=<imagem>=<arquivo>` troca a textura por WebP; `--malha-em-filho` preserva o pivô de nós que o site gira (olhos).

Leitura de um glb: `node 3d/tools/props/glb.mjs <arquivo>`. Erro de quantização contra o original:
`3d/tools/props/erro_quantizacao.mjs`.

Tamanhos de hoje: busto 1,2 MB; adereços de 66 KB a 338 KB. O site importa cada glb com `?url` (o Vite copia com hash
no nome) e carrega com `useGLTF` do drei, com pré-carga.

## 4. Provas (no site real, não no Blender)

Todas rodam contra o servidor de dev com Playwright e renderização por software, nas telas 1440×900, 1024×768 e 360×740.

| Ferramenta (`3d/tools/props/`) | O que prova                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `portoes.mjs`                  | silhueta, tamanho em tela, peça contra a cena e orçamento do arquivo                         |
| `volta_prop.mjs`               | a volta inteira da vida quadro a quadro: nada sobre texto ou borda, olhos e boca livres      |
| `colisao_orq.mjs`              | folga mínima entre o adereço e o busto (mais o que está vestido) em várias poses do ponteiro |
| `prova_csp.mjs`                | build de produção com os cabeçalhos reais: zero violação de CSP, zero requisição externa     |
| `verifica.mjs`                 | toda entrega tem os arquivos que declara, escritos na execução                               |

Uma vida só entra no site depois de passar nessas provas e de ser aprovada pelo Fael.

## 5. O que fica fora do git

Scans brutos, fotos da captura, iterações intermediárias, renders de processo e caches. A lista de permissão está no
`.gitignore` da raiz.
