# Pipeline 3D — scan da cabeça e props no Blender

Objetivo: um busto seu (`head.glb`) e um prop por etapa da jornada (`props/<id>.glb`),
carregados pelo Three.js no hero. Este documento é o contrato entre o que sai do Blender
e o que o código espera.

## 1. Captura e reconstrução (100% gratuito)

Celular: **Poco X5 (Xiaomi, Android, sem LiDAR)**. Sem app pago. FaceBuilder (KeenTools) foi
descartado: é pago após 15 dias de teste.

### Duas rotas em paralelo, fica a melhor

| Rota                                | Onde processa              | Custo                        | Observação                                                                 |
| ----------------------------------- | -------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| ~~RealityScan Mobile~~              | —                          | —                            | **Incompatível com o Poco X5** (verificado na Play Store em 2026-09-14).   |
| KIRI Engine 4.0 (plano Basic)       | nuvem, app Android 7+      | grátis, exportação ilimitada | Até 150 fotos por scan no Basic. Exporta OBJ/FBX/GLTF/STL direto do app.   |
| Meshroom 2025.1.0 (AliceVision 3.3) | local, CUDA 12 na RTX 3050 | grátis                       | Instalado localmente (2026-09-15). `meshroom_batch -i <fotos> -o <saída>`. |

Ordem: KIRI Engine é a rota principal (60–80 fotos bastam para um busto). Meshroom entra como terceira via quando houver disco.
Fontes verificadas em 2026-09-14: release do Meshroom no GitHub, realityscan.com, kiriengine.app/pricing.

### Câmera do Poco X5

- Use o app **Open Camera** (grátis, F-Droid/Play) ou o modo **Pro** da câmera nativa.
- Trave ISO (100–200), velocidade (≥ 1/125 s), foco (manual, no rosto) e balanço de branco. Nada pode mudar entre fotos.
- Resolução máxima da câmera principal (48 MP), sem HDR, sem filtro de beleza, sem zoom.
- Formato JPG qualidade máxima. Se o app oferecer RAW, JPG basta.

### Sessão de fotos

1. Outra pessoa fotografa. Você fica sentado, imóvel, expressão neutra, olhos abertos, boca fechada. Piscou ou mexeu, refaz a órbita.
2. Luz difusa e uniforme: dia nublado perto de janela grande, ou duas luzes brancas iguais dos dois lados. Sem sol direto, sem flash, sem sombra dura.
3. Fundo fosco sem padrão. Sem óculos. Cabelo ajeitado para trás (o cabelo será refeito no Blender de qualquer forma). Camisa lisa escura.
4. 100 a 150 fotos em três órbitas completas: altura dos olhos, ~30° acima, ~20° abaixo. Passo de ~8° entre fotos, sobreposição de 70%.
5. Distância constante de 60–80 cm. Inclua a cabeça inteira, pescoço e topo dos ombros em todas as fotos.
6. Extra: 10 fotos de detalhe (orelhas, nuca, queixo por baixo) mantendo a mesma exposição.
7. Cópia das fotos para esta máquina (`3d/captura/2026-xx-xx/`) para a rota Meshroom.

### Referência para expressões e variantes

Fotos adicionais, mesma luz: sorriso, choro (cara de choro), foco/concentração, surpresa; de frente e 3/4. Servem de referência para esculpir as shape keys. Fotos das tatuagens em alta resolução, planas, para virar decal.

## 2. Blender — limpeza do busto

1. Importe o scan. `Ctrl+A` → Apply All Transforms.
2. Corte o busto: Edit Mode, selecione tudo abaixo da linha do peito e delete; feche o buraco com `F` ou `Alt+F`. Alternativa: modifier Boolean com um cubo.
3. Remova ilhas soltas: Edit Mode, `Select → Select All by Trait → Loose Geometry` e delete; depois `Mesh → Clean Up → Merge by Distance`.
4. Sculpt Mode com brush Smooth (força baixa) apenas nas regiões ruidosas (cabelo, orelhas). Não suavize olhos, nariz e boca.
5. Topologia limpa: `Object → Quick Effects`/modifier **Remesh (QuadriFlow)** com ~20 mil faces, ou Decimate se a malha já estiver boa. Topologia limpa é o que permite shape keys e decal de tatuagem. Cabelo do scan é descartado e refeito (mesh escultural ou cartões).
6. Textura: se o scan trouxe várias texturas, faça UV unwrap (`Smart UV Project`) e bake da cor (Diffuse, só Color) em uma imagem de 2048×2048. Salve como JPG qualidade 85.
   6b. Shape keys: Basis + choro, sorriso, foco, surpresa, esculpidas em Sculpt Mode com as fotos de referência.
