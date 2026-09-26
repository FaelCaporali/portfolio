"""Prova da PEGADA (ADENDO 2 da ficha): checagem numérica e vistas rotuladas de cada mão (motorista, lateral, cima),
e simulação do degradê do site nos renders de material (a UV `Fade` do adereço e o neckFade do busto)."""
import os
import subprocess

import bpy
import numpy as np
from mathutils import Vector

import comum
import prop_uber_volante as VO

ROTULO = {'dir': 'direita do Fael', 'esq': 'esquerda do Fael'}


def _local(P):
    M = np.array(VO.matriz().inverted())
    return np.asarray(P) @ M[:3, :3].T + M[:3, 3]


def _rho(L):
    return np.hypot(L[..., 0], L[..., 2])


def checar(dados):
    """Polegar dentro do aro; pontas dos dedos mais perto do centro que os nós (MCP); nós por fora do aro;
    antebraço fora do círculo externo e atrás do plano do aro (para o motorista); lado certo na tela."""
    out = {}
    for nome, d in zip(('esq', 'dir'), dados):
        mao, T = d['mao'], d['T']
        G = mao.globais()
        s = '.' + mao.lado

        def mundo(b, qual):
            p = G[b + s] @ np.r_[mao.cab[b + s][qual], 1]
            return (T @ p)[:3]
        pol = _local(mundo('finger1-3', 1)[None])[0]
        pontas = _local(np.array([mundo('finger%d-3' % k, 1) for k in (2, 3, 4, 5)]))
        nos = _local(np.array([mundo('finger%d-1' % k, 0) for k in (2, 3, 4, 5)]))
        ante = _local(d['V'][mao.t < -0.03].mean(0)[None])[0]
        ext = VO.RC + VO.R_TUBO
        r = {'x_glb_da_mao': round(float(d['V'].mean(0)[0]), 3),
             'polegar_rho_menos_RC_mm': round(float(_rho(pol) - VO.RC) * 1000, 1),
             'pontas_rho_mm': [round(float(v) * 1000, 1) for v in _rho(pontas)],
             'nos_rho_mm': [round(float(v) * 1000, 1) for v in _rho(nos)],
             'antebraco_rho_menos_externo_mm': round(float(_rho(ante) - ext) * 1000, 1),
             'antebraco_atras_do_plano_mm': round(float(ante[1] - VO.R_TUBO) * 1000, 1)}
        juntas = np.array([mundo('finger%d-%d' % (k, j), 0) for k in (2, 3, 4, 5) for j in (1, 2, 3)] +
                          [mundo('finger%d-3' % k, 1) for k in (2, 3, 4, 5)])
        L = _local(juntas)
        psi = np.degrees(np.arctan2(L[:, 1], _rho(L) - VO.RC))           # 0 = fora, −90 = painel, ±180 = dentro
        envolve = {}
        for i, k in enumerate((2, 3, 4, 5)):
            cad = [mao.beta] + [psi[i * 3 + j] for j in range(3)] + [psi[12 + i]]
            envolve['dedo%d' % k] = round(float(sum(-((b - a + 180) % 360 - 180) for a, b in zip(cad, cad[1:]))), 0)
        r['envolvimento_graus_palma_a_ponta'] = envolve
        r['flexao_graus_mcp_pip_dip'] = {'dedo%d' % k: v for k, v in mao.curva.items()}
        r['lado_certo'] = (r['x_glb_da_mao'] < 0) == (nome == 'dir')
        r['polegar_dentro_do_aro'] = r['polegar_rho_menos_RC_mm'] < 0
        r['pontas_mais_perto_do_centro_que_os_nos'] = bool((_rho(pontas) < _rho(nos)).all())
        r['nos_por_fora_do_aro'] = bool((_rho(nos) > VO.RC).all())
        r['antebraco_fora_e_atras'] = r['antebraco_rho_menos_externo_mm'] > 0 and r['antebraco_atras_do_plano_mm'] > 0
        out[ROTULO[nome]] = r
    print('PEGADA', out)
    return out


