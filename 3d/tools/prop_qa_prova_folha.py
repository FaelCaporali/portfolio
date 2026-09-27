"""Renders rotulados e folha (≤ 1568 px) da vida `qa` v1: FRENTE pela câmera do site (1440; material com o degradê do
site e argila, busto S13 com browDown 0,5), BUG (de cima em material, silhueta de cima = ícone, voo em 3/4, lateral
em argila com as raízes das patas), MÃO E LUPA (lateral pela direita do Fael com o busto, VISTA DO FAEL dos olhos,
pegada de perto em argila) e CAIXA (frente em material, espécime com alfinete de perto, lateral em argila)."""
import math
import os
import subprocess

import bpy
import numpy as np
from mathutils import Matrix, Vector

import comum
import prop_qa_caixa as CX
import prop_qa_util as U
import prop_vela_prova_olho as olho
from prop_vela_prova import render_cycles

FUNDO = (0.0033, 0.0033, 0.0044, 1)
VERSAO = 'v2'
_CHAVES = []


def simular_fade():
    """Degradê do site: mão pela UV `Fade` (x), busto pelo neckFade (altura 0,012 → 0,075). 1 = desligado."""
    for m in bpy.data.materials:
        if m.name not in ('qa_pele', '3DModel') or not m.use_nodes:
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


def cam(loc, alvo, cima, orto=None, lens=50, res=(600, 600)):
    """Câmera (pontos no glb) olhando `alvo` com `cima` para o alto da imagem."""
    sc = bpy.context.scene
    c = bpy.data.objects.new('CamQA', bpy.data.cameras.new('CamQA'))
    sc.collection.objects.link(c)
    lo, al, up = U.bl(loc), U.bl(alvo), U.bl(cima) - U.bl((0, 0, 0))
    f = (al - lo).normalized()
    r = f.cross(up).normalized()
    u = r.cross(f)
    M = Matrix((r, u, -f)).transposed().to_4x4()
    M.translation = lo
    c.matrix_world = M
    if orto:
        c.data.type, c.data.ortho_scale = 'ORTHO', orto
    c.data.lens, c.data.clip_start, c.data.clip_end = lens, 0.002, 20
    sc.camera = c
    sc.render.resolution_x, sc.render.resolution_y = res
    return c


def rotular(arq, *linhas):
    a = ['convert', arq, '-gravity', 'north', '-background', '#111', '-splice', '0x%d' % (21 * len(linhas) + 6),
         '-fill', '#f2f2f2', '-pointsize', '16']
    for i, t in enumerate(linhas):
        a += ['-annotate', '+0+%d' % (4 + 21 * i), t]
    subprocess.run(a + [arq], check=True)


def render(arq, vis, material=True, borda=None, amostras=40):
    sc = bpy.context.scene
    c = sc.camera
    if not material:
        comum.render_argila(arq, vis)
        sc.camera = c
        return arq
    olho.estudio()
    sc.camera = c
    sc.cycles.samples = amostras
    return render_cycles(arq, vis, borda or (0, 1, 0, 1))


def _fora(c):
    bpy.data.objects.remove(c)


