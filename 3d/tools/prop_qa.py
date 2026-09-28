"""Adereço da vida `qa` ("QA Analyst"), volta 1: receita ÚNICA forma + material (FICHA-PRODUCAO; REQUISITOS Q1–Q8 e
CONCEITO v2 E1, E6, E7). E3 (rastro) e E5 (anel de alerta) são procedurais no site.

Headless (fonte de verdade, reprodutível):
    TMPDIR=<pasta temporária> blender -b --python 3d/tools/prop_qa.py -- \
        [glb=3d/export/props/qa.glb] [blend=3d/blend/props/qa_v1.blend|0] [provas=3d/captura/props/qa/v1/blender|0]

glb (espaço do S13: Y para cima, +Z para a câmera, +X = esquerda do Fael). Raiz `qa` →
  `qa_bug` (EMPTY no centro de massa; frente do bug = +Z local, dorso = +Y local) → `qa_bug_corpo` (malha),
      `qa_bug_elitro_esq|dir` (EMPTY no pivô da articulação) → `_malha`; `qa_bug_asa_esq|dir` (EMPTY na raiz) →
      `_malha` (chave `voo`); `qa_bug_patas` (EMPTY no centro de massa) → `qa_bug_patas_malha` (chave `voo`).
      Base = POUSO/captura (élitros fechados, asas dobradas, patas abertas); `voo` = 1 abre as asas e encolhe as patas.
  `qa_lupa_mao` (EMPTY no CENTRO DA LENTE; eixos da lupa: +Z normal da lente, −Y = cabo)
      → `qa_lupa` (EMPTY no centro da lente) → `qa_lupa_malha` (latão + nogueira), `qa_lupa_lente` (vidro)
      → `qa_mao` (só com mao=1; padrão SEM mão, Q19) → `qa_mao_malha` (pele), `qa_mao_unhas`
  `qa_caixa` (EMPTY no centro da aresta de apoio na mesa) → `qa_caixa_malha`, `qa_caixa_vidro`
Cada nó com nome da ficha é EMPTY e a malha vai num filho `_malha` (a quantização do otimizar.mjs põe a
desquantização no TRS do nó da malha: pivô e filhos ficam intactos só assim). 2ª UV `Fade` (TEXCOORD_1.x) em todas
as malhas: 1 visível; na mão, 0 no antebraço antes da borda de baixo. Expressão da vida: browDown 0,5 (Q7).
"""
import os
import subprocess
import sys

import bpy
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_qa_util as U  # noqa: E402  (antes da pele: troca o temporário do B.imagem)
import prop_qa_bug as BG  # noqa: E402
import prop_qa_caixa as CX  # noqa: E402
import prop_qa_lupa as LP  # noqa: E402
import prop_qa_mao as QM  # noqa: E402
import prop_qa_tex as TX  # noqa: E402
import prop_uber_pele as PL  # noqa: E402
import prop_uber_unha as UN  # noqa: E402
import prop_vela_base as B  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
MAO = ARGS.get('mao', '0') == '1'          # Q19 (FICHA v2): sem mão; mao=1 remonta a mão da v2
H_NO_PADRAO = 0.2063                       # nó do cabo da v2 (medido pela pegada): a lupa sai idêntica sem a mão
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/qa.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/qa_v1.blend')
TEX = os.path.join(ROOT, '3d/captura/props/qa/v1/blender/texturas')
FOCO = dict(browDownLeft=0.5, browDownRight=0.5)
FADE_MAO = (-0.012, 0.018)                 # t (m além da prega do punho): 0 → fundo, 1 → visível
LENTE = np.array((-0.145, 0.140, 0.045))   # ponto de captura padrão (o site move `qa_lupa_mao`)
CAIXA = np.array((0.125, -0.045, 0.085))   # aresta de apoio padrão (o site ancora na mesa, `qa_mesa`)
CAIXA_GIRO = -20.0                         # graus em Y: a face vira para o centro e a câmera
ANTEBRACO = U.unit((-0.30, -0.65, -0.70))  # para baixo, para trás e para fora (−X)
DORSO = U.unit((-0.7, 0.0, 0.7))
ELITRO_ABERTO = BG.ELITRO_ABERTO


