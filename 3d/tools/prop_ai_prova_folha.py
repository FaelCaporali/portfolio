"""Vistas ROTULADAS e folha (≤ 1568 px) da vida `ai` v1 (FICHA §1): (1) frente pela câmera do site 1440 com o busto
(material na luz do site + argila); (2) lateral ESQUERDA DO FAEL (+X); (3) de cima; (4) 3/4 de trás (tampa fumê e
placa); (5) explodido (peças em `explodido_glb_m`, números = ordem de montagem); (6) a cabeça girada para o Fael (câmera
do site e dos olhos dele). Mede a leitura do grafite no render da frente (L* do corpo × fundo)."""
import math
import os
import subprocess

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

import comum
import prop_ai_funcao as F
import prop_ai_geo as G
import prop_ai_prova as PV
from prop_fullstack_prova_folha import _cam, _rotular

GRAFITE = ('ai_base', 'ai_corpo', 'ai_moldura')


def _lstar(rgb):
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    y = lin @ np.array((0.2126, 0.7152, 0.0722))
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)


def _mascara(objs, W, H):
    arq = os.path.join(PV.MT.TMP, '_mask.png')
    comum.render_silhueta(arq, objs)
    img = bpy.data.images.load(arq, check_existing=False)
    a = np.array(img.pixels[:]).reshape(H, W, 4)[::-1, :, 0] < 0.5
    bpy.data.images.remove(img)
    return a


def _argila(arq, objs):
    sc = bpy.context.scene
    motor = sc.render.engine
    comum.render_argila(arq, objs)
    sc.render.engine = motor
    sc.render.film_transparent = True


