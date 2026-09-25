"""E14: `lampada` — a lâmpada da IDEIA que acende sobre a cabeça do Fael (oitava peça da cena A).

Brief: `.wai/3d/props/empreendedor/FICHA-MOVIMENTO.md`, seção "Lâmpada da ideia". Lâmpada incandescente clássica REAL,
medidas de uma A60 com rosca E27 (mm): bulbo em pera Ø 60, altura total 108; pescoço Ø ~25 cravado na rosca; rosca
Edison redonda (passo 3,629, filete ~0,8) em chapa de alumínio com lábio e friso; anel isolante de vidro preto; contato
de base (gota de solda). Dentro: haste de vidro em trombeta com o prensado, bastão com botão, dois fios de entrada, dois
ganchos de suporte e o filamento em espiral num arco entre os fios.
Materiais (2): `lampada_metal` (rosca, isolante, contato; metal 1, rug 0,35) e `lampada_luz` (vidro opaco claro, haste,
fios e filamento; SEM transmissão, emissivo PRETO no glb: o site acende pelo emissivo desse material no relógio).
Na malha `lampada_luz` as faces do filamento/haste vêm ANTES das do vidro (ordem dos índices), para o site poder dar
opacidade < 1 ao material sem ordenar triângulos. Espaço local: Z para cima, frente −Y (arco do filamento em XZ).

`rodar(construir, tris, glb_animado)` (receita: `-- lampada=1`): monta a cena A, mede a lâmpada nas 3 telas (caixas,
violações, vão à cabeça, razão de área com e sem ela), confere o glb animado (prova_json e estado final das outras peças
contra o glb de produção) e faz a folha `3d/captura/props/empreendedor/v5/lampada/folha-lampada.png`.
"""
import json
import math
import os
import subprocess

import bmesh
import bpy
from mathutils import Vector

import prop_empreendedor_base as B
from prop_financeiro_direita import tubo

MM, P_ROSCA = 0.001, 3.629
C = {'vidro': '#f2eadb', 'haste': '#e8dfcf', 'fio': '#8a847d', 'filamento': '#3f352d', 'rosca': '#c9c6c0',
     'isolante': '#141414', 'contato': '#a88c5f'}
N_FIO = [0]                                        # faces da malha de luz antes do vidro (filamento, haste, fios)
LUZ_2700K = '#ffb46b'


def _mm(p):
    return p * MM


def rosca(r, z, a):
    """Filete helicoidal redondo só na face externa da chapa (r ≥ 12), com entrada e saída suaves."""
    if r < 12.5 or not 7.2 <= z <= 25.8:
        return r
    f = min(1.0, (z - 7.2) / 1.4, (25.8 - z) / 1.4)
    return r + 0.8 * f * math.cos(2 * math.pi * z / P_ROSCA - a)


def metal_bm():
    bm = bmesh.new()
    contato = [(0, 0.0), (2.4, 0.15), (3.9, 0.6), (4.8, 1.3), (5.1, 2.1), (5.0, 2.6), (0, 2.6)]
    B.pintar(bm, B.torno(bm, contato, 24, mapa=_mm), C['contato'])
    isol = [(0, 2.0), (6.5, 2.0), (8.8, 2.3), (10.3, 3.0), (11.1, 4.0), (11.35, 5.2), (11.4, 6.8), (0, 6.8)]
    B.pintar(bm, B.torno(bm, isol, 28, mapa=_mm), C['isolante'])
    casca = [(10.9, 5.4), (11.8, 5.7), (12.3, 6.3), (12.7, 6.9)]
    casca += [(12.9, 7.2 + 0.45 * i) for i in range(42)]                # rosca: 0,45 mm por anel (~8 por passo)
    casca += [(13.0, 26.3), (13.3, 27.2), (13.05, 28.2), (12.6, 29.0), (12.1, 29.35), (11.8, 28.9), (11.6, 7.0)]
    B.pintar(bm, B.torno(bm, casca, 28, raio=rosca, mapa=_mm), C['rosca'])
    return bm