def tela(g, busto, dados):
    """1440: largura de cada mão na tela (partes visíveis, Fade ≥ 0,05) sobre a largura do rosto na linha dos olhos, e
    fração visível do polegar (raio até a câmera sem bater no aro, nas mãos ou no busto)."""
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils.bvhtree import BVHTree
    import bmesh
    import prop_uber_prova as PR
    sc = bpy.context.scene
    cam = comum.camera_site('1440x900', escala=1)
    bpy.context.view_layer.update()
    px = lambda p: world_to_camera_view(sc, cam, Vector(p)).x * 1440                    # noqa: E731
    e = busto.raio(Vector((0, 0.06, 0.18)), Vector((-1, 0, 0)))[0]
    d = busto.raio(Vector((0, 0.06, 0.18)), Vector((1, 0, 0)))[0]
    rosto = abs(px(d) - px(e))
    bm = bmesh.new()
    for o in g['volante'] + g['maos'] + [busto.pele]:
        t = bmesh.new()
        t.from_object(o, bpy.context.evaluated_depsgraph_get())
        t.transform(o.matrix_world)
        m = bpy.data.meshes.new('_v')
        t.to_mesh(m)
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
        t.free()
    arv = BVHTree.FromBMesh(bm)
    olho = cam.matrix_world.translation
    out = {'rosto_px_olhos': round(rosto, 1)}
    for o in g['maos']:
        if o.name.endswith('_malha'):
            f = PR._fade(o)
            xs = [px(o.matrix_world @ v.co) for v in o.data.vertices if f[v.index] >= 0.05]
            out[o.name + '_largura_sobre_rosto'] = round((max(xs) - min(xs)) / rosto, 3)
    for nome, dd in zip(('esq', 'dir'), dados):
        mao = dd['mao']
        pol = sum(mao.W[:, mao.idx['finger1-%d.%s' % (k, mao.lado)]] for k in (2, 3)) > 0.5
        vis = 0
        P = dd['V'][pol]
        for p in P:
            v = olho - Vector(p)
            vis += arv.ray_cast(Vector(p) + v.normalized() * 0.0015, v.normalized(), v.length)[0] is None
        out['polegar_visivel_fracao_' + ROTULO[nome]] = round(vis / max(len(P), 1), 3)
    bm.free()
    bpy.data.objects.remove(cam)
    print('TELA', out)
    return out


def vistas(g, dados, pasta):
    """Argila de cada mão com o aro: do motorista (atrás do Fael), lateral (de fora) e de cima; folha rotulada."""
    sc = bpy.context.scene
    pecas = g['volante'] + g['maos']
    c, ex, mo, topo = (np.array(v) for v in VO.quadro())
    cam = bpy.data.objects.new('_CamPegada', bpy.data.cameras.new('_CamPegada'))
    sc.collection.objects.link(cam)
    cam.data.lens = 70
    cam.data.clip_start = 0.005
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = 420
    arqs = []
    for nome in ('dir', 'esq'):
        alvo = np.array(VO.pega(nome)[0])
        rad = np.array(VO.pega(nome)[2])
        for vista, dr in (('motorista', mo * 1.0 + topo * 0.35), ('lateral', rad * 1.0 + mo * 0.15),
                          ('cima', np.array((0, 0, 1.0)) + mo * 0.25)):
            dr = dr / np.linalg.norm(dr)
            cam.location = Vector(alvo + dr * 0.42)
            cam.rotation_euler = (Vector(alvo) - cam.location).to_track_quat('-Z', 'Y').to_euler()
            arq = os.path.join(pasta, 'pegada-%s-%s.png' % (nome, vista))
            comum.render_argila(arq, pecas)
            subprocess.run(['convert', arq, '-gravity', 'north', '-pointsize', '20', '-fill', '#222', '-annotate',
                            '+0+6', '%s — %s' % (ROTULO[nome], vista), arq], check=True)
            arqs.append(arq)
    bpy.data.objects.remove(cam)
    folha = os.path.join(pasta, 'pegada.png')
    subprocess.run(['montage', *arqs, '-tile', '3x2', '-geometry', '+2+2', '-background', '#111', folha], check=True)
    return folha


def simular_fade():
    """Renders de material com o degradê do site: adereço pela UV `Fade` (x), busto pelo neckFade (y do glb
    0,012 → 0,075, dissolve.ts). Mistura para a cor do fundo (#0b0b0e) por emissão."""
    fundo = (0.0033, 0.0033, 0.0044, 1)
    for m in bpy.data.materials:
        if m.name not in ('uber_pele', 'uber_rigido', 'uber_unha', '3DModel') or not m.use_nodes:
            continue
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        src = out.inputs['Surface'].links[0].from_socket
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        if m.name == '3DModel':
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
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = fundo
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(fator, mix.inputs[0])
        nt.links.new(em.outputs[0], mix.inputs[1])
        nt.links.new(src, mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
