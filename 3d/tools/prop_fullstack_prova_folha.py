"""Renders rotulados e folha (≤ 1568 px) da vida `fullstack` v1: FRENTE (câmera do site 1440, material com o degradê
do site e argila), LATERAL ESQUERDA DO FAEL (+X, ortográfica), DE CIMA (ortográfica), VISTA DO FAEL (dos olhos, sem o
busto) e o recorte de cada adesivo no tamanho do 360 (pixels do aparelho, dsf 2). `rapido` = tudo em argila."""
import os
import subprocess

import bpy
from mathutils import Matrix, Vector

import comum
import prop_vela_prova_olho as olho
from prop_vela_prova import render_cycles

FUNDO = (0.0033, 0.0033, 0.0044, 1)          # #0b0b0e do site
_CHAVES = []


def simular_fade():
    """Degradê do site nos renders de material: adereço pela UV `Fade` (x), busto pelo neckFade (y 0,012 → 0,075).
    Devolve as chaves (nós Value): 1 = degradê desligado (vista do Fael)."""
    for m in bpy.data.materials:
        if m.name not in ('fs_rigido', 'fs_tela', 'fs_vinil', '3DModel') or not m.use_nodes:
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
        chave.outputs[0].default_value = 0.0
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


def _borda(cx, W, H):
    x0, y0, x1, y1 = cx
    return (max(0, x0 / W), min(1, x1 / W), max(0, 1 - y1 / H), min(1, 1 - y0 / H))


def _cam(nome, loc, alvo=None, orto=None, lens=50, res=(800, 800)):
    sc = bpy.context.scene
    cam = bpy.data.objects.new(nome, bpy.data.cameras.new(nome))
    sc.collection.objects.link(cam)
    cam.location = Vector(loc)
    if alvo is None:
        cam.rotation_euler = (0, 0, 0)
    else:                                  # cima da imagem = para a frente do Fael (+Z do glb = −Y do Blender)
        f = (Vector(alvo) - cam.location).normalized()
        r = f.cross(Vector((0, -1, 0)) if abs(f.z) > 0.8 else Vector((0, 0, 1))).normalized()
        cam.rotation_euler = Matrix((r, r.cross(f), -f)).transposed().to_euler()
    if orto:
        cam.data.type, cam.data.ortho_scale = 'ORTHO', orto
    cam.data.lens, cam.data.clip_start = lens, 0.002
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = res
    return cam


def _rotular(arq, *linhas):
    a = ['convert', arq, '-gravity', 'north', '-background', '#111', '-splice', '0x%d' % (22 * len(linhas) + 6),
         '-fill', '#f2f2f2', '-pointsize', '17']
    for i, t in enumerate(linhas):
        a += ['-annotate', '+0+%d' % (4 + 22 * i), t]
    subprocess.run(a + [arq], check=True)


def _render(arq, visiveis, rapido, cycles=True, borda=None, amostras=48):
    sc = bpy.context.scene
    if rapido or not cycles:
        cam = sc.camera
        comum.render_argila(arq, visiveis)
        sc.camera = cam
        if borda:
            W, H = sc.render.resolution_x, sc.render.resolution_y
            x0, x1, y0, y1 = borda
            subprocess.run(['convert', arq, '-crop', '%dx%d+%d+%d' % ((x1 - x0) * W, (y1 - y0) * H, x0 * W,
                                                                      (1 - y1) * H), '+repage', arq], check=True)
        return arq
    cam = sc.camera
    olho.estudio()
    sc.camera = cam
    sc.cycles.samples = amostras
    return render_cycles(arq, visiveis, borda or (0, 1, 0, 1))


def renders(busto, ms, pasta, med, rapido=False):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    pele = list(busto.malhas.values())
    pecas = list(ms.values())
    if not rapido:
        olho.estudio()
        simular_fade()
    t = med['telas']['1440x900']
    nb, bu = t['notebook_visivel'], t['busto']
    cx = (max(0, min(nb[0], bu[0]) - 24), bu[1] - 16, min(1440, max(nb[2], bu[2]) + 24), 900)
    # FRENTE: câmera do site, argila e material (com o degradê)
    for arq, cyc in (('frente-argila-1440.png', False), ('frente-material-1440.png', True)):
        cam = comum.camera_site('1440x900', escala=1)
        fade(True)
        _render(j(arq), pecas + pele, rapido, cyc, _borda(cx, 1440, 900))
        bpy.data.objects.remove(cam)
    _rotular(j('frente-argila-1440.png'), 'FRENTE - câmera do site 1440 (argila)',
             'esquerda da imagem = direita do Fael')
    _rotular(j('frente-material-1440.png'), 'FRENTE - câmera do site 1440 (material, degradê do site)',
             'respiro tampa x lábio %.0f px' % t['respiro_px'])
    # LATERAL ESQUERDA DO FAEL (+X) e DE CIMA: ortográficas, argila, com o busto
    fade(False)
    cam = _cam('CamLat', (0.9, 0.1, 0.07), (0.0, 0.1, 0.07), orto=0.62, res=(760, 760))
    _render(j('lateral-esq.png'), pecas + pele, True)
    bpy.data.objects.remove(cam)
    _rotular(j('lateral-esq.png'), 'LATERAL ESQUERDA DO FAEL (+X), argila, ortográfica',
             '<- câmera do site (+Z)          Fael / nuca (-Z) ->',
             'abertura tampa x base %d graus' % med['abertura_graus'])
    cam = _cam('CamCima', (0.0, 0.1, 0.8), None, orto=0.52, res=(760, 760))
    _render(j('cima.png'), pecas + pele, True)
    bpy.data.objects.remove(cam)
    _rotular(j('cima.png'), 'DE CIMA, argila, ortográfica', 'topo da imagem = nuca (-Z); base = câmera do site (+Z)',
             'direita da imagem = esquerda do Fael (+X)')
    # VISTA DO FAEL: dos olhos, sem o busto, material sem degradê
    cam = _cam('CamFael', comum.gl_para_bl((0.0, 0.18, 0.0)), comum.gl_para_bl((-0.01, -0.10, 0.01)), lens=17,
               res=(960, 720))
    cam.data.sensor_width = 36
    _render(j('vista-fael.png'), pecas, rapido, True, amostras=64)
    bpy.data.objects.remove(cam)
    _rotular(j('vista-fael.png'), 'VISTA DO FAEL (dos olhos, busto oculto): tela e teclado',
             'esquerda da imagem = esquerda do Fael')
    adesivos_360(pecas + pele, j, med, rapido)
    adesivos_1440(pecas + pele, j, med, rapido)
    montar(pasta, med)


