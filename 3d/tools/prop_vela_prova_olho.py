"""Métrica da ficha (harmonização 2): contraste íris × esclera visto PELA lente ≥ 50 % do contraste sem óculos, no
1440 e no 1024, pela câmera do site.

Máscara por geometria: nas malhas Olho_D/Olho_E (as que o site gira com o ponteiro), faces a menos de 32° do polo da
frente do globo (−Y no repouso, girado junto no olhar) = íris/pupila; o resto do globo = esclera. Render de máscara
no Workbench (atributo de cor) com a armação por cima (pixel de aro não conta); o valor vem de dois Cycles (com e sem
óculos) no recorte dos olhos, 2×. A sombra do olho e a conjuntiva ficam fora dos dois renders (no site elas são
materiais próprios do rig.ts, sem equivalente fiel no Blender): mede-se o efeito da lente, que é o que a métrica pede.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector

import comum
import prop_financeiro_v6 as v6
from prop_financeiro_direita_prova import caixa_px

OLHOS = ('Olho_D_malha', 'Olho_E_malha')
FORA = ('Conj_D_malha', 'Conj_E_malha', 'Sombra_D_malha', 'Sombra_E_malha')


def _atributo(o, cor_face):
    me = o.data
    at = me.color_attributes.get('Mascara') or me.color_attributes.new('Mascara', 'BYTE_COLOR', 'CORNER')
    for p in me.polygons:
        c = cor_face(p)
        for li in p.loop_indices:
            at.data[li].color = c
    me.color_attributes.active_color = at
    me.color_attributes.render_color_index = list(me.color_attributes).index(at)
    me.color_attributes.active_color_index = me.color_attributes.render_color_index


def estudio():
    """Estúdio da v6 UMA vez (cada chamada de v6.studio acrescenta luzes); depois só volta ao Cycles."""
    if bpy.data.objects.get('Chave') is None:
        v6.studio()
    else:
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.view_settings.view_transform = 'AgX'


def apito(pasta, g, pele):
    """ADENDO 5: silhueta preta sobre branco do apito + cabo pendente (câmera do 1440, busto em cinza) e recorte 4× em
    material (Cycles). Devolve a caixa (px CSS 1440) do apito e do nó."""
    import subprocess
    sc = bpy.context.scene
    pend = [o for o in g['vela_apito'] if 'pendente' in o.name or 'corpo' in o.name]
    tudo = [o for o in g['vela_apito']]
    cam = comum.camera_site('1440x900', escala=1)
    bpy.context.view_layer.update()
    x0, y0, x1, y1 = caixa_px(cam, pend)
    corpo = caixa_px(cam, [o for o in pend if 'corpo' in o.name])
    no = caixa_px(cam, [o for o in pend if 'pendente' in o.name])
    sc.camera = cam
    arq = os.path.join(pasta, 'apito-silhueta-1440.png')
    comum.render_silhueta(arq, tudo, pele)
    m = 24
    subprocess.run(['convert', arq, '-crop', '%dx%d+%d+%d' % (x1 - x0 + 2 * m, y1 - y0 + 2 * m, x0 - m, y0 - m),
                    '+repage', '-filter', 'point', '-resize', '400%', arq], check=True)
    bpy.data.objects.remove(cam)
    cam = comum.camera_site('1440x900', escala=4)
    W, H = sc.render.resolution_x, sc.render.resolution_y
    estudio()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.use_border, sc.render.use_crop_to_border = True, True
    sc.render.border_min_x, sc.render.border_max_x = max(0, (x0 - m) / 1440), min(1, (x1 + m) / 1440)
    sc.render.border_min_y, sc.render.border_max_y = max(0, 1 - (y1 + m) / 900), min(1, 1 - (y0 - m) / 900)
    v6.only({o.name for o in pele + tudo})
    sc.render.filepath = os.path.join(pasta, 'apito-material-4x.png')
    bpy.ops.render.render(write_still=True)
    sc.render.use_border = False
    bpy.data.objects.remove(cam)
    r = lambda b: [round(v) for v in b]                                 # noqa: E731
    return {'pendente_e_apito_px_1440': r((x0, y0, x1, y1)), 'apito_px_1440': r(corpo), 'no_px_1440': r(no),
            'no_altura_px_1440': round(no[3] - no[1]), 'apito_altura_px_1440': round(corpo[3] - corpo[1])}


def _limpar(objs):
    for o in objs:
        at = o.data.color_attributes.get('Mascara')
        if at is not None:
            o.data.color_attributes.remove(at)


def _img(arq):
    img = bpy.data.images.load(arq, check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:]).reshape(h, w, 4)[::-1, :, :3]
    bpy.data.images.remove(img)
    return a


def medir(busto, oculos, pasta, telas=('1440x900', '1024x768')):
    pele = list(busto.malhas.values())
    olhos = [busto.malhas[n] for n in OLHOS]
    out = {}
    for tela in telas:
        cam = comum.camera_site(tela, escala=2)
        sc = bpy.context.scene
        W, H = sc.render.resolution_x, sc.render.resolution_y
        bpy.context.view_layer.update()
        x0, y0, x1, y1 = caixa_px(cam, olhos)
        pad = 0.25 * (x1 - x0)
        borda = (max(0, (x0 - pad) / W), min(1, (x1 + pad) / W), max(0, 1 - (y1 + pad) / H), min(1, 1 - (y0 - pad) / H))
        # Máscara: íris vermelho, esclera verde, pele e armação pretas.
        # Íris como objeto temporário (cópia das faces do polo da frente, 0,1 mm para fora), cor por objeto.
        import bmesh
        iris_objs = []
        for o in olhos:
            mw = o.matrix_world
            centro = sum((mw @ v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
            frente = (mw.to_3x3() @ Vector((0, -1, 0))).normalized()
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bm.transform(mw)
            fora = [f for f in bm.faces if (f.calc_center_median() - centro).normalized().dot(frente) <=
                    math.cos(math.radians(32))]
            bmesh.ops.delete(bm, geom=fora, context='FACES')
            for v in bm.verts:
                v.co += (v.co - centro).normalized() * 0.0001
            me = bpy.data.meshes.new('_iris')
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new('_iris_' + o.name, me)
            sc.collection.objects.link(ob)
            iris_objs.append(ob)
        preto = [o for o in pele if o not in olhos] + [o for o in oculos if 'armacao' in o.name]
        for o in preto:
            o.color = (0, 0, 0, 1)
        for o in olhos:
            o.color = (0, 1, 0, 1)
        for o in iris_objs:
            o.color = (1, 0, 0, 1)
        sh = comum._workbench('FLAT', 'OFF')
        sh.color_type = 'OBJECT'
        sc.render.use_border, sc.render.use_crop_to_border = True, True
        sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = borda
        arq_m = os.path.join(pasta, 'olho-mascara-%s.png' % tela)
        comum._render(arq_m, [o for o in pele if o.name not in FORA] + [o for o in oculos if 'armacao' in o.name]
                      + iris_objs)
        for ob in iris_objs:
            me = ob.data
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(me)
        m = _img(arq_m)
        iris = (m[..., 0] > 0.5) & (m[..., 1] < 0.5)
        escl = (m[..., 1] > 0.5) & (m[..., 0] < 0.5)
        # Cycles com e sem óculos (mesma luz de estúdio da prova).
        estudio()                                        # (o estúdio põe 900 × 900: volta à tela 2×)
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = W, H
        sc.cycles.samples = 64
        sc.render.use_border, sc.render.use_crop_to_border = True, True
        sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = borda
        val = {}
        for o in oculos:                                  # o site não tem mapa de sombra (nenhum castShadow no herói)
            o.visible_shadow = False
        for nome, vis in (('sem', []), ('com', list(oculos))):
            v6.only({o.name for o in pele if o.name not in FORA} | {o.name for o in vis})
            arq = os.path.join(pasta, 'olho-%s-%s.png' % (nome, tela))
            sc.render.filepath = arq
            bpy.ops.render.render(write_still=True)
            a = _img(arq)
            L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
            if L.shape != iris.shape:
                val[nome] = None
                continue
            val[nome] = float(L[escl].mean() - L[iris].mean())
        sc.render.use_border = False
        bpy.data.objects.remove(cam)
        razao = (val['com'] / val['sem']) if val.get('com') is not None and val.get('sem') else None
        out[tela] = {'contraste_sem': val.get('sem'), 'contraste_com': val.get('com'),
                     'razao': None if razao is None else round(razao, 3), 'passou': razao is not None and razao >= 0.5,
                     'px_iris': int(iris.sum()), 'px_esclera': int(escl.sum())}
        print('CONTRASTE', tela, out[tela])
    return out