def frente(ctx, med, pasta, pose, nome):
    """Câmera do site 1440, recorte do queixo do Fael ao robô; material (luz do site, ACES) e argila."""
    F.pose(ctx, *pose)
    obs, pele = ctx['obs'], list(ctx['busto'].malhas.values())
    tudo = list(obs.values()) + pele
    k = 2                                     # 2 px por px CSS (detalhe na folha)
    cam = comum.camera_site('1440x900', escala=k)
    bpy.context.view_layer.update()
    x0, y0, x1, y1 = 760, 300, 1440, 900
    borda = (x0 / 1440, x1 / 1440, 1 - y1 / 900, 1 - y0 / 900)
    PV.luz_site()
    rgb, _ = PV.render(os.path.join(pasta, nome + '-material.png'), tudo, borda, 96)
    leitura = None
    if nome == 'frente':
        m = _mascara([obs[n] for n in GRAFITE], 1440 * k, 900 * k)[y0 * k:y1 * k, x0 * k:x1 * k]
        L = _lstar(rgb)
        fundo = L[:80, -120:].mean()
        leitura = {'grafite_L_media': round(float(L[m].mean()), 1),
                   'grafite_L_p10_p90': [round(float(np.percentile(L[m], p)), 1) for p in (10, 90)],
                   'fundo_L': round(float(fundo), 1), 'delta_L': round(float(L[m].mean() - fundo), 1),
                   'grafite_srgb': PV.MT.GRAFITE, 'env_mundo': PV.ESTADO['env']}
    cam2 = comum.camera_site('1440x900', escala=k)
    _argila(os.path.join(pasta, nome + '-argila.png'), tudo)
    subprocess.run(['convert', os.path.join(pasta, nome + '-argila.png'), '-crop', '%dx%d+%d+%d' % (
        (x1 - x0) * k, (y1 - y0) * k, x0 * k, y0 * k), '+repage', os.path.join(pasta, nome + '-argila.png')],
        check=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(cam2)
    return leitura


def _orto(nome, alvo, desl, escala, res=(700, 620)):
    a = G.bl(alvo)
    return _cam(nome, a + G.bl(desl), a, orto=escala, res=res)


def vistas(ctx, med, pasta):
    obs, pele = ctx['obs'], list(ctx['busto'].malhas.values())
    tudo = list(obs.values()) + pele
    robo = G.gl(ctx['robo'].matrix_world.to_translation())
    alvo = robo + np.array((-0.02, 0.07, -0.02))
    F.pose(ctx, *ctx['sol']['camera'])
    for arq, desl, esc in (('lateral-E.png', (0.6, 0, 0), 0.30), ('cima.png', (0, 0.6, 0.0001), 0.32)):
        cam = _orto('Cam_' + arq, alvo, desl, esc)
        _argila(os.path.join(pasta, arq), tudo)
        bpy.data.objects.remove(cam)
    # 3/4 de trás: do lado da tampa (+x local do robô) e de trás, 25° acima
    psi = math.radians(ctx['psi'] + 120)
    d = np.array((math.sin(psi) * math.cos(0.30), math.sin(0.30), math.cos(psi) * math.cos(0.30)))
    c = robo + np.array((0, 0.055, 0))
    cam = _cam('Cam_34', G.bl(c + d * 0.30), G.bl(c), lens=60, res=(760, 700))
    PV.render(os.path.join(pasta, 'tras34-material.png'), list(obs.values()), None, 96)
    bpy.data.objects.remove(cam)


def explodido(ctx, med, pasta):
    obs, pele = ctx['obs'], list(ctx['busto'].malhas.values())
    no = {'ai_pescoco': ctx['pescoco']}
    guard = {}
    for nome, e in med['explodido'].items():
        o = no.get(nome) or obs[nome]
        guard[o] = o.location.copy()
    for nome, e in sorted(med['explodido'].items(), key=lambda kv: -kv[1]['ordem']):
        o = no.get(nome) or obs[nome]
        o.location = guard[o] + Vector(G.bl(e['explodido_m']))
    bpy.context.view_layer.update()
    pts = np.array([G.gl(o.matrix_world @ v.co) for o in obs.values() for v in list(o.data.vertices)[::5]])
    pts = np.concatenate([pts, [(-0.1, 0.0, 0.0), (0.1, 0.32, 0.0)]])          # a cabeça do Fael no quadro
    lo, hi = pts.min(0), pts.max(0)
    c = (lo + hi) / 2
    d = np.array((0.35, 0.30, 1.0))
    d /= np.linalg.norm(d)
    cam = _cam('Cam_exp', G.bl(c + d * 2.0), G.bl(c), orto=float(max(hi - lo)) * 1.12 * 900 / 640, res=(900, 640))
    arq = os.path.join(pasta, 'explodido.png')
    _argila(arq, list(obs.values()) + pele)
    sc = bpy.context.scene
    anot = []
    for nome, e in med['explodido'].items():
        alvos = [obs['ai_suporte']] if nome == 'ai_pescoco' else [no.get(nome) or obs[nome]]
        ps = [a.matrix_world @ v.co for a in alvos for v in list(a.data.vertices)[::7]]
        q = world_to_camera_view(sc, cam, sum(ps, Vector()) / len(ps))
        anot += ['-annotate', '+%d+%d' % (q.x * 900 + 14, (1 - q.y) * 640 - 8), str(e['ordem'])]
    subprocess.run(['convert', arq, '-fill', '#ff6a00', '-pointsize', '26', *anot, arq], check=True)
    for o, loc in guard.items():
        o.location = loc
    bpy.context.view_layer.update()
    bpy.data.objects.remove(cam)


def fael(ctx, med, pasta):
    """Cabeça girada para o Fael: câmera do site (material) e vista DOS OLHOS dele (argila, sem o busto)."""
    frente(ctx, med, pasta, ctx['sol']['fael'], 'fael')
    obs = ctx['obs']
    alvo = G.bl(G.gl(obs['ai_tela'].matrix_world.to_translation()))
    cam = _cam('Cam_olhos', G.bl(F.OLHOS), alvo, lens=85, res=(560, 620))
    _argila(os.path.join(pasta, 'fael-olhos.png'), list(obs.values()))
    bpy.data.objects.remove(cam)
    F.pose(ctx, *ctx['sol']['camera'])


def renders(ctx, med, pasta):
    j = lambda n: os.path.join(pasta, n)                                       # noqa: E731
    s, px = ctx['sol'], med['px']['1440x900']
    leitura = frente(ctx, med, pasta, s['camera'], 'frente')
    vistas(ctx, med, pasta)
    explodido(ctx, med, pasta)
    fael(ctx, med, pasta)
    sv, cm = med['servos'], med['centro_massa']['repouso_camera']
    pele = min(v['min_mm'] for v in med['pele_mm'].values())
    _rotular(j('frente-material.png'), '(1) FRENTE - câmera do site 1440, luz do site (ACES)',
             'esquerda da imagem = DIREITA do Fael',
             'robô na ESQUERDA do Fael (+X) | topo da cabeça %.0f px abaixo do lábio | tela %.0f px' % (
                 px['respiro_px'], px['tela_px'][0]),
             'grafite L* %.0f x fundo %.0f (delta %.0f) | olhar câmera: giro %+.1f, incl. %+.1f' % (
                 leitura['grafite_L_media'], leitura['fundo_L'], leitura['delta_L'], *s['camera']))
    _rotular(j('frente-argila.png'), '(1) FRENTE - argila, câmera do site 1440')
    _rotular(j('lateral-E.png'), '(2) LATERAL - ESQUERDA do Fael (+X), argila; câmera (+Z) à ESQUERDA da imagem',
             'cabeça x pele %.0f mm (pior pose e servo) | CM a %.0f mm da borda dos pés' % (
                 pele, cm['margem_borda_pes_mm']))
    _rotular(j('cima.png'), '(3) DE CIMA, argila; topo da imagem = câmera (+Z), direita = DIREITA do Fael (-X)',
             'corpo girado %.1f graus (tampa para a câmera) | cabo para trás' % ctx['psi'])
    _rotular(j('tras34-material.png'), '(4) 3/4 DE TRÁS - lado da tampa (esquerda do ROBÔ), luz do site',
             'policarbonato fumê + placa: blindagem, chip, conector, barra de pinos, fita flat')
    _rotular(j('explodido.png'), '(5) EXPLODIDO - peças em explodido_m (número = ordem de montagem)',
             'todas fora do quadro nas 3 telas; caminho reto >= %.0f mm da pele' % min(
                 e['caminho_min_pele_mm'] for e in med['explodido'].values()))
    _rotular(j('fael-material.png'), '(6) CABEÇA GIRADA PARA O FAEL - câmera do site 1440',
             'giro %+.1f, incl. %+.1f (faixas +-60 / -15..+30) | erro %.1f graus' % (
                 *s['fael'], med['olhar']['erro_fael_graus']))
    _rotular(j('fael-olhos.png'), '(6) vista DOS OLHOS do Fael', 'a tela olha para ele')
    run = lambda *a: subprocess.run(['convert', *a], check=True)                # noqa: E731
    run(j('frente-material.png'), '-resize', 'x600', j('fael-material.png'), '-resize', 'x600', '-background', '#111',
        '+append', '-resize', '1560x', '+repage', j('_l1.png'))
    run(j('frente-argila.png'), '-resize', 'x420', j('lateral-E.png'), '-resize', 'x420', j('cima.png'), '-resize',
        'x420', '-background', '#111', '+append', '-resize', '1560x', '+repage', j('_l2.png'))
    run(j('tras34-material.png'), '-resize', 'x440', j('explodido.png'), '-resize', 'x440', j('fael-olhos.png'),
        '-resize', 'x440', '-background', '#111', '+append', '-resize', '1560x', '+repage', j('_l3.png'))
    txt = 'ai v1 (modelagem) | %s | servos: cabeça x pescoço >= %.1f mm | massa %.0f g' % (
        med.get('glb', ''), sv['min_cabeca_mm'], cm['massa_g'])
    run(j('_l1.png'), j('_l2.png'), j('_l3.png'), '-background', '#111', '-gravity', 'center', '-append',
        '-resize', '1560x>', '+repage', '-gravity', 'north', '-splice', '0x26', '-fill', '#eee', '-pointsize', '16',
        '-annotate', '+0+4', txt, j('folha-v1.png'))
    for n in os.listdir(pasta):
        if n.startswith('_l'):
            os.remove(j(n))
    print('FOLHA', j('folha-v1.png'), leitura)
    return leitura
