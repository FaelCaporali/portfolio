"""Medidas do robô da vida `ai` (tudo o que vai para medidas.json e para os extras do glb):
- olhar (analítico e conferido na cena), centro de massa, folgas dos servos (prop_ai_funcao.py);
- folga × pele do S13 nas poses do busto (neutra, sorriso inteiro, sorriso E/D, browInnerUp, browOuterUp E/D, browDown
  E/D, cada chave em 1,0) com a cabeça do robô na grade dos extremos dos servos e nos dois olhares;
- px pela câmera do site (1440 / 1024 / 360): topo da cabeça do robô × lábio inferior (neutra e sorriso), largura da
  tela no 1440, caixa do robô;
- `explodido_m` por peça: fora do quadro nas 3 telas e caminho reto até o encaixe sem passar a < 10 mm da pele.
"""
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

import comum
import prop_ai_funcao as F
import prop_ai_geo as G
import prop_techlead_prova as TP

POSES = TP.POSES
# peça → (ordem de montagem, deslocamento de partida no glb em m; 'normal_tampa' = ao longo da normal da tampa)
EXPLODIDO = {'ai_base': (1, (0.45, 0.0, 0.0)), 'ai_placa': (2, (0.40, 0.10, 0.0)), 'ai_corpo': (3, (0.0, 0.55, 0.0)),
             'ai_tampa': (4, 'normal_tampa'), 'ai_pescoco': (5, (0.0, 0.60, 0.0)),
             'ai_moldura': (6, (0.0, 0.65, 0.0)), 'ai_tela': (7, (0.40, 0.05, 0.0))}
MOVEIS = ('ai_suporte', 'ai_moldura', 'ai_tela')
FIXOS = ('ai_base', 'ai_corpo', 'ai_tampa', 'ai_placa')


def _verts(o, passo=1):
    mw = o.matrix_world
    vs = o.data.vertices
    return [mw @ vs[i].co for i in range(0, len(vs), passo)]


def folgas_pele(ctx):
    """mm reais, sem sinal (o robô fica todo abaixo do queixo e à frente/ao lado do pescoço): mínima por pose do busto
    sobre todas as configurações da cabeça do robô, e a peça/configuração do pior caso."""
    busto, obs, sol = ctx['busto'], ctx['obs'], ctx['sol']
    confs = [(g, i) for g in (-60, -30, 0, 30, 60) for i in (-15, 0, 30)] + [tuple(sol['camera']), tuple(sol['fael'])]
    fixos = {n: _verts(obs[n], 2) for n in FIXOS}
    moveis = {}
    for c in confs:
        F.pose(ctx, *c)
        moveis[c] = {n: _verts(obs[n], 2) for n in MOVEIS}
    out = {}
    for nome, ch in POSES:
        busto.pose(**ch)
        arv = busto.arvores['Busto_malha']
        pior = (9.0, '', '')
        for n, pts in fixos.items():
            d = min(arv.find_nearest(p)[3] for p in pts)
            pior = min(pior, (d, n, 'fixo'))
        for c, grupo in moveis.items():
            for n, pts in grupo.items():
                d = min(arv.find_nearest(p)[3] for p in pts)
                pior = min(pior, (d, n, '%+.0f/%+.0f' % c))
        out[nome] = {'min_mm': round(pior[0] / G.ESC * 1000, 1), 'peca': pior[1], 'giro/incl': pior[2]}
    busto.pose()
    F.pose(ctx, *sol['camera'])
    return out


def _px(cam, pts):
    sc = bpy.context.scene
    W, H = sc.render.resolution_x, sc.render.resolution_y
    q = [world_to_camera_view(sc, cam, p) for p in pts]
    return np.array([(v.x * W, (1 - v.y) * H, v.z) for v in q])


