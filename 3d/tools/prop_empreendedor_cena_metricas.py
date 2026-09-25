"""Métricas de composição da cena do "Entrepreneur" (volta 3b) e contato entre peças.

`composicao(med, zonas, cabeca)` lê as caixas em px de `medir()` (prop_empreendedor_cena.py) e devolve, por tela:
sobreposição entre peças (px²), menor vão entre pares (com o par), respiro ao texto, menor borda, razão área das peças ÷
área da caixa do busto, peso esquerda/direita (centro da peça antes ou depois do centro do busto) e desvio do centroide
de área em relação ao centro do busto (em cabeças). O par de CONTATO intencional (foguete saindo do notebook) fica fora
de sobreposição e vão e é relatado à parte. Python puro: roda também fora do Blender, sobre o medidas.json.

`topo(cam, objs, x0, x1)` e `fundo_topo(cam, objs)` (Blender) dão o y em px da silhueta mais alta de uma peça numa faixa
de x e a profundidade da borda de cima (para a peça que sai de outra ficar atrás dela).
"""
import itertools

CONTATO = ('foguete', 'notebook')


def _dist(a, b):
    dx = max(0, b[0] - a[2], a[0] - b[2])
    dy = max(0, b[1] - a[3], a[1] - b[3])
    return round((dx * dx + dy * dy) ** 0.5, 1)


def _inter(a, b):
    return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))


def composicao(med, zonas, cabeca, telas=('1440x900', '1024x768')):
    res = {}
    for tela in telas:
        W, H = (int(v) for v in tela.split('x'))
        cx = {cid: m[tela]['caixa'] for cid, m in med['pecas'].items()}
        bu = med['busto'][tela]
        area = {c: (b[2] - b[0]) * (b[3] - b[1]) for c, b in cx.items()}
        pares = [(a, b) for a, b in itertools.combinations(sorted(cx), 2) if {a, b} != set(CONTATO)]
        vao = min(((_dist(cx[a], cx[b]), '%s x %s' % (a, b)) for a, b in pares))
        txt = min(((_dist(b, zonas[tela]['texto']), c) for c, b in cx.items()))
        borda = min(((min(b[0], b[1], W - b[2], H - b[3]), c) for c, b in cx.items()))
        mx = (bu[0] + bu[2]) / 2
        tot = sum(area.values())
        esq = sum(a for c, a in area.items() if (cx[c][0] + cx[c][2]) / 2 < mx)
        gx = sum(a * (cx[c][0] + cx[c][2]) / 2 for c, a in area.items()) / tot
        gy = sum(a * (cx[c][1] + cx[c][3]) / 2 for c, a in area.items()) / tot
        f, n = cx[CONTATO[0]], cx[CONTATO[1]]
        res[tela] = {
            'sobreposicao_px2': sum(_inter(cx[a], cx[b]) for a, b in pares),
            'menor_vao_px': vao[0], 'menor_vao_par': vao[1],
            'respiro_texto_px': txt[0], 'respiro_texto_peca': txt[1],
            'menor_borda_px': borda[0], 'menor_borda_peca': borda[1],
            'area_pecas_px2': tot, 'area_busto_px2': (bu[2] - bu[0]) * (bu[3] - bu[1]),
            'razao_area': round(tot / ((bu[2] - bu[0]) * (bu[3] - bu[1])), 3),
            'peso_esq_dir': [round(esq / tot, 2), round(1 - esq / tot, 2)],
            'desvio_centroide_cab': [round((gx - mx) / cabeca[tela], 3),
                                     round((gy - (bu[1] + bu[3]) / 2) / cabeca[tela], 3)],
            'contato_%s_%s' % CONTATO: {'caixa_vao_y_px': n[1] - f[3], 'caixa_inter_px2': _inter(f, n)},
        }
    return res


def _proj(cam, objs):
    import bpy
    from bpy_extras.object_utils import world_to_camera_view
    sc, dg = bpy.context.scene, bpy.context.evaluated_depsgraph_get()
    W, H = sc.render.resolution_x, sc.render.resolution_y
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        for v in me.vertices:
            w = o.matrix_world @ v.co
            p = world_to_camera_view(sc, cam, w)
            yield p.x * W, (1 - p.y) * H, w
        o.evaluated_get(dg).to_mesh_clear()