def quadros():
    z = U.unit(np.array((0.0, 0.20, 1.05)) - LENTE)                 # lente de frente para a câmera do site
    y = U.unit(np.array((0.35, 1.0, 0.0)) - z * (np.array((0.35, 1.0, 0.0)) @ z))    # cabo desce para fora (−X)
    x = np.cross(y, z)
    M_lupa = U.quadro(LENTE, x, y, z)
    M_bug = U.quadro(LENTE - z * 0.012, -x, z, y)                  # bug preso sob a lente: dorso para a câmera
    g = np.radians(CAIXA_GIRO)
    M_caixa = U.quadro(CAIXA, (np.cos(g), 0, -np.sin(g)), (0, 1, 0), (np.sin(g), 0, np.cos(g)))
    return M_lupa, M_bug, M_caixa


def _T(v):
    M = np.eye(4)
    M[:3, 3] = v
    return M


def _sm(e0, e1, x):
    t = np.clip((np.asarray(x) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _malha_no(nome, pai, M, ob):
    no = U.vazio(nome, pai, M)
    ob.matrix_world = U.m_bl(M)
    U.pendurar(ob, no)
    return no


def bug(raiz, mats, M_bug, p=None):
    p = p or dict(BG.BASE)
    no = U.vazio('qa_bug', raiz, M_bug)
    objs = [no]
    m = U.Malha()
    m.xf = _T(-BG.COM)
    BG.corpo(m, p)
    c = m.objeto('qa_bug_corpo', mats['rigido'], ang=40)
    c.matrix_world = U.m_bl(M_bug)
    U.pendurar(c, no)
    objs.append(c)
    for lado, s in (('esq', 1), ('dir', -1)):
        pv = BG.pivo_elitro(s)
        m = U.Malha()
        m.xf = _T(-BG.COM - pv)
        BG.elitro(m, p, s)
        e = m.objeto('qa_bug_elitro_%s_malha' % lado, mats['rigido'], ang=40)
        objs += [_malha_no('qa_bug_elitro_' + lado, no, M_bug @ _T(pv), e), e]
        ra = BG.raiz_asa(s)
        grades = {}
        for estado in ('pouso', 'voo'):
            m = U.Malha()
            m.xf = _T(-BG.COM - ra)
            P, uv = BG.asa(p, s, estado)
            m.grade(P, uv, '#ffffff')
            grades[estado] = m
        a = grades['pouso'].objeto('qa_bug_asa_%s_malha' % lado, mats['asa'], ang=60, normais=False, cor=False)
        U.chave_forma(a, 'voo', [v.co.copy() for v in grades['voo'].bm.verts])
        objs += [_malha_no('qa_bug_asa_' + lado, no, M_bug @ _T(ra), a), a]
    ms = {}
    for estado in ('pouso', 'voo'):
        ms[estado] = U.Malha()
        ms[estado].xf = _T(-BG.COM)
        BG.patas(ms[estado], p, estado)
    pt = ms['pouso'].objeto('qa_bug_patas_malha', mats['rigido'], ang=50, normais=False)
    U.chave_forma(pt, 'voo', [v.co.copy() for v in ms['voo'].bm.verts])
    objs += [_malha_no('qa_bug_patas', no, M_bug, pt), pt]
    return objs


def lupa_so(raiz, mats, M_lupa):
    """Q19: `qa_lupa_mao` (centro da lente) → só `qa_lupa` (mesma origem e eixos) → malha e lente."""
    rig, info = LP.rigido(mats['rigido'], H_NO_PADRAO)
    lente = LP.lente(mats['lente'])
    no = U.vazio('qa_lupa_mao', raiz, M_lupa)
    lu = _malha_no('qa_lupa', no, M_lupa, rig)
    lente.matrix_world = U.m_bl(M_lupa)
    U.pendurar(lente, lu)
    return [no, lu, rig, lente], {'lupa': info}


def lupa_mao(raiz, mats, M_lupa, busto):
    if not MAO:
        return lupa_so(raiz, mats, M_lupa)
    x, y, z, o = M_lupa[:3, 0], M_lupa[:3, 1], M_lupa[:3, 2], M_lupa[:3, 3]
    ob, d = QM.construir(np.array(U.bl(o)), np.array(U.bl(y)), LP.RG, LP.H_VIROLA, np.array(U.bl(ANTEBRACO)),
                         np.array(U.bl(DORSO)))
    n0 = len(ob.data.polygons)
    QM.reduzir(d)
    print('REDUZIR mao', n0, '→', len(ob.data.polygons), 'faces')
    PL.uv_maos([ob])
    rig, info = LP.rigido(mats['rigido'], d['h_no'])
    lente = LP.lente(mats['lente'])
    for o_ in (rig, lente):
        o_.matrix_world = U.m_bl(M_lupa)
    bpy.context.view_layer.update()
    import bmesh
    from mathutils.bvhtree import BVHTree
    bmw = bmesh.new()
    for o_ in (ob, rig):
        t = bmesh.new()
        t.from_object(o_, bpy.context.evaluated_depsgraph_get())
        t.transform(o_.matrix_world)
        me = bpy.data.meshes.new('_oc')
        t.to_mesh(me)
        bmw.from_mesh(me)
        bpy.data.meshes.remove(me)
        t.free()
    d['ao'] = PL.oclusao(ob, BVHTree.FromBMesh(bmw))
    bmw.free()
    cor, orm, nrm = PL.texturas([d], busto, TEX)
    for img, nome in ((cor, 'qa_pele_cor'), (orm, 'qa_pele_orm'), (nrm, 'qa_pele_normal')):
        img.name = nome
    ob.data.materials.append(B.material('qa_pele', 0.0, 0.58, cor_base=cor, orm=orm, normal=nrm, vcor=False))
    U.fade(ob, _sm(*FADE_MAO, d['mao'].t))
    UN.NS, UN.NQ = 7, 5                                  # placa mais leve (orçamento web)
    un = UN.construir(d, 'qa_mao_unhas', B.material('qa_unha', 0.0, 0.40))
    no = U.vazio('qa_lupa_mao', raiz, M_lupa)
    lu = _malha_no('qa_lupa', no, M_lupa, rig)
    U.pendurar(lente, lu)
    Qg = np.array((d['Q'][0], d['Q'][2], -d['Q'][1]))
    M_mao = U.quadro(Qg, x, y, z)
    mn = U.vazio('qa_mao', no, M_mao)
    for o_ in (ob, un):
        U.pendurar(o_, mn)
    d['lupa'] = info
    d['M_mao'] = M_mao
    return [no, lu, rig, lente, mn, ob, un], d


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    busto.pose(**FOCO)
    mats = TX.materiais(TEX)
    M_lupa, M_bug, M_caixa = quadros()
    raiz = U.vazio('qa')
    raiz['fade'] = {'uv': 'Fade (TEXCOORD_1.x)', 'mao_t': list(FADE_MAO), 'resto': 1.0}
    raiz['estados'] = {'base': 'pouso/captura', 'chave': 'voo (qa_bug_asa_*_malha, qa_bug_patas_malha)',
                       'elitro_aberto_graus_XZ': ELITRO_ABERTO}
    objs = [raiz] + bug(raiz, mats, M_bug)
    lm, d = lupa_mao(raiz, mats, M_lupa, busto)
    objs += lm
    cx, med_cx = CX.construir(mats)
    nc = U.vazio('qa_caixa', raiz, M_caixa)
    for o in cx:
        o.matrix_world = U.m_bl(M_caixa)
        U.pendurar(o, nc)
    objs += [nc] + cx
    for o in objs:
        if o.type == 'MESH' and 'Fade' not in o.data.uv_layers:
            U.fade(o)
    return busto, objs, d, med_cx, (M_lupa, M_bug, M_caixa)


def main():
    busto, objs, d, med_cx, quadros_ = construir()
    bpy.context.view_layer.update()
    comum.exportar_glb(objs, GLB, otimizar=True)
    print('GLB', GLB, round(os.path.getsize(GLB) / 1024, 1), 'kB')
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT)
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        busto.pose()                                      # .blend no neutro
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
        busto.pose(**FOCO)
    if ARGS.get('provas', '0') != '0':
        import prop_qa_prova as prova
        prova.rodar(busto, objs, d, med_cx, quadros_, ARGS['provas'], GLB)


if __name__ == '__main__':
    main()