def px(ctx):
    busto, obs, sol = ctx['busto'], ctx['obs'], ctx['sol']
    idx, _ = TP.labios(busto)
    cabeca = [obs['ai_moldura'], obs['ai_tela']]
    tudo = list(obs.values())
    out = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        t = {}
        for nome, ch in POSES[:2]:
            busto.pose(**ch)
            vs = busto.bm_pele.verts
            vs.ensure_lookup_table()
            lab = _px(cam, [vs[int(i)].co for i in idx])
            t['labio_inferior_px_' + nome] = round(float(lab[:, 1].max()), 1)
        busto.pose()
        F.pose(ctx, *sol['camera'])
        topo = float(_px(cam, [p for o in cabeca for p in _verts(o)])[:, 1].min())
        t['topo_cabeca_robo_px'] = round(topo, 1)
        t['respiro_px'] = round(topo - max(t['labio_inferior_px_neutra'], t['labio_inferior_px_sorriso']), 1)
        piores = []
        for g in (-60, 0, 60):
            for i in (-15, 30):
                F.pose(ctx, g, i)
                piores.append(float(_px(cam, [p for o in cabeca for p in _verts(o, 2)])[:, 1].min()))
        t['respiro_pior_faixa_px'] = round(min(piores) - max(t['labio_inferior_px_neutra'],
                                                             t['labio_inferior_px_sorriso']), 1)
        F.pose(ctx, *sol['camera'])
        cx = _px(cam, [p for o in tudo for p in _verts(o, 2)])
        acima = cx[cx[:, 1] < (float(bpy.context.scene.render.resolution_y) + 1)]
        t['robo_caixa_px'] = [round(float(v), 1) for v in (cx[:, 0].min(), cx[:, 1].min(), cx[:, 0].max(),
                                                            cx[:, 1].max())]
        t['robo_visivel_frac'] = round(len(acima) / len(cx), 3)
        o0 = ctx['robo'].matrix_world.to_translation()
        sem = [p for o in tudo for p in _verts(o, 2)
               if o.name != 'ai_base' or (p - o0).xy.length < G.R(46)]        # o cabo que sai da base fica de fora
        sc = _px(cam, sem)
        t['robo_caixa_sem_cabo_px'] = [round(float(v), 1) for v in (sc[:, 0].min(), sc[:, 1].min(), sc[:, 0].max(),
                                                                     sc[:, 1].max())]
        tl = _px(cam, _verts(obs['ai_tela']))
        t['tela_px'] = [round(float(tl[:, 0].max() - tl[:, 0].min()), 1),
                        round(float(tl[:, 1].max() - tl[:, 1].min()), 1)]
        out[tela] = t
        bpy.data.objects.remove(cam)
    return out


def _resolucao(tela):
    c = comum.ler_camera_site(tela)['css']
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = c['w'], c['h']


def _fora(pts_por_tela):
    """True se TODOS os pontos estão fora do quadro (do mesmo lado) em cada tela: [(tela, câmera, pontos)]."""
    for tela, cam, pts in pts_por_tela:
        _resolucao(tela)
        q = [world_to_camera_view(bpy.context.scene, cam, p) for p in pts]
        xs = np.array([v.x for v in q])
        ys = np.array([v.y for v in q])
        zs = np.array([v.z for v in q])
        if not ((xs > 1).all() or (xs < 0).all() or (ys > 1).all() or (ys < 0).all() or (zs < 0).all()):
            return False
    return True


