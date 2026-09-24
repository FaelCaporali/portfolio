"""Simulador de poses no Blender (modelador): a peça e o busto girados no pivô do site, máscaras na câmera do site.

Reproduz `captura_prop.mjs poses` sem o navegador, para procurar âncora/giro/escala em segundos por candidato; o
veredito continua sendo a captura no site. Pivô e ângulos lidos do código (tracedecay, 24/09): `Bust.tsx` pivô
(0; 0,05; −0,13), rotação Euler (−headUp, headRight, 0); `drag.ts` ±38° e 0,35 rad; `gaze.ts` 0,16/0,08 rad no canto,
centro do busto em 0,7 da largura no layout largo (`BUST_SHIFT` 0,2), 0,5 no estreito.
`--seguir=k` gira a peça só k × o giro da cabeça (hipótese de integração, não é o site de hoje).

Uso: `blender -b --python 3d/tools/props/financeiro/poses_sim.py -- <pasta> <rótulo> [--ancora=x,y,z] [--giro=g]
[--escala=s] [--sem-moedas] [--seguir=k] [--telas=1440x900,360x740] [--png]` → `<pasta>/<rótulo>-sim.json`.
"""

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import blockout  # noqa: E402
import blockout_cli  # noqa: E402
import comum  # noqa: E402

PIVO = (0.0, 0.05, -0.13)
A38 = math.radians(38)


def poses(tela):
    """(nome, guinada, arfagem) como o site chega a eles no modo poses de captura_prop.mjs."""
    largo = tela != '360x740'
    dir_ = (1 - (0.7 if largo else 0.5)) * 2 * 0.16
    return [('repouso', 0, 0), ('olhar-sup-esq', -0.16, 0.08), ('olhar-sup-dir', dir_, 0.08),
            ('olhar-inf-esq', -0.16, -0.08), ('olhar-inf-dir', dir_, -0.08),
            ('arrasto-esq', -A38, 0), ('arrasto-dir', A38, 0), ('arrasto-cima', 0, 0.35)]


def _giro(guinada, arfagem):
    """Rotação do grupo da cabeça no Blender: glTF Euler XYZ (−arfagem, guinada, 0) → X do Blender e Z do Blender."""
    return Matrix.Rotation(-arfagem, 4, 'X') @ Matrix.Rotation(guinada, 4, 'Z')


def _pivo(nome, objs):
    p = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(p)
    p.matrix_world = Matrix.Translation(comum.gl_para_bl(PIVO))
    for o in objs:
        mw = o.matrix_world.copy()
        o.parent = p
        o.matrix_parent_inverse = p.matrix_world.inverted()
        o.matrix_world = mw
    return p


def _mascara(caminho):
    img = bpy.data.images.load(caminho)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, 0]
    bpy.data.images.remove(img)
    return a


def _borda(m):
    e = m.copy()
    e[1:, :] &= m[:-1, :]
    e[:-1, :] &= m[1:, :]
    e[:, 1:] &= m[:, :-1]
    e[:, :-1] &= m[:, 1:]
    return m & ~e


def _folga(p, b, lim=40):
    """Distância (px, até lim) entre a peça e a cabeça por dilatação."""
    d = b.copy()
    for k in range(lim + 1):
        if (d & p).any():
            return k
        n = d.copy()
        n[1:, :] |= d[:-1, :]
        n[:-1, :] |= d[1:, :]
        n[:, 1:] |= d[:, :-1]
        n[:, :-1] |= d[:, 1:]
        d = n
    return lim