def _arco(x):                                      # linha média do filamento (mm): arco para cima entre os fios
    return 70.4 + 2.6 * (1 - (x / 9.0) ** 2)


def _fio(bm, pts, r, cor):
    n = len(bm.faces)
    tubo(bm, [_mm(Vector(p)) for p in pts], r * MM)
    B.pintar(bm, B.desde(bm, n), cor)


def luz_bm():
    bm = bmesh.new()
    haste = [(0, 24.0), (10.4, 24.5), (9.6, 27.0), (6.8, 31.0), (4.4, 36.0), (3.1, 42.0), (2.7, 47.0), (3.4, 49.5),
             (3.8, 52.0), (3.3, 54.5), (1.2, 55.2), (0, 55.3)]
    prensa = lambda r, z, a: r * (1 - 0.5 * abs(math.sin(a))) if z > 48.0 else r    # noqa: E731 (o prensado)
    B.pintar(bm, B.torno(bm, haste, 24, raio=prensa, mapa=_mm), C['haste'])
    bastao = [(0, 54.8), (0.7, 54.8), (0.7, 62.4), (1.6, 62.6), (1.8, 63.3), (1.2, 63.9), (0, 64.0)]
    B.pintar(bm, B.torno(bm, bastao, 12, mapa=_mm), C['haste'])
    for s in (-1, 1):
        _fio(bm, [(s * 1.6, 0, 53.0), (s * 2.2, 0, 55.5), (s * 5.0, 0, 61.0), (s * 8.4, 0, 67.0), (s * 9.3, 0, 70.3)],
             0.3, C['fio'])
        xg = 4.5
        _fio(bm, [(s * 1.4, 0, 63.2), (s * 3.0, 0, 66.5), (s * xg, 0, _arco(xg) - 0.9), (s * xg, 0.5, _arco(xg)),
                  (s * xg, 0, _arco(xg) + 0.4)], 0.17, C['fio'])
    pts, voltas, k = [], 20, 8
    for i in range(voltas * k + 1):
        u = i / (voltas * k)
        x = -9.0 + 18.0 * u
        c = Vector((x, 0, _arco(x)))
        t = Vector((1, 0, -2 * 2.6 * x / 81.0)).normalized()
        n1 = Vector((0, 1, 0))
        n2 = t.cross(n1)
        th = 2 * math.pi * voltas * u
        pts.append(c + 0.7 * (math.cos(th) * n1 + math.sin(th) * n2))
    _fio(bm, pts, 0.17, C['filamento'])
    N_FIO[0] = len(bm.faces)
    # Bulbo A60 (mm): pescoço no friso da rosca, pera até Ø 60 a z 73, cúpula até 108; parede de 0,7 mm.
    fora = [(11.2, 24.0), (11.9, 27.0), (12.3, 29.5), (13.2, 33.0), (15.5, 38.0), (19.5, 44.0), (23.5, 50.0),
            (26.8, 56.0), (29.0, 62.0), (29.9, 68.0), (30.0, 73.0)]
    fora += [(30.0 * math.cos(a), 76.0 + 32.0 * math.sin(a)) for a in (math.radians(g) for g in range(10, 90, 10))]
    dentro = [(max(0.0, r - 0.7), z - 0.5 if z > 73 else z) for r, z in fora]
    perfil = [(0, 107.3)] + dentro[::-1] + fora + [(0, 108.0)]
    B.pintar(bm, B.torno(bm, perfil, 32, mapa=_mm), C['vidro'])
    return bm


