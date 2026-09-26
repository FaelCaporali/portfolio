"""Renders e folha (≤ 1568 px) da vida `uber` v1: argila e material na câmera do 1440, rosto 2× com volante, mãos e
lágrimas, lágrima 4×, pegada rotulada (prop_uber_prova_pegada), pele da mão × bochecha em 4× lado a lado, celular
2×. Os renders de material simulam o degradê do site."""
import os
import subprocess

import bpy
import numpy as np

import comum
import prop_financeiro_v6 as v6
import prop_vela_prova_olho as olho
from prop_vela_prova import render_cycles


def _borda(cx, W=1440, H=900):
    x0, y0, x1, y1 = cx
    return (max(0, x0 / W), min(1, x1 / W), max(0, 1 - y1 / H), min(1, 1 - y0 / H))


def renders(busto, g, pasta, med):
    j = lambda n: os.path.join(pasta, n)                                         # noqa: E731
    pele = list(busto.malhas.values())
    pecas = [o for v in g.values() for o in v]
    sc = bpy.context.scene
    cam = comum.camera_site('1440x900', escala=1)
    comum.render_argila(j('argila-1440.png'), pecas + pele)
    bpy.data.objects.remove(cam)
    import prop_uber_prova_pegada as PP
    PP.simular_fade()                                   # degradê do site (Fade do adereço, neckFade do busto)
    olho.estudio()
    for k, (arq, esc, cx) in enumerate((('material-1440.png', 1, (0, 0, 1440, 900)),)):
        cam = comum.camera_site('1440x900', escala=esc)
        olho.estudio()
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = 1440 * esc, 900 * esc
        sc.cycles.samples = 48
        render_cycles(j(arq), pecas + pele, _borda(cx))
        bpy.data.objects.remove(cam)
    c = med['caixas_px']['1440x900']
    m, cel = c['maos'], c['celular']
    for arq, esc, cx, vis in (('rosto-2x.png', 2, (m[0] - 10, c['busto'][1] + 120, m[2] + 10, 900), pecas + pele),
                              ('celular-2x.png', 2, (cel[0] - 12, cel[1] - 12, min(cel[2] + 12, 1440), cel[3] + 12),
                               pecas + pele),
                              ('lagrima-4x.png', 4, (910, 340, 1110, 520), pecas + pele)):
        cam = comum.camera_site('1440x900', escala=esc)
        olho.estudio()
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = 1440 * esc, 900 * esc
        sc.cycles.samples = 64
        render_cycles(j(arq), vis, _borda(cx))
        bpy.data.objects.remove(cam)
    import prop_uber_prova_pegada as PP
    PP.vistas(g, None, pasta)
    # mão isolada em 3/4 com material (Cycles), esquerda do Fael, com o aro
    esq = [o for o in g['maos'] if 'esq' in o.name]
    pts = [o.matrix_world @ o.data.vertices[i].co for o in esq for i in range(0, len(o.data.vertices), 7)]
    alvo = sum(pts, pts[0] * 0) / len(pts)
    olho.estudio()
    sc.camera = None
    sc.render.resolution_x, sc.render.resolution_y = 560, 560
    sc.cycles.samples = 96
    v6.only({o.name for o in g['maos'] + g['volante']})
    v6.camera_on(alvo, 0.40, -35, 22, lens=85)
    sc.render.filepath = j('mao-34-material.png')
    bpy.ops.render.render(write_still=True)
    # pele lado a lado em 4× (câmera do 1440): recorte do dorso (mão da direita da tela) e da bochecha
    mk = olho._img(j('_de-mascara.png'))
    cams = []
    for canal in (0, 1):
        sel = (mk[..., canal] > 0.5) & (mk[..., 1 - canal] < 0.5) & (mk[..., 2] < 0.5)
        sel[:, :sel.shape[1] * 2 // 3 if canal == 0 else 0] = False
        ys, xs = np.nonzero(sel)
        cams.append((int(np.median(xs)) / 2, int(np.median(ys)) / 2))       # máscara em 2× → px do 1440
    for (x, y), nome in zip(cams, ('_pele-mao.png', '_pele-bochecha.png')):
        cam = comum.camera_site('1440x900', escala=4)
        olho.estudio()
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = 1440 * 4, 900 * 4
        sc.cycles.samples = 96
        render_cycles(j(nome), pecas + pele, _borda((x - 40, y - 40, x + 40, y + 40)))
        bpy.data.objects.remove(cam)
    subprocess.run(['convert', j('_pele-mao.png'), j('_pele-bochecha.png'), '+append', j('pele-4x.png')], check=True)


def montar(pasta, med):
    j = lambda n: os.path.join(pasta, n)                                         # noqa: E731
    run = lambda *a: subprocess.run(['convert', *a], check=True)                # noqa: E731
    run(j('material-1440.png'), '-resize', '780x', j('argila-1440.png'), '-resize', '780x', '+append', j('_l1.png'))
    run(j('rosto-2x.png'), '-resize', 'x520', j('lagrima-4x.png'), '-resize', 'x520', '+append', j('_l2.png'))
    run(j('pegada.png'), '-resize', '1000x', j('_l3.png'))
    run(j('pele-4x.png'), '-resize', 'x320', j('mao-34-material.png'), '-resize', 'x320', j('celular-2x.png'),
        '-resize', 'x320', '+append', j('_l4.png'))
    de, r = med['deltaE'], med['respiro_aro_labio_1440']
    fd = med['folga_dedos_aro_mm']
    fb = med['folga_busto_mm']['triste']
    txt = ('dE2000 mediana px %s (medias %s) | dedos x aro mm esq %s..%s dir %s..%s | busto mm vol %s '
           'maos %s cel %s | respiro aro-labio %s px' % (
               de['dE2000_pixel_mediana'], de['dE2000_medias'], min(fd['esq'].values()), max(fd['esq'].values()),
               min(fd['dir'].values()), max(fd['dir'].values()), fb['volante'], fb['maos'], fb['celular'],
               r['respiro_px']))
    run(j('_l1.png'), j('_l2.png'), j('_l3.png'), j('_l4.png'), '-background', '#111', '-gravity', 'center',
        '-append', '-resize', '1560x>', '-gravity', 'north', '-splice', '0x28', '-fill', '#eee', '-pointsize', '16',
        '-annotate', '+0+5', txt, j('folha-v1.png'))
    print('FOLHA', j('folha-v1.png'))