def medir(pasta, rotulo, tela, nome, pecas, busto, png):
    base = os.path.join(pasta, 'sim', f'{rotulo}-{tela}-{nome}')
    comum.render_silhueta(base + '-p.png', pecas)
    comum.render_silhueta(base + '-b.png', busto)
    comum.render_silhueta(base + '-pb.png', pecas, busto)
    p, b, vis = (_mascara(base + s) < 0.3 for s in ('-p.png', '-b.png', '-pb.png'))
    if not png:
        for s in ('-p.png', '-b.png'):
            os.remove(base + s)
    n = int(p.sum())
    ys, xs = np.nonzero(p)
    h, w = p.shape
    bd = _borda(p)
    return {
        'px': n, 'oculta': round(1 - vis.sum() / max(n, 1), 3),
        'sobreCabeca': round(float((vis & b).sum()) / max(n, 1), 3),
        'contorno': round(float((bd & b).sum()) / max(int(bd.sum()), 1), 3),
        'folga': _folga(p, b) if n else None,
        'caixa': ([int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
                  if n else None),
        'margemDir': int(w - 1 - xs.max()) if n else None, 'margemTopo': int(ys.min()) if n else None,
        'cortada': bool(n and (xs.max() >= w - 1 or xs.min() <= 0 or ys.min() <= 0 or ys.max() >= h - 1)),
    }


def main():
    pos, opc = blockout_cli._args()
    blockout_cli.ajustar(blockout, opc)
    pasta, rotulo = os.path.join(comum.RAIZ, pos[0]), pos[1]
    os.makedirs(os.path.join(pasta, 'sim'), exist_ok=True)
    k = float(opc.get('seguir', 1.0))
    telas = opc.get('telas', '1440x900,1024x768,360x740').split(',')
    comum.cena_nova()
    tudo = comum.importar_busto()
    busto = [o for o in tudo if o.type == 'MESH']
    pecas = blockout.construir()
    bpy.context.view_layer.update()  # matrix_world da raiz recém-criada só existe depois da avaliação
    cab = _pivo('pivo_cabeca', [o for o in tudo if o.parent is None])
    pec = _pivo('pivo_peca', [bpy.data.objects['financeiro']])
    cands = [{}]
    if 'candidatos' in opc:
        with open(os.path.join(comum.RAIZ, opc['candidatos']), encoding='utf-8') as f:
            cands = json.load(f)
    raiz, todos = bpy.data.objects['financeiro'], []
    for i, c in enumerate(cands):
        anc, giro = c.get('ancora', blockout.ANCORA_GLB), c.get('giro', blockout.GIRO_Y)
        esc, kc = c.get('escala', blockout.ESCALA), c.get('seguir', k)
        bat = c.get('batente')  # [guinada, arfagem] máximas da peça (rad): segue o olhar, não o arrasto
        raiz.location, raiz.scale = comum.gl_para_bl(anc), (esc,) * 3
        raiz.rotation_euler = (0, 0, math.radians(giro))
        out = {'ancora': anc, 'giro': giro, 'escala': esc, 'seguir': kc, 'batente': bat}
        rot = rotulo if len(cands) == 1 else f'{rotulo}{i:02d}'
        for tela in telas:
            comum.camera_site(tela, escala=1)
            for nome, gy, ga in poses(tela):
                cab.matrix_world = Matrix.Translation(comum.gl_para_bl(PIVO)) @ _giro(gy, ga)
                py, pa = gy * kc, ga * kc
                if bat:
                    py, pa = max(-bat[0], min(bat[0], py)), max(-bat[1], min(bat[1], pa))
                pec.matrix_world = Matrix.Translation(comum.gl_para_bl(PIVO)) @ _giro(py, pa)
                bpy.context.view_layer.update()
                out[f'{tela}/{nome}'] = medir(pasta, rot, tela, nome, pecas, busto, 'png' in opc)
        todos.append(out)
        print('SIM', rot, resumo(out))
    with open(os.path.join(pasta, f'{rotulo}-sim.json'), 'w', encoding='utf-8') as f:
        json.dump(todos if len(todos) > 1 else todos[0], f, indent=1)


def resumo(o, cab=539):
    """Linha curta do 1440: repouso, pior olhar, arrastos."""
    g = lambda n: o.get(f'1440x900/{n}') or {}  # noqa: E731
    r, e, d = g('repouso'), g('arrasto-esq'), g('arrasto-dir')
    olh = max((g(n).get('contorno', 0) for n in ('olhar-sup-esq', 'olhar-inf-esq', 'olhar-sup-dir', 'olhar-inf-dir')),
              default=0)
    return (f"H {max(r['caixa'][2:]) / cab:.2f} | rep folga {r['folga']} mDir {r['margemDir']} cont {r['contorno']} | "
            f"olhar cont {olh} | esq sobre {e['sobreCabeca']} cont {e['contorno']} | "
            f"dir mDir {d['margemDir']} oculta {d['oculta']} cortada {d['cortada']}")


if __name__ == '__main__':
    main()