7. Material: Principled BSDF, Base Color = textura baked, Roughness ~0.6, Metallic 0. Nada de nós especiais; o exportador glTF só entende Principled.
8. Origem: `Object → Set Origin → Origin to Geometry`, depois mova para que a base do busto fique em Z=0 e o centro em X=0, Y=0.
9. Escala: 1 unidade do Blender = 1 metro. A cabeça deve ter ~0,25 m de altura; o busto inteiro ~0,45 m.
10. Rosto olhando para −Y no Blender (frente padrão). O exportador converte para +Z no glTF.

## 3. Blender — props por etapa

Um arquivo por etapa. Ids e sugestões de objeto (a decisão final é sua):

| id             | Slot                      | Prop sugerido                                         |
| -------------- | ------------------------- | ----------------------------------------------------- |
| `financeiro`   | administrador financeiro  | calculadora, gravata ou planilha flutuando            |
| `empreendedor` | empreendedor              | prancha de SUP, cupcake, chave de hostel              |
| `vela`         | professor de barco a vela | boné de marinheiro na cabeça, mini veleiro            |
| `uber`         | Motorista de uber         | volante, lágrimas (duas gotas azuis saindo dos olhos) |
| `qa`           | QA tester                 | lupa, inseto (bug) pousado na testa                   |
| `fullstack`    | Fullstack dev             | óculos, chaves `{ }` e `< />` orbitando               |
| `techlead`     | TechLead                  | apito, headset, ou pequenos cubos-pessoas ao redor    |
| `cto`          | FDE CTO                   | capacete de obra? mapa/rota? (a confirmar com Fael)   |
| `ai`           | AI Software developer     | nós e arestas de rede neural orbitando, chip          |

Regras:

- Low-poly estilizado. Alvo de 500 a 3 mil triângulos por prop. Cores chapadas (material sem textura) ou uma textura pequena de 512px.
- Origem de cada prop no ponto onde ele encosta na cabeça (boné: origem na base do boné). Props "orbitando" ficam com origem no próprio centro; a órbita é feita em código.
- Todos os props no mesmo arquivo `.blend`, um por Collection, com a cabeça de referência visível para acertar escala e posição. Exportar uma Collection por vez.
- Nomeie os objetos dentro do arquivo (`Boné`, `Veleiro`). O código encontra por nome se precisar animar peças separadas.
- Animações simples (gota caindo, bug andando) podem ser feitas em Blender e exportadas como Actions no glTF; nomeie a Action com o mesmo id do prop.

## 4. Exportação glTF

`File → Export → glTF 2.0`:

- Format: glTF Binary (.glb)
- Include: Selected Objects (ou a Collection ativa)
- Transform: +Y Up (padrão)
- Mesh: Apply Modifiers ✔, UVs ✔, Normals ✔, Vertex Colors só se usou
- Material: Export, Images: JPEG para o busto, Automatic para props
- Compression: Draco ✔, level 6, quantization padrão
- Animation: ✔ só se o prop tiver Action

Orçamento de tamanho (com Draco): `head.glb` ≤ 3 MB, cada prop ≤ 300 KB.

## 5. Onde colocar

```
public/models/head.glb
public/models/props/financeiro.glb
public/models/props/empreendedor.glb
...
```

Posição, rotação, escala e animação de cada prop no hero ficam em `src/content/journey.ts`.
Enquanto os `.glb` não existirem, o site usa um placeholder gerado da foto do currículo.