def explodido(ctx):
    obs, busto = ctx['obs'], ctx['busto']
    busto.pose()
    arv = busto.arvores['Busto_malha']
    alvo = {'ai_pescoco': [obs['ai_suporte'], obs['ai_moldura'], obs['ai_tela']]}
    no = {'ai_pescoco': ctx['pescoco']}
    out = {}
    cams = [(t, comum.camera_site(t, escala=1)) for t in comum.TELAS]
    for nome, (ordem, d) in EXPLODIDO.items():
        o = no.get(nome) or obs[nome]
        pecas = alvo.get(nome, [o])
        if d == 'normal_tampa':
            n = ctx['robo'].matrix_world.to_3x3() @ Vector((1, 0, 0))
            d = tuple(G.gl(n) * 0.5)
        d = np.array(d, float)
        base = [p for q in pecas for p in _verts(q, 3)]
        k = 1.0
        for _ in range(6):
            dv = G.bl(d * k)
            if _fora([(t, c, [p + dv for p in base]) for t, c in cams]):
                break
            k *= 1.3
        dv = G.bl(d * k)
        cam_min = 9.0
        for t in np.linspace(0, 1, 17):
            cam_min = min(cam_min, min(arv.find_nearest(p + dv * t)[3] for p in base))
        pai = o.parent.matrix_world.to_3x3().inverted()
        out[nome] = {'ordem': ordem, 'explodido_glb_m': [round(float(v), 4) for v in d * k],
                     'explodido_m': [round(float(v), 4) for v in G.gl(pai @ dv)],
                     'fora_do_quadro_3_telas': _fora([(t, c, [p + dv for p in base]) for t, c in cams]),
                     'caminho_min_pele_mm': round(cam_min / G.ESC * 1000, 1)}
    for _, c in cams:
        bpy.data.objects.remove(c)
    return out


def medir(ctx):
    sol = ctx['sol']
    med = {'olhar': {'guinada_corpo_graus': round(sol['guinada'], 2),
                     'olhar_camera_graus': [round(v, 2) for v in sol['camera']],
                     'olhar_fael_graus': [round(v, 2) for v in sol['fael']],
                     'camera_glb': [round(v, 4) for v in sol['camera_glb']], 'olhos_fael_glb': [0.0, 0.18, -0.02]}}
    med['olhar']['erro_camera_graus'] = round(F.conferir_olhar(ctx, sol['camera_glb'], *sol['camera']), 2)
    med['olhar']['erro_fael_graus'] = round(F.conferir_olhar(ctx, F.OLHOS, *sol['fael']), 2)
    med['olhar']['dentro_das_faixas'] = all(-60 <= s[0] <= 60 and -15 <= s[1] <= 30
                                            for s in (sol['camera'], sol['fael']))
    massa = {}
    for nome, c in (('repouso_camera', sol['camera']), ('olhar_fael', sol['fael']), ('-60/+30', (-60, 30)),
                    ('+60/+30', (60, 30)), ('-60/-15', (-60, -15)), ('+60/-15', (60, -15))):
        F.pose(ctx, *c)
        g, com, marg = F.centro_massa(ctx)
        massa[nome] = {'massa_g': round(g, 1), 'com_glb': [round(float(v), 4) for v in com],
                       'margem_borda_pes_mm': round(marg, 1)}
    med['centro_massa'] = massa
    med['servos'] = F.folgas_servos(ctx)
    F.pose(ctx, *sol['camera'])
    med['pele_mm'] = folgas_pele(ctx)
    med['px'] = px(ctx)
    med['explodido'] = explodido(ctx)
    F.pose(ctx, *sol['camera'])
    zs = [p.z for o in ctx['obs'].values() for p in _verts(o) if o.name != 'ai_base']
    med['geometria'] = {'altura_real_mm': (max(zs) - ctx['robo'].matrix_world.to_translation().z) / G.ESC * 1000,
                        'mesa_y_glb': ctx['robo'].matrix_world.to_translation().z,
                        'tris': {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons)
                                 for o in ctx['obs'].values()}}
    print('MED olhar', F.dumps(med['olhar']))
    print('MED massa', F.dumps(massa))
    print('MED servos', F.dumps(med['servos']))
    print('MED pele', F.dumps(med['pele_mm']))
    print('MED px', F.dumps(med['px']))
    print('MED explodido', F.dumps(med['explodido']))
    print('MED geo', F.dumps(med['geometria']))
    return med
