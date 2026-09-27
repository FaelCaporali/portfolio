"""Renders rotulados e folha (≤ 1568 px) da vida `devops` v1: FRENTE (câmera do site 1440 com o busto S13, material
com o degradê do site e argila, escala do glb), FRENTE no grupo 0,8, LATERAL (+X, ortográfica: ângulo do tampo e a régua
sobre a folha), DE CIMA (ortográfica), VISTA DO FAEL (dos olhos, busto oculto, a folha com a prova de UV) e DETALHE
(régua, cabo, cabeça, fita, escalímetro, lapiseira) em material e argila. `rapido` = tudo em argila."""
import os
import subprocess

import bpy
from mathutils import Vector

import comum
import prop_devops_prancheta as P
from prop_fullstack_prova_folha import _borda, _cam, _render, _rotular

FUNDO = (0.0033, 0.0033, 0.0044, 1)          # #0b0b0e do site
_CHAVES = []


def simular_fade():
    """Degradê do site nos renders de material: adereço pela UV `Fade` (x), busto pelo neckFade (y 0,012 → 0,075)."""
    import prop_vela_prova_olho as olho
    olho.estudio()
    for m in bpy.data.materials:
        if m.name not in ('arq_rigido', 'arq_papel', '3DModel') or not m.use_nodes:
            continue
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        src = out.inputs['Surface'].links[0].from_socket
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        if m.name == '3DModel':
            next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Roughness'].default_value = 0.72
            pos = nt.nodes.new('ShaderNodeNewGeometry')
            nt.links.new(pos.outputs['Position'], sep.inputs[0])
            mr = nt.nodes.new('ShaderNodeMapRange')
            mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = 0.012, 0.075
            nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
            fator = mr.outputs['Result']
        else:
            uv = nt.nodes.new('ShaderNodeUVMap')
            uv.uv_map = 'Fade'
            nt.links.new(uv.outputs['UV'], sep.inputs[0])
            fator = sep.outputs['X']
        chave = nt.nodes.new('ShaderNodeValue')
        mx = nt.nodes.new('ShaderNodeMath')
        mx.operation = 'MAXIMUM'
        nt.links.new(fator, mx.inputs[0])
        nt.links.new(chave.outputs[0], mx.inputs[1])
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = FUNDO
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(mx.outputs[0], mix.inputs[0])
        nt.links.new(em.outputs[0], mix.inputs[1])
        nt.links.new(src, mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        _CHAVES.append(chave)


def fade(ligado):
    for c in _CHAVES:
        c.outputs[0].default_value = 0.0 if ligado else 1.0


def prova_uv(pasta):
    """Textura de prova da UV da folha (só nos renders; o glb leva o azul liso): grade de 10 %, cantos rotulados."""
    arq = os.path.join(pasta, '_uv-prova.png')
    w, h = 1024, 724
    a = ['convert', '-size', '%dx%d' % (w, h), 'xc:#1d4a85', '-stroke', '#9cc0ee', '-strokewidth', '1']
    for i in range(1, 10):
        a += ['-draw', 'line %d,0 %d,%d' % (w * i // 10, w * i // 10, h), '-draw', 'line 0,%d %d,%d' % (
            h * i // 10, w, h * i // 10)]
    a += ['-strokewidth', '6', '-fill', 'none', '-draw', 'rectangle 3,3 %d,%d' % (w - 4, h - 4), '-stroke', 'none',
          '-fill', '#ffffff', '-pointsize', '54',
          '-gravity', 'northwest', '-annotate', '+24+18', 'u0 v1',
          '-gravity', 'northeast', '-annotate', '+24+18', 'u1 v1',
          '-gravity', 'southwest', '-annotate', '+24+18', 'u0 v0',
          '-gravity', 'southeast', '-annotate', '+24+18', 'u1 v0',
          '-gravity', 'center', '-pointsize', '64', '-annotate', '+0-40', 'arq_folha',
          '-pointsize', '40', '-annotate', '+0+40', 'UV 0-1  u ->  v ^', arq]
    subprocess.run(a, check=True)
    img = bpy.data.images.load(arq)
    m = bpy.data.materials['arq_papel']
    nt = m.node_tree
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = img
    nt.links.new(t.outputs['Color'], next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])


def _escala_grupo(s):
    pr = bpy.data.objects['arq_prancheta']
    pr.scale = (s, s, s)
    bpy.context.view_layer.update()


def renders(busto, ms, pasta, med, rapido=False):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    pele = list(busto.malhas.values())
    pecas = list(ms.values())
    if not rapido:
        simular_fade()
        prova_uv(pasta)
    t = med['telas']['1440x900']
    vis, bu = t['escala_1.0']['visivel'], t['busto']
    cx = (max(0, min(vis[0], bu[0]) - 24), bu[1] - 16, min(1440, max(vis[2], bu[2]) + 24), 900)
    for arq, cyc, s in (('frente-argila-1440.png', False, 1.0), ('frente-material-1440.png', True, 1.0),
                        ('frente-grupo08-1440.png', True, 0.8)):
        _escala_grupo(s)
        cam = comum.camera_site('1440x900', escala=1)
        fade(True)
        _render(j(arq), pecas + pele, rapido, cyc, _borda(cx, 1440, 900))
        bpy.data.objects.remove(cam)
    _escala_grupo(1.0)
    e1, e8 = t['escala_1.0'], t['escala_0.8']
    _rotular(j('frente-material-1440.png'), 'FRENTE - câmera do site 1440, glb na escala 1 (material, degradê do site)',
             'respiro borda de cima x lábio %.0f px | folha %dx%d px, margem de baixo %.0f px' % (
                 e1['respiro_px'], *e1['folha_px_larg_alt'], e1['folha_margem_baixo_px']))
    _rotular(j('frente-argila-1440.png'), 'FRENTE - argila, escala 1', 'esquerda da imagem = direita do Fael')
    _rotular(j('frente-grupo08-1440.png'), 'FRENTE - grupo 0,8 (como o FullStack)',
             'respiro %.0f px | folha inteira: %s (margem %.0f px)' % (
                 e8['respiro_px'], 'sim' if e8['folha_inteira_na_tela'] else 'não', e8['folha_margem_baixo_px']))
    fade(False)
    g = med['geometria']
    alvo = Vector(comum.gl_para_bl(P.glb((0, -P.R(60), 0))))
    cam = _cam('CamLat', alvo + Vector((0.9, 0, 0.02)), alvo + Vector((0, 0, 0.02)), orto=0.50, res=(760, 700))
    _render(j('lateral.png'), pecas + pele, True)
    bpy.data.objects.remove(cam)
    _rotular(j('lateral.png'), 'LATERAL (lado esquerdo do Fael, +X), argila, ortográfica',
             '<- câmera do site (+Z)            Fael (-Z) ->',
             'tampo %.0f graus sobre a mesa; régua %.0f mm sobre a folha' % (g['inclinacao_graus'],
                                                                           g['regua_sobre_folha_mm']))
    cam = _cam('CamCima', (alvo.x, alvo.y + 0.02, 0.8), None, orto=0.50, res=(760, 700))
    _render(j('cima.png'), pecas + pele, True)
    bpy.data.objects.remove(cam)
    _rotular(j('cima.png'), 'DE CIMA, argila, ortográfica', 'topo = nuca (-Z); base = câmera do site (+Z)',
             'direita da imagem = esquerda do Fael (+X)')
    centro = comum.gl_para_bl(P.glb((0, -P.R(P.FOLHA_MM[1] / 2), 0)))
    cam = _cam('CamFael', comum.gl_para_bl((0.0, 0.18, -0.005)), centro, lens=24, res=(960, 720))
    cam.data.sensor_width = 36
    _render(j('vista-fael.png'), pecas, rapido, True, amostras=64)
    bpy.data.objects.remove(cam)
    _rotular(j('vista-fael.png'), 'VISTA DO FAEL (dos olhos, busto oculto): a folha com a prova de UV',
             'a folha é lida pela câmera; o Fael a vê de cima, de cabeça para baixo e rasante')
    alvo_d = Vector(comum.gl_para_bl(P.glb((P.R(120), P.R(-125), P.R(4)))))
    olho_d = alvo_d + Vector(comum.gl_para_bl((0.10, 0.11, 0.16)))
    for arq, cyc in (('detalhe-material.png', True), ('detalhe-argila.png', False)):
        cam = _cam('CamDet', olho_d, alvo_d, lens=50, res=(900, 620))
        _render(j(arq), pecas, rapido, cyc, amostras=64)
        bpy.data.objects.remove(cam)
    _rotular(j('detalhe-material.png'), 'DETALHE (material): cabeça da régua com o cabo de aço, calha com a lapiseira,',
             'escalímetro 1:100 / 1:50 encostado na régua, fita crepe no canto, chanfros')
    _rotular(j('detalhe-argila.png'), 'DETALHE (argila)')
    montar(pasta, med)


def montar(pasta, med):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    run = lambda *a: subprocess.run(['convert', *a], check=True)              # noqa: E731
    run(j('frente-material-1440.png'), '-resize', 'x520', j('frente-argila-1440.png'), '-resize', 'x520',
        '-background', '#111', '+append', j('_l1.png'))
    run(j('lateral.png'), '-resize', 'x440', j('cima.png'), '-resize', 'x440', j('vista-fael.png'), '-resize', 'x440',
        '-background', '#111', '+append', j('_l2.png'))
    run(j('detalhe-material.png'), '-resize', 'x420', j('detalhe-argila.png'), '-resize', 'x420',
        j('frente-grupo08-1440.png'), '-resize', 'x420', '-background', '#111', '+append', j('_l3.png'))
    f = med['folga_busto_cm']
    fmin = min(min(f['neutro'].values()), min(f['sorriso'].values()))
    txt = 'devops v1 (modelagem) | glb: %s | folga mínima ao busto %.2f cm | folha A5 %.0fx%.0f mm, tampo %.0f graus' % (
        med['glb'].split(': ')[-1], fmin, *med['geometria']['folha_mm_real'], med['geometria']['inclinacao_graus'])
    run(j('_l1.png'), j('_l2.png'), j('_l3.png'), '-background', '#111', '-gravity', 'center', '-append',
        '-resize', '1560x>', '-gravity', 'north', '-splice', '0x26', '-fill', '#eee', '-pointsize', '16',
        '-annotate', '+0+4', txt, j('folha-v1.png'))
    for n in os.listdir(pasta):
        if n.startswith('_l'):
            os.remove(j(n))
    print('FOLHA', j('folha-v1.png'))