def topo(cam, objs, x0, x1):
    """y em px do ponto mais alto da silhueta de `objs` entre x0 e x1 (a borda de cima da tampa sob o foguete)."""
    ys = [y for x, y, _ in _proj(cam, objs) if x0 <= x <= x1]
    return min(ys) if ys else min(y for _, y, _ in _proj(cam, objs))


def fundo_topo(cam, objs, faixa=0.12):
    """Profundidade (Y do Blender) mais funda da borda de cima de `objs` (os vértices no 12 % mais alto da caixa)."""
    pts = list(_proj(cam, objs))
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    return max(w.y for _, y, w in pts if y <= y0 + faixa * (y1 - y0))


def linhas(comp):
    """Texto curto das métricas para a folha."""
    out = []
    for tela, m in comp.items():
        c = m['contato_%s_%s' % CONTATO]
        out.append('%s: sobrep %d px2 | vao %.0f (%s) | texto %.0f | borda %d | area %.2f cab | esq/dir %.2f/%.2f | '
                   'centroide %+.3f cab | foguete-notebook caixa %+d px' % (
                       tela.split('x')[0], m['sobreposicao_px2'], m['menor_vao_px'], m['menor_vao_par'],
                       m['respiro_texto_px'], m['menor_borda_px'], m['razao_area'], m['peso_esq_dir'][0],
                       m['peso_esq_dir'][1], m['desvio_centroide_cab'][0], c['caixa_vao_y_px']))
    return out


def folha_a2(pasta, med):
    """Folha única da volta 3b (≤ 1568 px): material 1440 com o busto e argila 1024 com as caixas; embaixo o contato
    foguete × notebook e o leque ampliados (pixels do 1440) e as métricas antes → depois."""
    import os
    import subprocess
    tmp = '/data/tmp'
    j = lambda n: os.path.join(pasta, n)    # noqa: E731

    def rot(src, dst, larg, texto, extra=()):
        subprocess.run(['convert', src, *extra, '-resize', larg, '-background', '#141414', '-gravity', 'north',
                        '-splice', '0x26', '-gravity', 'northwest', '-fill', '#f0f0f0', '-pointsize', '16',
                        '-annotate', '+8+4', texto, dst], check=True)
        return dst
    f, n = med['pecas']['foguete']['1440x900']['caixa'], med['pecas']['notebook']['1440x900']['caixa']
    x0, y0, x1, y1 = min(f[0], n[0]) - 16, min(f[1], n[1]) - 16, max(f[2], n[2]) + 16, max(f[3], n[3]) + 16
    l1 = [rot(j('a2-material-1440.png'), tmp + '/a2-m.png', '770x', 'A2 material, camera do site 1440 (com o busto)'),
          rot(j('a2-argila-1024.png'), tmp + '/a2-a.png', '770x',
              'A2 argila 1024: verde = pecas, vermelho = texto/UI/olhos/boca')]
    l2 = [rot(j('a2-material-1440.png'), tmp + '/a2-c.png', 'x440', 'contato foguete x notebook (1440, 2x)',
              ['-crop', '%dx%d+%d+%d' % (x1 - x0, y1 - y0, x0, y0), '+repage', '-scale', '200%']),
          rot(j('a2-leque-1x2.png'), tmp + '/a2-l.png', 'x440', 'leque (1440, 2x)')]
    ant, dep = med.get('composicao_antes', {}), med['composicao']
    txt = ['ANTES (volta 3)'] + linhas(ant) + ['', 'DEPOIS (volta 3b)'] + linhas(dep)
    txt = '\n'.join(t.replace(' | ', '\n   ') if t else t for t in txt)
    subprocess.run(['convert', '-size', '600x660', 'xc:#141414', '-fill', '#f0f0f0', '-pointsize', '12',
                    '-annotate', '+10+18', txt, tmp + '/a2-t.png'], check=True)
    for nome, lista in (('l1', l1), ('l2', l2 + [tmp + '/a2-t.png'])):
        subprocess.run(['montage', *lista, '-tile', '%dx' % len(lista), '-geometry', '+6+4', '-background',
                        '#0c0c0c', tmp + '/a2-%s.png' % nome], check=True)
    arq = j('folha-a2.png')
    subprocess.run(['convert', tmp + '/a2-l1.png', tmp + '/a2-l2.png', '-background', '#0c0c0c', '-gravity', 'center',
                    '-append', '-resize', '1568x>', arq], check=True)
    print('FOLHA', arq)
    return arq
