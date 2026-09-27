"""Renders rotulados e folha (≤ 1568 px) da vida `techlead` v1: FRENTE (câmera do site 1440, material e argila),
LATERAL do lado do microfone (esquerda do Fael, +X), LATERAL do outro lado (direita do Fael, −X), DE CIMA, DE TRÁS,
CLOSE da boca sorrindo com a cápsula (câmera do site, 4×, contorno medido dos lábios) e DETALHE da concha E. Cada vista
com o rótulo de lado e a folga numérica que ela prova (medidas.json)."""
import os
import subprocess

import bpy
from mathutils import Vector

import comum
import prop_techlead_geo as G
from prop_fullstack_prova_folha import _borda, _cam, _render, _rotular

CENTRO = (0.0, 0.19, -0.10)                     # centro da cabeça (glb), alvo das vistas ortográficas


def piores(med):
    """Pior caso em todas as poses (mm): folga mínima (dos dois sentidos) por malha e penetração máxima."""
    out = {}
    for pose in med['folga_mm'].values():
        for k, v in pose.items():
            f = min(v['min_mm'], v['pele_a_malha_mm']) if v['dentro'] == 0 else v['min_mm']
            o = out.setdefault(k, {'folga_mm': 9e9, 'penetracao_mm': 0.0})
            o['folga_mm'] = min(o['folga_mm'], f)
            o['penetracao_mm'] = max(o['penetracao_mm'], v['penetracao_max_mm'])
    return out


def _orto(nome, desl, orto, res=(700, 700)):
    alvo = G.bl(CENTRO)
    return _cam(nome, alvo + G.bl(desl), alvo, orto=orto, res=res)


def renders(ctx, pasta, med):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    busto, ms = ctx['busto'], ctx['malhas']
    pele = list(busto.malhas.values())
    pecas = list(ms.values())
    pc = piores(med)
    b14 = med['boca_px']['1440x900']
    fmt = lambda k: '%.1f mm' % pc[k]['folga_mm']                               # noqa: E731
    import prop_vela_prova_olho as olho
    olho.estudio()                            # estúdio da v6 uma vez (luzes nas direções do site), antes das câmeras
    # FRENTE, câmera do site 1440 (recorte = caixa medida da cabeça com o headset, + 24 px)
    from prop_financeiro_direita_prova import caixa_px
    cam = comum.camera_site('1440x900', escala=1)
    bpy.context.view_layer.update()
    x0, y0, x1, y1 = caixa_px(cam, pecas + [busto.pele], 5)
    bpy.data.objects.remove(cam)
    xc, meia = (x0 + x1) / 2, max((x1 - x0) / 2 + 24, 440)      # largura mínima: o rótulo cabe
    cx = (max(0, xc - meia), max(0, y0 - 24), min(1440, xc + meia), min(900, y1 + 24))
    for arq, cyc in (('frente-material.png', True), ('frente-argila.png', False)):
        cam = comum.camera_site('1440x900', escala=1)
        _render(j(arq), pecas + pele, False, cyc, _borda(cx, 1440, 900), amostras=64)
        bpy.data.objects.remove(cam)
    s = b14['sorriso']
    _rotular(j('frente-material.png'), 'FRENTE - câmera do site 1440 (material)',
             'esquerda da imagem = direita do Fael | microfone na ESQUERDA do Fael (+X, direita da imagem)',
             'headset sobre a boca: %d px (neutra) / %d px (sorriso) | cápsula a %.0f px da boca sorrindo' % (
                 b14['neutra']['px_sobre_boca'], s['px_sobre_boca'], s['dist_min_capsula_px']))
    _rotular(j('frente-argila.png'), 'FRENTE - argila (câmera do site 1440)',
             'arco no topo: folga %s | conchas: penetração máx. %.1f / %.1f mm (D / E)' % (
                 fmt('tl_arco'), pc['tl_concha_d']['penetracao_mm'], pc['tl_concha_e']['penetracao_mm']))
    vistas = (('lateral-E.png', (0.9, 0, 0), 'LATERAL - ESQUERDA do Fael (+X), lado do microfone; rosto à esquerda',
               'haste × bochecha %s | cápsula × pele %s (pior pose)' % (fmt('tl_haste'), fmt('tl_mic'))),
              ('lateral-D.png', (-0.9, 0, 0), 'LATERAL - DIREITA do Fael (-X); rosto à direita',
               'concha D: penetração máx. %.1f mm, compressão da espuma %.1f mm' % (
                   pc['tl_concha_d']['penetracao_mm'], ctx['conchas'][-1]['compressao_mm'])),
              ('cima.png', (0, 0.9, 0.0001), 'DE CIMA - topo da imagem = rosto',
               'direita da imagem = DIREITA do Fael (-X) | arco × cabelo %s' % fmt('tl_arco')),
              ('tras.png', (0, 0.02, -0.9), 'DE TRÁS - esquerda da imagem = esquerda do Fael (+X)',
               'cabo × pele %s | cabo visível na câmera do site: %d px' % (
                   fmt('tl_cabo'), med['boca_px']['1440x900']['cabo_visivel_px'])))
    for arq, desl, t1, t2 in vistas:
        cam = _orto('Cam_' + arq, desl, 0.40)
        _render(j(arq), pecas + pele, False, True, amostras=48)
        bpy.data.objects.remove(cam)
        _rotular(j(arq), t1, t2)
    close(ctx, pasta, med, pecas, pele)
    detalhe(ctx, pasta, pecas)
    montar(pasta, med, pc)