def lampada(mats):
    metal, luz = mats('metal', 1.0, 0.35), mats('luz', 0.0, 0.3)
    b = next(n for n in luz.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Emission Color'].default_value = (0, 0, 0, 1)            # apagada no glb: o site acende
    b.inputs['Emission Strength'].default_value = 0.0
    return [B.objeto('lampada_metal', metal_bm(), metal, ang=60), B.objeto('lampada_luz', luz_bm(), luz, ang=50)]


# ---- provas (Blender, cena A montada) ----
PASTA = '3d/captura/props/empreendedor/v5/lampada'


def acender(mat, forca):
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    import prop_financeiro_v6 as v6
    b.inputs['Emission Color'].default_value = v6.srgb(LUZ_2700K) if forca else (0, 0, 0, 1)
    b.inputs['Emission Strength'].default_value = forca


def _close(objs, arq, amostras=64):
    """Câmera ortográfica com a orientação da câmera do site, enquadrando só a lâmpada."""
    sc = bpy.context.scene
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    ctr = sum(pts, Vector()) / len(pts)
    alt = max(p.z for p in pts) - min(p.z for p in pts)
    cam_s = sc.camera
    cam = bpy.data.objects.new('cam_close', bpy.data.cameras.new('cam_close'))
    sc.collection.objects.link(cam)
    cam.data.type, cam.data.ortho_scale, cam.data.clip_end = 'ORTHO', alt * 1.25, 10
    cam.matrix_world = cam_s.matrix_world.copy()
    fwd = cam.matrix_world.to_3x3() @ Vector((0, 0, -1))
    cam.location = ctr - fwd * 1.0
    sc.camera, sc.render.resolution_x, sc.render.resolution_y = cam, 440, 520
    sc.cycles.samples, sc.render.filepath = amostras, arq
    bpy.ops.render.render(write_still=True)
    sc.camera = cam_s
    bpy.data.objects.remove(cam)
    return arq


def _render(tela, arq, amostras=48):
    import prop_empreendedor_cena as cena
    cam = cena._cam(tela)
    sc = bpy.context.scene
    sc.camera, sc.cycles.samples, sc.render.filepath = cam, amostras, arq
    bpy.ops.render.render(write_still=True)
    return cam


def _caixa(arq, cx, zonas):
    cmd = [arq, '-fill', 'none', '-strokewidth', '2']
    for b in zonas:
        cmd += ['-stroke', '#d02020', '-draw', 'rectangle %d,%d %d,%d' % tuple(b)]
    cmd += ['-stroke', '#22c55e', '-draw', 'rectangle %d,%d %d,%d' % tuple(cx), arq]
    subprocess.run(['convert', *cmd], check=True)


def _rot(src, dst, geo, texto, extra=()):
    subprocess.run(['convert', src, *extra, '-resize', geo, '-background', '#141414', '-gravity', 'north', '-splice',
                    '0x24', '-gravity', 'northwest', '-fill', '#f0f0f0', '-pointsize', '15', '-annotate', '+6+4',
                    texto, dst], check=True)
    return dst


def rodar(construir, tris, glb_animado):
    import comum
    import prop_empreendedor_cena as cena
    import prop_empreendedor_cena_metricas as met
    import prop_empreendedor_movimento_prova as mp
    import prop_financeiro_v6 as v6
    v6.reset()
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new('Mundo')
    raiz_t, pecas = cena.montar('a', construir)
    lp = pecas['lampada']
    bu = [o for o in comum.importar_busto() if o.type == 'MESH']
    med = cena.medir(pecas, bu, next(o for o in bu if o.name == 'Busto'))
    sem = dict(med, pecas={k: v for k, v in med['pecas'].items() if k != 'lampada'})
    cel = ('lampada', 'sup', 'notebook', 'kanban', 'foguete')             # o celular esconde cartoes, beliche, bolo
    comp = {'com': met.composicao(med, cena.ZONAS, cena.CABECA), 'sem': met.composicao(sem, cena.ZONAS, cena.CABECA),
            '360_com': met.composicao(dict(med, pecas={k: med['pecas'][k] for k in cel}), cena.ZONAS, cena.CABECA,
                                      ('360x740',)),
            '360_sem': met.composicao(dict(med, pecas={k: med['pecas'][k] for k in cel[1:]}), cena.ZONAS,
                                      cena.CABECA, ('360x740',))}
    lam = {}
    for tela in comum.TELAS:
        cx = med['pecas']['lampada'][tela]['caixa']
        W = int(tela.split('x')[0])
        ind = cena.ZONAS[tela].get('indicador') or cena.ZONAS[tela].get('cabecalho')
        lam[tela] = {'caixa': cx, 'h_px': cx[3] - cx[1], 'h_cabeca': med['pecas']['lampada'][tela]['h_cabeca'],
                     'borda_cima_px': cx[1], 'vao_cabeca_px': med['busto'][tela][1] - cx[3],
                     'centro_x_menos_cranio_px': round((cx[0] + cx[2]) / 2 - {1440: 1013, 1024: 721, 360: 182}[W]),
                     'vao_ui_px': met._dist(cx, ind) if ind else -1, 'viol_lampada': [v for v in med['violacoes'][tela]
                                                                      if v.startswith('lampada')],
                     'viol_todas': med['violacoes'][tela]}
    enc = cena.encoberto({'lampada': lp}, bu)
    orc = {'tris_lampada': tris(lp['objs']), 'n_fio': N_FIO[0],
           'malhas': {o.name: len(o.data.polygons) for o in lp['objs']}, 'escala': lp['escala'],
           'raiz_gl': lp['raiz_gl']}
    pasta = os.path.join(v6.ROOT, PASTA)
    os.makedirs(pasta, exist_ok=True)
    j = lambda n: os.path.join(pasta, n)    # noqa: E731
    # Renders: cena acesa (estado final) no 1440 e no 360 com o busto; close apagada, acesa e sem o vidro.
    v6.studio()
    luz = bpy.data.materials['lampada_luz']
    acender(luz, 4.0)
    for tela, nome in (('1440x900', 'cena-1440.png'), ('360x740', 'cena-360.png')):
        cam = _render(tela, j(nome))
        z = [b for k, b in cena.ZONAS[tela].items() if k in ('indicador', 'cabecalho')]
        _caixa(j(nome), med['pecas']['lampada'][tela]['caixa'], z)
        if tela == '1440x900':
            b = med['pecas']['lampada'][tela]['caixa']
            subprocess.run(['convert', j(nome), '-crop', '%dx%d+%d+%d' % (b[2] - b[0] + 80, b[3] - b[1] + 60,
                                                                           b[0] - 40, b[1] - 30),
                            '+repage', '-scale', '200%', j('real-1440-2x.png')], check=True)
    for o in bu + [x for p in pecas.values() for x in p['objs'] if x not in lp['objs']]:
        o.hide_render = True
    ol = next(o for o in lp['objs'] if o.name == 'lampada_luz')
    acender(luz, 0.0)
    _close(lp['objs'], j('close-apagada.png'))
    acender(luz, 4.0)
    _close(lp['objs'], j('close-acesa.png'))
    bm = bmesh.new()
    bm.from_mesh(ol.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in range(N_FIO[0], len(bm.faces))], context='FACES')
    corte = bpy.data.objects.new('lampada_corte', bpy.data.meshes.new('lampada_corte'))
    bm.to_mesh(corte.data)
    corte.data.materials.append(luz)
    bpy.context.scene.collection.objects.link(corte)
    corte.matrix_world, ol.hide_render = ol.matrix_world.copy(), True
    _close(lp['objs'], j('close-sem-vidro.png'))
    acender(luz, 0.0)
    # glb animado: prova_json, orçamento e estado final das outras peças contra o glb de produção.
    ok_json = mp.prova_json(glb_animado)
    info = mp.ler_glb(glb_animado)
    fim = mp.estado_final(glb_animado, 30)
    out = {'lampada': lam, 'composicao': comp, 'encoberto': enc, 'orcamento_lampada': orc,
           'glb': dict(info, kB=round(os.path.getsize(glb_animado) / 1024, 1),
                       arq=os.path.relpath(glb_animado, v6.ROOT)),
           'prova_json_ok': ok_json, 'estado_final': fim}
    with open(j('medidas.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1, default=str)
    print('LAMPADA', json.dumps(lam))
    print('RAZAO', {k: {t: m['razao_area'] for t, m in v.items()} for k, v in comp.items()})
    print('ENCOBERTO', enc, 'ORC', orc)
    print('GLB', out['glb']['kB'], 'kB prim', info['primitivas'], 'PROVA_JSON', ok_json)
    pior = max(v['mm'] for v in fim['nos'].values()), max(v['graus'] for v in fim['nos'].values())
    print('NOS', pior, 'MALHAS', max(fim['malhas_mm'].values()))
    folha(j, lam, comp, out, pior)


def folha(j, lam, comp, out, pior):
    t = '/data/tmp/lamp-'
    l1 = [_rot(j('close-apagada.png'), t + 'a.png', '330x', 'close apagada (glb: emissivo preto)'),
          _rot(j('close-acesa.png'), t + 'b.png', '330x', 'acesa simulada (2700 K, so no render)'),
          _rot(j('close-sem-vidro.png'), t + 'c.png', '330x', 'sem o vidro: filamento, suportes, haste'),
          _rot(j('real-1440-2x.png'), t + 'd.png', 'x414', 'pixels reais do 1440, 2x (acesa)')]
    ln = ['LAMPADA (E14) - medidas', '']
    for tela, m in lam.items():
        ln += ['%s caixa %s  h %d px = %.2f cab' % (tela, m['caixa'], m['h_px'], m['h_cabeca']),
               '   borda cima %d  vao cabeca %d  vao UI %.0f  centro-cranio %+d px' % (
                   m['borda_cima_px'], m['vao_cabeca_px'], m['vao_ui_px'], m['centro_x_menos_cranio_px']),
               '   violacoes lampada: %s' % (m['viol_lampada'] or 'nenhuma')]
    for k in ('sem', 'com', '360_sem', '360_com'):
        ln.append('razao area pecas/busto %-7s ' % k + '  '.join('%s %.3f' % (tl.split('x')[0], m['razao_area'])
                                                                for tl, m in comp[k].items()))
    g = out['glb']
    ln += ['', 'glb animado %.1f kB  primitivas %d  materiais %d' % (g['kB'], g['primitivas'], g['materiais']),
           'prova_json: %s   clip %s' % ('OK' if out['prova_json_ok'] else 'FALHA', g['clips']),
           'outras pecas x glb producao: nos %.4f mm %.4f grau' % pior,
           'malhas (pior vertice) %.4f mm' % max(out['estado_final']['malhas_mm'].values()),
           'encoberto pelo busto: %s' % out['encoberto']['lampada']]
    subprocess.run(['convert', '-size', '560x560', 'xc:#141414', '-fill', '#f0f0f0', '-pointsize', '13',
                    '-annotate', '+10+18', '\n'.join(ln), t + 't.png'], check=True)
    l2 = [_rot(j('cena-1440.png'), t + 'e.png', '880x', 'cena A, camera do 1440 (acesa; verde = lampada)'),
          _rot(j('cena-360.png'), t + 'f.png', 'x550', 'celular 360'), t + 't.png']
    for n, lista in (('l1', l1), ('l2', l2)):
        subprocess.run(['montage', *lista, '-tile', '%dx' % len(lista), '-geometry', '+4+4', '-background', '#0c0c0c',
                        t + n + '.png'], check=True)
    arq = j('folha-lampada.png')
    subprocess.run(['convert', t + 'l1.png', t + 'l2.png', '-background', '#0c0c0c', '-gravity', 'center', '-append',
                    '-resize', '1568x>', arq], check=True)
    print('FOLHA', arq)