def adesivos_1440(vis, j, med, rapido):
    """Faixa dos adesivos na câmera do 1440 (px CSS), ampliada 2× sem filtro: a margem branca tem de aparecer."""
    t = med['telas']['1440x900']['adesivos_px']
    cx = (min(a['caixa'][0] for a in t.values()) - 8, min(a['caixa'][1] for a in t.values()) - 8,
          max(a['caixa'][2] for a in t.values()) + 8, max(a['caixa'][3] for a in t.values()) + 8)
    cam = comum.camera_site('1440x900', escala=1)
    fade(True)
    _render(j('adesivos-1440.png'), vis, rapido, True, _borda(cx, 1440, 900), 96)
    bpy.data.objects.remove(cam)
    subprocess.run(['convert', j('adesivos-1440.png'), '-filter', 'point', '-resize', '200%', j('adesivos-1440.png')],
                   check=True)
    c = {s: a['contraste_logo_fundo'] for s, a in med['adesivos_cm'].items()}
    _rotular(j('adesivos-1440.png'),
             'ADESIVOS no 1440 (câmera do site, ampliado 2x sem filtro): margem branca de 2,5 mm',
             'contraste logo x fundo (desgaste incluso): ' + ', '.join('%s %.1f' % kv for kv in c.items()))


def adesivos_360(vis, j, med, rapido):
    """Render do 360 em pixels do aparelho (dsf 2) só na faixa dos adesivos; recorte de cada um, 1:1 e ampliado 3×."""
    t = med['telas']['360x740']['adesivos_px']
    x0 = min(a['caixa'][0] for a in t.values()) - 6
    y0 = min(a['caixa'][1] for a in t.values()) - 6
    x1 = max(a['caixa'][2] for a in t.values()) + 6
    y1 = max(a['caixa'][3] for a in t.values()) + 6
    cam = comum.camera_site('360x740', escala=2)
    fade(True)
    _render(j('_adesivos-360.png'), vis, rapido, True, _borda((x0 * 2, y0 * 2, x1 * 2, y1 * 2), 720, 1480), 64)
    bpy.data.objects.remove(cam)
    tiras = []
    for s, a in sorted(t.items(), key=lambda kv: -max(kv[1]['w'], kv[1]['h'])):
        cx = a['caixa']
        g = '%dx%d+%d+%d' % ((cx[2] - cx[0] + 4) * 2, (cx[3] - cx[1] + 4) * 2, (cx[0] - 2 - x0) * 2,
                             (cx[1] - 2 - y0) * 2)
        arq = j('_ad-%s.png' % s)
        cm = med['adesivos_cm'][s]
        subprocess.run(['convert', j('_adesivos-360.png'), '-crop', g, '+repage', '(', '+clone', '-filter', 'point',
                        '-resize', '300%', ')', '-background', '#111', '-gravity', 'center', '+append',
                        '-gravity', 'north', '-splice', '0x38', '-fill', '#eee', '-pointsize', '13',
                        '-annotate', '+0+2', '%s  nível %d  %.1f x %.1f cm' % (s, cm['nivel'], *cm['real_cm']),
                        '-annotate', '+0+19', '360: %.0f px CSS (1:1 e 3x)' % max(a['w'], a['h']), arq], check=True)
        tiras.append(arq)
    subprocess.run(['convert', *tiras, '-background', '#111', '-gravity', 'center', '+append', j('adesivos-360.png')],
                   check=True)


def montar(pasta, med):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    run = lambda *a: subprocess.run(['convert', *a], check=True)              # noqa: E731
    run(j('frente-material-1440.png'), '-resize', 'x560', j('frente-argila-1440.png'), '-resize', 'x560',
        '-background', '#111', '+append', j('_l1.png'))
    run(j('lateral-esq.png'), '-resize', 'x500', j('cima.png'), '-resize', 'x500', j('vista-fael.png'), '-resize',
        'x500', '-background', '#111', '+append', j('_l2.png'))
    run(j('adesivos-360.png'), '-resize', '1560x>', j('_l3.png'))
    run(j('adesivos-1440.png'), '-resize', '1560x>', j('_l4.png'))
    f = med['folga_busto_cm']['neutro']
    txt = 'v2 | glb: %s | folga min busto (neutro) %.2f cm' % (med['glb'].split(': ')[-1], min(f.values()))
    run(j('_l1.png'), j('_l4.png'), j('_l2.png'), j('_l3.png'), '-background', '#111', '-gravity', 'center',
        '-append', '-resize', '1560x>', '-gravity', 'north', '-splice', '0x26', '-fill', '#eee', '-pointsize', '16',
        '-annotate', '+0+4', txt, j('folha-v2.png'))
    print('FOLHA', j('folha-v2.png'))