def close(ctx, pasta, med, pecas, pele):
    """Boca sorrindo (sorriso inteiro) com a cápsula: câmera do site 1440 a 4×, contorno medido dos lábios."""
    s = med['boca_px']['1440x900']['sorriso']
    bx, cp = s['boca_px'], s['capsula_px']
    m = 40
    x0, y0 = min(bx[0], cp[0]) - m, min(bx[1], cp[1]) - m
    x1, y1 = max(bx[2], cp[2]) + m, max(bx[3], cp[3]) + m
    ctx['busto'].pose(mouthSmileLeft=1, mouthSmileRight=1, mouthSmileFix=1)
    cam = comum.camera_site('1440x900', escala=4)
    arq = os.path.join(pasta, 'close-boca-sorriso.png')
    _render(arq, pecas + pele, False, True, _borda((x0, y0, x1, y1), 1440, 900), amostras=96)
    bpy.data.objects.remove(cam)
    ctx['busto'].pose()
    pts = ' '.join('%d,%d' % ((a - x0) * 4, (b - y0) * 4) for a, b in s['poligono'])
    subprocess.run(['convert', arq, '-fill', 'none', '-stroke', '#ffcc00', '-strokewidth', '3', '-draw',
                    'polygon ' + pts, arq], check=True)
    f = min(v['tl_mic']['min_mm'] for v in med['folga_mm'].values())
    _rotular(arq, 'CLOSE - boca SORRINDO (sorriso inteiro), câmera do site 1440 a 4x',
             'contorno amarelo = lábios medidos | cápsula a %.0f px CSS da boca, %d px sobre ela' % (
                 s['dist_min_capsula_px'], s['px_sobre_boca']),
             'cápsula × pele: %.1f mm (pior pose) | direita da imagem = esquerda do Fael' % f)


def detalhe(ctx, pasta, pecas):
    alvo = G.bl(ctx['conchas'][1]['pivo'] + G.un(ctx['q'][1]['fr']) * 0.004)
    olho = alvo + G.bl((0.10, -0.03, 0.15))                    # de frente e de baixo: almofada, costura, pino
    for arq, cyc in (('detalhe-material.png', True), ('detalhe-argila.png', False)):
        cam = _cam('CamDet', olho, alvo, lens=60, res=(820, 640))
        _render(os.path.join(pasta, arq), pecas, False, cyc, amostras=96)
        bpy.data.objects.remove(cam)
    _rotular(os.path.join(pasta, 'detalhe-material.png'), 'DETALHE - concha E (microfone): anel de LED, almofada com',
             'costura, garfo com pinos, deslizador, aço escovado com as marcas do ajuste, cubo da haste')
    _rotular(os.path.join(pasta, 'detalhe-argila.png'), 'DETALHE - argila (chanfros e volumes)')


def montar(pasta, med, pc):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    run = lambda *a: subprocess.run(['convert', *a], check=True)              # noqa: E731
    run(j('frente-material.png'), '-resize', 'x540', j('frente-argila.png'), '-resize', 'x540',
        '-background', '#111', '+append', '-resize', '1560x', '+repage', j('_l1.png'))
    run(j('lateral-E.png'), '-resize', 'x440', j('lateral-D.png'), '-resize', 'x440', j('cima.png'), '-resize', 'x440',
        j('tras.png'), '-resize', 'x440', '-background', '#111', '+append', '-resize', '1560x', '+repage', j('_l2.png'))
    run(j('close-boca-sorriso.png'), '-resize', 'x420', j('detalhe-material.png'), '-resize', 'x420',
        '-background', '#111', '+append', '-resize', '1560x>', '+repage', j('_l3.png'))
    txt = 'techlead v1 (modelagem) | glb: %s | folgas mín. (pior pose): arco %.1f, haste %.1f, cápsula %.1f mm' % (
        med['glb'].split(': ')[-1], pc['tl_arco']['folga_mm'], pc['tl_haste']['folga_mm'], pc['tl_mic']['folga_mm'])
    run(j('_l1.png'), j('_l2.png'), j('_l3.png'), '-background', '#111', '-gravity', 'center', '-append',
        '-resize', '1560x>', '+repage', '-gravity', 'north', '-splice', '0x26', '-fill', '#eee', '-pointsize', '16',
        '-annotate', '+0+4', txt, j('folha-v1.png'))
    for n in os.listdir(pasta):
        if n.startswith('_l'):
            os.remove(j(n))
    print('FOLHA', j('folha-v1.png'))