def renders(busto, objs, d, quadros, pasta, med):
    j = lambda n: os.path.join(pasta, n)                                        # noqa: E731
    ob = {o.name: o for o in objs}
    pele = list(busto.malhas.values())
    malhas = [o for o in objs if o.type == 'MESH']
    bug = [o for o in malhas if o.name.startswith('qa_bug')]
    mao = [ob['qa_mao_malha'], ob['qa_mao_unhas'], ob['qa_lupa_malha'], ob['qa_lupa_lente']]
    cx = [ob['qa_caixa_malha'], ob['qa_caixa_vidro']]
    M_lupa, M_bug, M_caixa = quadros
    olho.estudio()
    simular_fade()
    t = med['telas_px_css']['1440x900']
    ks = [t['busto'][0], t['aro'][0], t['caixa'][0]]
    x0, y0 = max(0, min(k[0] for k in ks) - 30), max(0, min(k[1] for k in ks) - 20)
    x1, y1 = min(1440, max(k[2] for k in ks) + 30), min(900, max(k[3] for k in ks) + 20)
    borda = (x0 / 1440, x1 / 1440, 1 - y1 / 900, 1 - y0 / 900)
    for arq, mat in (('frente-material-1440.png', True), ('frente-argila-1440.png', False)):
        c = comum.camera_site('1440x900', escala=1)
        fade(True)
        render(j(arq), malhas + pele, mat, borda, 48)
        if not mat:
            subprocess.run(['convert', j(arq), '-crop', '%dx%d+%d+%d' % (x1 - x0, y1 - y0, x0, y0), '+repage',
                            j(arq)], check=True)
        _fora(c)
    b = med['bug']
    rotular(j('frente-material-1440.png'), 'FRENTE: câmera do site 1440 (material, degradê do site, browDown 0,5)',
            'esquerda da imagem = DIREITA do Fael (mão direita, lado -X)')
    rotular(j('frente-argila-1440.png'), 'FRENTE: câmera do site 1440 (argila)',
            'bug %.0f px, aro %.0f px, caixa %.0f px (1440)' % (t['bug'][1], t['aro'][1], t['caixa'][1]))
    fade(False)
    p, xb, yb, zb = M_bug[:3, 3], M_bug[:3, 0], M_bug[:3, 1], M_bug[:3, 2]
    c = cam(p + yb * 0.2, p, zb, orto=0.050, res=(520, 520))
    render(j('bug-cima.png'), bug, True, amostras=64)
    comum.render_silhueta(j('bug-icone.png'), bug)
    _fora(c)
    rotular(j('bug-cima.png'), 'BUG DE CIMA (pouso, material)', 'élitros laqueados com a sutura escura')
    rotular(j('bug-icone.png'), 'BUG DE CIMA: silhueta = ícone de bug', '6 patas, 2 antenas, casco partido ao meio')
    voo(ob, M_bug, True)
    c = cam(p + U.unit(yb * 0.75 + xb * 0.45 - zb * 0.45) * 0.3, p, yb, orto=0.075, res=(520, 520))
    render(j('bug-voo.png'), bug, True, amostras=64)
    _fora(c)
    voo(ob, M_bug, False)
    rotular(j('bug-voo.png'), 'BUG EM VOO (3/4 de trás): élitros abertos 40 graus,',
            'asas com nervuras (chave voo), patas encolhidas')
    c = cam(p + xb * 0.2, p, yb, orto=0.050, res=(520, 520))
    render(j('bug-lateral.png'), bug, False)
    _fora(c)
    rz = ', '.join('%+.1f' % q['raiz_z_mm'] for q in b['patas'][::2])
    rotular(j('bug-lateral.png'), 'BUG LATERAL (argila; cabeça à esquerda)',
            'raízes das patas z = %s mm, tórax [%.1f; %.1f] mm' % (rz, *b['torax_z_mm']),
            '%d/6 patas saem do tórax; corpo %.1f mm (cabeça à ponta)' % (b['patas_no_torax'],
                                                                         b['comprimento_cabeca_a_ponta_m'] * 1000))
    L = M_lupa[:3, 3]
    alvo = np.array((-0.06, 0.10, 0.0))
    c = cam(alvo + np.array((-0.9, 0.0, 0.0)), alvo, (0, 1, 0), orto=0.46, res=(600, 600))
    render(j('mao-lateral.png'), mao + bug + pele, False)
    _fora(c)
    rotular(j('mao-lateral.png'), 'LATERAL pela DIREITA do Fael (-X), argila', 'câmera do site à direita da imagem')
    c = cam((-0.035, 0.18, 0.0), L + M_lupa[:3, 1] * -0.06, (0, 1, 0), lens=24, res=(640, 600))
    render(j('vista-fael.png'), mao + bug, True, amostras=48)
    _fora(c)
    rotular(j('vista-fael.png'), 'VISTA DO FAEL (dos olhos, busto oculto)',
            'mão direita segurando o cabo; bug sob a lente')
    Q = d['M_mao'][:3, 3]
    c = cam(Q + U.unit((0.14, 0.06, 1.0)) * 0.6, Q, M_lupa[:3, 1], orto=0.15, res=(600, 600))
    render(j('pegada.png'), mao, False)
    _fora(c)
    g = med['pegada']
    rotular(j('pegada.png'), 'PEGADA de perto (argila, de frente)',
            'folga dedos x cabo %.2f-%.2f mm; %d vértices dentro do cabo' % (
                min(g['dedo%d' % k] for k in range(1, 6)), max(g['dedo%d' % k] for k in range(1, 6)),
                g['vertices_dentro_do_cabo']))
    caixa(ob, cx, M_caixa, j, med)
    montar(pasta, med)


