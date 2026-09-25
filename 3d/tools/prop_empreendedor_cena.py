"""Cena do "Entrepreneur", volta 3: COMPOSIÇÃO (E11 lista exata, E12 composição e tamanhos do estúdio).

Chamado pela receita: blender -b --python 3d/tools/prop_empreendedor.py -- cena=a|b [provas=0]
Monta as 7 peças do E11 com os construtores do registro CANDIDATOS (sem remodelar), cada uma com transformação própria,
sob a raiz `emp_todos` (um nó por peça, nomeado pelo id), e exporta `3d/export/props/lab/emp_todos_<a|b>.glb` (Draco,
como o `financeiro_direita.glb` de produção). Medidas e provas em `3d/captura/props/empreendedor/v3/composicao/`.

Layout em px CSS do 1440×900 (a câmera do site é a mesma nas 3 telas, só muda o recorte: o 1024 e o 360 são o 1440
escalado em torno da origem do busto, logo quem cabe no 1440 respeitando o texto do 1024 cabe nos dois):
    id: (centro x px, base y px, profundidade Y do Blender em m [− = mais perto da câmera], giro Z rad,
         altura-alvo em cabeças de 539 px, espelho em X)
O espelho vale para peças do lado direito (as peças nasceram para a esquerda, +X para a cabeça); o leque nunca espelha.
"""
import json
import os
import subprocess

import bpy
from mathutils.bvhtree import BVHTree

import comum
import prop_financeiro_v6 as v6
from prop_financeiro_direita_prova import caixa_px

PECAS = ('sup', 'bolo', 'beliche', 'notebook', 'kanban', 'cartoes', 'foguete')
FALA = {'sup_deckpad', 'notebook_vinil', 'kanban_papel', 'cartoes_leque'}   # o que comunica: nunca encoberto
PROPOSTAS = {
    # A, "J da jornada": o passado desce pela esquerda (SUP em pé) e corre por baixo do queixo (beliche, bolo);
    # o presente sobe pela direita (notebook e o foguete saindo dele); kanban atrás, no alto à direita; leque na frente.
    'a': {'sup': (722, 606, 0.04, 0.45, 0.80, False),
          'cartoes': (782, 880, -0.16, 0.12, 0.49, False),
          'beliche': (1000, 880, -0.06, 1.2, 0.28, False),
          'bolo': (1138, 880, -0.08, 0.6, 0.18, False),
          'notebook': (1306, 792, -0.02, -1.1, 0.30, True),
          'foguete': (1322, 612, 0.0, -0.6, 0.38, True),
          'kanban': (1236, 352, 0.18, -0.3, 0.46, False)},
    # B, "o presente ao lado do texto": notebook e foguete na coluna entre o texto e a cabeça, o kanban atrás dela no
    # alto à esquerda; o passado reunido à direita (SUP alto, beliche ao pé, bolo à altura do queixo); leque na frente.
    'b': {'kanban': (792, 340, 0.18, 0.3, 0.45, False),
          'foguete': (700, 448, 0.0, 0.6, 0.36, False),
          'notebook': (742, 608, -0.02, 1.1, 0.25, False),
          'cartoes': (782, 880, -0.16, 0.12, 0.49, False),
          'sup': (1342, 632, 0.04, -0.45, 0.82, True),
          'beliche': (1292, 800, -0.04, -1.2, 0.30, True),
          'bolo': (1230, 622, -0.02, -0.6, 0.20, False)},
}
CABECA = {'1440x900': 539, '1024x768': 383, '360x740': 196}
ZONAS = {'1440x900': {'texto': (60, 280, 500, 600), 'indicador': (560, 55, 880, 75), 'github': (1355, 10, 1400, 42),
                      'contato': (1260, 820, 1410, 870)},
         '1024x768': {'texto': (60, 230, 455, 540), 'contato': (850, 690, 1010, 740)},
         '360x740': {'texto': (0, 340, 360, 740), 'cabecalho': (0, 0, 360, 55)}}
FOLGA_UI, BORDA = 8, 16
PASTA = '3d/captura/props/empreendedor/v3/composicao'


def _cam(tela):
    cam = comum.camera_site(tela, escala=1)
    bpy.context.view_layer.update()
    return cam


