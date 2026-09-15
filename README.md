# portfolio-3d — versionamento do busto

Cada iteração do modelo é um commit. Nada é sobrescrito sem commit anterior; homologação do Fael a cada iteração.

- `scans/<data>/kiri-NN/` — exportações brutas do KIRI Engine (OBJ + textura), intocadas.
- `referencias/` — fotos de referência (atuais e de outras épocas).
- `renders/` — folhas de contato geradas no Blender headless para homologação.
- `blend/` — arquivos .blend por iteração (`busto-vNN.blend`).
- `export/` — glTF por iteração.

Avaliação 2026-09-15 dos scans KIRI (Photo Scan, 36 fotos, cadeira giratória, luz de teto):
- kiri-01: melhor rosto (testa, têmporas, nariz, olhos); lado direito e nuca deformados; 51k faces.
- kiri-02: rosto achatado, cabelo virou bloco; 117k faces; torso bom.
- kiri-03: corpo inteiro; rosto ruim; 43k faces.
Nenhum serve inteiro. Plano: reconstruir localmente (Meshroom) a partir das fotos originais e usar kiri-01 como referência/fallback de rosto.