def voo(ob, M_bug, ligado):
    import prop_qa_bug as BG
    for lado, s in (('esq', 1), ('dir', -1)):
        ax, az = BG.ELITRO_ABERTO[lado] if ligado else (0.0, 0.0)
        a, z = math.radians(ax), math.radians(az)
        ca, sa, cz, sz = math.cos(a), math.sin(a), math.cos(z), math.sin(z)
        Rx = np.array(((1, 0, 0, 0), (0, ca, -sa, 0), (0, sa, ca, 0), (0, 0, 0, 1)))
        Rz = np.array(((cz, -sz, 0, 0), (sz, cz, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
        T = np.eye(4)
        T[:3, 3] = BG.pivo_elitro(s)
        ob['qa_bug_elitro_' + lado].matrix_world = U.m_bl(M_bug @ T @ Rz @ Rx)
    for n in ('qa_bug_patas_malha', 'qa_bug_asa_esq_malha', 'qa_bug_asa_dir_malha'):
        ob[n].data.shape_keys.key_blocks['voo'].value = 1.0 if ligado else 0.0
    bpy.context.view_layer.update()


def caixa(ob, cx, M_caixa, j, med):
    o, X, Y = M_caixa[:3, 3], M_caixa[:3, 0], M_caixa[:3, 1]
    Z = M_caixa[:3, 2]
    ML = CX._M_lean()
    cen = o + M_caixa[:3, :3] @ (ML[:3, :3] @ np.array((0, CX.HH / 2, 0)) + ML[:3, 3])
    nrm = M_caixa[:3, :3] @ (ML[:3, :3] @ np.array((0, 0, 1.0)))
    c = cam(cen + nrm * 0.45, cen, Y, lens=70, res=(640, 520))
    render(j('caixa-frente.png'), cx, True, amostras=64)
    _fora(c)
    k = med['caixa']
    rotular(j('caixa-frente.png'), 'CAIXA de frente (material): 8 formas de inseto (3 vermelhos) + vaga livre',
            'maior lado %.3f m = %.2f da cabeça; inclinada %d graus' % (
                max(k['externo_m'][:2]), k['maior_lado_sobre_cabeca'], k['inclinacao_graus']))
    fw, fh = CX.W / 2 - CX.INSET, CX.HH / 2 - CX.INSET
    loc = np.array((-fw + 2 * fw / 3 * 1.5, CX.HH - CX.INSET - 2 * fh / 3 * 0.5 + 0.0005, CX.Z_CORTICA + 0.007))
    pe = o + M_caixa[:3, :3] @ (ML[:3, :3] @ loc + ML[:3, 3])
    c = cam(pe + U.unit(nrm * 0.45 + X * 0.8 + Y * 0.35) * 0.3, pe, Y, orto=0.034, res=(560, 520))
    render(j('caixa-especime.png'), cx[:1], True, amostras=64)
    _fora(c)
    rotular(j('caixa-especime.png'), 'ESPÉCIME de perto (sem o vidro): alfinete no tórax, etiqueta embaixo',
            '%d/8 alfinetes atravessam o tórax (pronoto)' % k['alfinetes_no_torax'])
    c = cam(cen + X * 0.6, cen, (0, 1, 0), orto=0.17, res=(520, 520))
    render(j('caixa-lateral.png'), cx, False)
    _fora(c)
    rotular(j('caixa-lateral.png'), 'CAIXA lateral (argila): apoio e cavalete', 'câmera do site à esquerda')


def montar(pasta, med):
    j = lambda n: os.path.join(pasta, n)                                        # noqa: E731
    run = lambda *a: subprocess.run(['convert', *a], check=True)               # noqa: E731
    run(j('frente-material-1440.png'), '-resize', 'x520', j('frente-argila-1440.png'), '-resize', 'x520',
        '-background', '#111', '+append', '-resize', '1560x>', j('_l1.png'))
    run(*[x for n in ('bug-cima', 'bug-icone', 'bug-voo', 'bug-lateral') for x in (j(n + '.png'), '-resize', 'x380')],
        '-background', '#111', '+append', '-resize', '1560x>', j('_l2.png'))
    run(*[x for n in ('mao-lateral', 'vista-fael', 'pegada') for x in (j(n + '.png'), '-resize', 'x470')],
        '-background', '#111', '+append', '-resize', '1560x>', j('_l3.png'))
    run(*[x for n in ('caixa-frente', 'caixa-especime', 'caixa-lateral') for x in (j(n + '.png'), '-resize', 'x440')],
        '-background', '#111', '+append', '-resize', '1560x>', j('_l4.png'))
    f = med['folga_busto']
    txt = 'qa %s | %s | folga ao busto (cm): bug %.1f, mão %.1f, lupa %.1f, caixa %.1f' % (VERSAO, 
        med['glb'].split(': ')[-1], f['bug']['min_cm'], f['mao']['min_cm'], f['lupa']['min_cm'], f['caixa']['min_cm'])
    run(j('_l1.png'), j('_l2.png'), j('_l3.png'), j('_l4.png'), '-background', '#111', '-gravity', 'center',
        '-append', '-resize', '1560x>', '-gravity', 'north', '-splice', '0x26', '-fill', '#eee', '-pointsize', '16',
        '-annotate', '+0+4', txt, j('folha-%s.png' % VERSAO))
    for n in ('_l1', '_l2', '_l3', '_l4'):
        os.remove(j(n + '.png'))
    print('FOLHA', j('folha-%s.png' % VERSAO))