def colocar(raiz, objs, cam, spec):
    """Escala e desloca a raiz até a caixa no 1440 ter a altura-alvo, o centro x e a base y pedidos."""
    cx, base, prof, giro, alvo, esp = spec
    raiz.rotation_euler, raiz.location, s = (0, 0, giro), (0, prof, 0.15), 1.0
    for _ in range(7):
        raiz.scale = (-s if esp else s, s, s)
        bpy.context.view_layer.update()
        x0, y0, x1, y1 = caixa_px(cam, objs)
        ppm = 2000 * 1.05 / (1.05 + raiz.location.y)
        s *= alvo * CABECA['1440x900'] / (y1 - y0)
        raiz.location.x += (cx - (x0 + x1) / 2) / ppm
        raiz.location.z += (y1 - base) / ppm
    bpy.context.view_layer.update()
    return round(s, 4)


def montar(prop, construir):
    raiz_t = bpy.data.objects.new('emp_todos', None)
    bpy.context.scene.collection.objects.link(raiz_t)
    cam, pecas = _cam('1440x900'), {}
    for cid, spec in PROPOSTAS[prop].items():
        raiz, objs = construir(cid)
        for o in objs:
            if o.name == cid:              # a malha do leque se chama `cartoes`: o nó da peça leva o id
                o.name = cid + '_leque'
        raiz.name, raiz.parent = cid, raiz_t
        esc = colocar(raiz, objs, cam, spec)
        pecas[cid] = {'raiz': raiz, 'objs': objs, 'escala': esc, 'espelho': spec[5], 'giro': spec[3],
                      'raiz_gl': [round(raiz.location.x, 4), round(raiz.location.z, 4), round(-raiz.location.y, 4)]}
    bpy.data.objects.remove(cam)
    return raiz_t, pecas


def _bvh(o, dg):
    me = o.evaluated_get(dg).to_mesh()
    mw = o.matrix_world
    arv = BVHTree.FromPolygons([mw @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    o.evaluated_get(dg).to_mesh_clear()
    return arv


def encoberto(pecas, busto, passo=3):
    """Fração da área de cada malha (1ª superfície da peça em cada pixel do 1440) coberta pelo busto e por outras
    peças, por raio da câmera. A câmera do site tem o mesmo centro nas 3 telas: a fração vale para todas."""
    sc, dg = bpy.context.scene, bpy.context.evaluated_depsgraph_get()
    cam = _cam('1440x900')
    W, H = sc.render.resolution_x, sc.render.resolution_y
    fr = [cam.matrix_world @ c for c in cam.data.view_frame(scene=sc)]   # sup-dir, inf-dir, inf-esq, sup-esq
    orig = cam.matrix_world.translation.copy()
    arv_b = [_bvh(o, dg) for o in busto]
    arv = {o.name: (cid, _bvh(o, dg)) for cid, p in pecas.items() for o in p['objs']}
    res = {}
    for cid, p in pecas.items():
        x0, y0, x1, y1 = caixa_px(cam, p['objs'])
        cont = {o.name: [0, 0, 0] for o in p['objs']}
        for py in range(int(y0), int(y1) + 1, passo):
            for px in range(int(x0), int(x1) + 1, passo):
                alvo = fr[3] + (fr[0] - fr[3]) * ((px + 0.5) / W) + (fr[2] - fr[3]) * ((py + 0.5) / H)
                d = (alvo - orig).normalized()
                meu, outro = None, 1e9
                for nome, (dono, a) in arv.items():
                    h = a.ray_cast(orig, d)
                    if h[0] is None:
                        continue
                    if dono == cid:
                        if meu is None or h[3] < meu[1]:
                            meu = (nome, h[3])
                    else:
                        outro = min(outro, h[3])
                if meu is None:
                    continue
                c = cont[meu[0]]
                c[0] += 1
                db = min((h[3] for h in (a.ray_cast(orig, d) for a in arv_b) if h[0] is not None), default=1e9)
                c[1] += db < meu[1]
                c[2] += db >= meu[1] and outro < meu[1]
        res[cid] = {n: {'busto': round(c[1] / max(1, c[0]), 3), 'outras': round(c[2] / max(1, c[0]), 3),
                        'px': c[0] * passo * passo} for n, c in cont.items()}
    bpy.data.objects.remove(cam)
    return res


def _cruza(a, b, folga=0):
    return a[0] < b[2] + folga and a[2] > b[0] - folga and a[1] < b[3] + folga and a[3] > b[1] - folga


def medir(pecas, busto, bu):
    kb, base = bu.data.shape_keys.key_blocks, bu.data.shape_keys.key_blocks['Basis'].data
    boca = [bu.matrix_world @ base[i].co for i in range(len(base))
            if max((kb[k].data[i].co - base[i].co).length for k in ('mouthSmileLeft', 'mouthSmileRight')) > 0.0015]
    olhos = [o for o in busto if o.name.startswith(('Olho', 'Conj'))]
    med = {'busto': {}, 'rosto': {}, 'pecas': {cid: {} for cid in pecas}, 'violacoes': {}}
    for tela in comum.TELAS:
        cam = _cam(tela)
        W, H = bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y
        tmp = bpy.data.objects.new('boca_tmp', bpy.data.meshes.new('boca_tmp'))
        tmp.data.from_pydata(boca, [], [])
        bpy.context.scene.collection.objects.link(tmp)
        bpy.context.view_layer.update()
        rosto = {'olhos': [round(v) for v in caixa_px(cam, olhos)], 'boca': [round(v) for v in caixa_px(cam, [tmp])]}
        bpy.data.objects.remove(tmp)
        med['busto'][tela] = [round(v) for v in caixa_px(cam, busto, 7)]
        med['rosto'][tela] = rosto
        viol = []
        for cid, p in pecas.items():
            cx = [round(v) for v in caixa_px(cam, p['objs'])]
            for z, zb in list(ZONAS[tela].items()) + list(rosto.items()):
                if _cruza(cx, zb, 0 if z in rosto else FOLGA_UI):
                    viol.append('%s x %s' % (cid, z))
            if cx[0] < BORDA or cx[1] < BORDA or cx[2] > W - BORDA or cx[3] > H - BORDA:
                viol.append('%s x borda' % cid)
            med['pecas'][cid][tela] = {'caixa': cx, 'w_px': cx[2] - cx[0], 'h_px': cx[3] - cx[1],
                                       'h_cabeca': round((cx[3] - cx[1]) / CABECA[tela], 2)}
        med['violacoes'][tela] = viol
        bpy.data.objects.remove(cam)
    return med


def _overlay(arq, med, tela):
    cmd = [arq, '-fill', 'none', '-strokewidth', '2']
    for z, b in list(ZONAS[tela].items()) + list(med['rosto'][tela].items()):
        cmd += ['-stroke', '#d02020', '-draw', 'rectangle %d,%d %d,%d' % tuple(b)]
    for cid, m in med['pecas'].items():
        b = m[tela]['caixa']
        cmd += ['-stroke', '#15803d', '-draw', 'rectangle %d,%d %d,%d' % tuple(b),
                '-stroke', 'none', '-fill', '#15803d',
                '-pointsize', '15', '-annotate', '+%d+%d' % (b[0] + 2, b[1] + 14), cid, '-fill', 'none']
    subprocess.run(['convert', *cmd, arq], check=True)


def provas(prop, pecas, busto, med):
    pasta = os.path.join(v6.ROOT, PASTA)
    todos = [o for p in pecas.values() for o in p['objs']]
    for tela in ('1440x900', '1024x768'):
        cam = _cam(tela)
        arq = os.path.join(pasta, '%s-argila-%s.png' % (prop, tela.split('x')[0]))
        comum.render_argila(arq, todos + busto)
        _overlay(arq, med, tela)
        bpy.data.objects.remove(cam)
    v6.studio()
    cam = _cam('1440x900')
    sc = bpy.context.scene
    sc.cycles.samples = 64
    arq = os.path.join(pasta, '%s-material-1440.png' % prop)
    sc.render.filepath = arq
    bpy.ops.render.render(write_still=True)
    b = med['pecas']['cartoes']['1440x900']['caixa']
    subprocess.run(['convert', arq, '-crop', '%dx%d+%d+%d' % (b[2] - b[0] + 20, b[3] - b[1] + 20, b[0] - 10, b[1] - 10),
                    '+repage', '-scale', '200%', os.path.join(pasta, '%s-leque-1x2.png' % prop)], check=True)
    print('RENDER', arq)


def folha():
    p = os.path.join(v6.ROOT, PASTA)
    nomes = [('material-1440', 'material, camera do site 1440 (o que o visitante ve)'),
             ('argila-1440', 'argila 1440: verde = pecas, vermelho = texto/UI/olhos/boca'),
             ('argila-1024', 'argila 1024'), ('leque-1x2', 'leque: pixels do 1440 ampliados 2x')]
    if not all(os.path.exists(os.path.join(p, '%s-%s.png' % (k, n))) for k in 'ab' for n, _ in nomes):
        return None
    linhas = []
    for n, rot in nomes:
        t = []
        for k in 'ab':
            s = os.path.join('/data/tmp', 'cena-%s-%s.png' % (k, n))
            subprocess.run(['convert', os.path.join(p, '%s-%s.png' % (k, n)), '-resize', '770x' if n != 'leque-1x2'
                            else '770x420>', '-background', '#141414', '-gravity', 'north', '-splice', '0x26',
                            '-gravity', 'northwest', '-fill', '#f0f0f0', '-pointsize', '17', '-annotate', '+8+4',
                            '%s  %s' % (k.upper(), rot), s], check=True)
            t.append(s)
        s = os.path.join('/data/tmp', 'cena-linha-%s.png' % n)
        subprocess.run(['montage', *t, '-tile', '2x', '-geometry', '+6+4', '-background', '#0c0c0c', s], check=True)
        linhas.append(s)
    arq = os.path.join(p, 'folha-composicao.png')
    subprocess.run(['convert', *linhas, '-background', '#0c0c0c', '-append', '-resize', '1568x>', arq], check=True)
    print('FOLHA', arq)
    return arq


def rodar(prop, construir, tris, pasta_glb, com_provas=True):
    v6.reset()
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new('Mundo')
    raiz_t, pecas = montar(prop, construir)
    objs = [o for p in pecas.values() for o in [p['raiz']] + p['objs']]
    arq = os.path.join(pasta_glb, 'emp_todos_%s.glb' % prop)
    comum.exportar_glb([raiz_t] + objs, arq, draco=True)
    cru = os.path.join('/data/tmp', 'emp_todos_%s_sem_draco.glb' % prop)
    comum.exportar_glb([raiz_t] + objs, cru, draco=False)
    malhas = [o for p in pecas.values() for o in p['objs']]
    orc = {'glb': os.path.relpath(arq, v6.ROOT), 'kB': round(os.path.getsize(arq) / 1024, 1),
           'kB_sem_draco': round(os.path.getsize(cru) / 1024, 1), 'tris': tris(malhas),
           'chamadas': sum(len(o.data.materials) for o in malhas),
           'tris_peca': {cid: tris(p['objs']) for cid, p in pecas.items()}}
    print('ORCAMENTO', prop, json.dumps(orc))
    bu = [o for o in comum.importar_busto() if o.type == 'MESH']
    med = medir(pecas, bu, next(o for o in bu if o.name == 'Busto'))
    med['encoberto'] = encoberto(pecas, bu)
    med['orcamento'] = orc
    h = med['pecas']['cartoes']['1440x900']['h_px']
    med['leque_xheight_min_px_1440'] = round(3.8 * h / 142.7, 1)    # "Hostel": x-height 3,8 mm (arte), leque 142,7 mm
    chaves = ('raiz_gl', 'giro', 'escala', 'espelho')
    med['transformacoes'] = {cid: {k: p[k] for k in chaves} for cid, p in pecas.items()}
    esq = sum(m['1440x900']['w_px'] * m['1440x900']['h_px'] for m in med['pecas'].values()
              if (m['1440x900']['caixa'][0] + m['1440x900']['caixa'][2]) / 2 < 1008)
    tot = sum(m['1440x900']['w_px'] * m['1440x900']['h_px'] for m in med['pecas'].values())
    med['peso_esquerda'] = round(esq / tot, 2)
    pasta = os.path.join(v6.ROOT, PASTA)
    os.makedirs(pasta, exist_ok=True)
    arq_m = os.path.join(pasta, 'medidas.json')
    todas = json.load(open(arq_m, encoding='utf-8')) if os.path.exists(arq_m) else {}
    todas[prop] = med
    with open(arq_m, 'w', encoding='utf-8') as fh:
        json.dump(todas, fh, ensure_ascii=False, indent=1)
    for tela in comum.TELAS:
        print('MEDIDA', prop, tela, ' '.join('%s%s' % (c, m[tela]['caixa']) for c, m in med['pecas'].items()))
        print('VIOL', prop, tela, med['violacoes'][tela])
    print('ENCOBERTO', prop, json.dumps(med['encoberto']))
    print('LEQUE xh', med['leque_xheight_min_px_1440'], 'peso_esq', med['peso_esquerda'])
    if com_provas:
        provas(prop, pecas, bu, med)
        folha()
