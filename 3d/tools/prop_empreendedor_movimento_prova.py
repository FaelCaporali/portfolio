"""Provas do movimento do "Entrepreneur" (volta 4): quadros do clip na câmera do 1440, estado final medido contra o
glb de produção e a folha de contato. Chamado por `prop_empreendedor_movimento.rodar` (provas=1).

Estado final: o glb novo é reimportado e avaliado depois do fim do clip; cada vértice do `empreendedor.glb` atual
tem de ter um vértice do novo a < 0,5 mm (mesma malha, mundo), os nós das peças comparados por matriz de mundo e cada
osso das partes tem de terminar na identidade (translação < 0,5 mm, giro < 0,5°).
"""
import json
import math
import os
import re
import struct
import subprocess
import textwrap

import bpy
from mathutils import Matrix
from mathutils.kdtree import KDTree

import comum
import prop_empreendedor_cena as cena
import prop_financeiro_v6 as v6
from prop_financeiro_direita_prova import caixa_px

PASTA = '3d/captura/props/empreendedor/v4/movimento'
VELHO = '3d/export/props/empreendedor.glb'
TEMPOS = (0.5, 0.9, 1.3, 1.7, 2.1)
TEMPOS_FOG = (1.25, 1.45, 1.7, 2.1)
PECAS = ('sup', 'bolo', 'beliche', 'notebook', 'kanban', 'cartoes', 'foguete')


def _base(n):
    return re.sub(r'\.\d{3}$', '', n)


def quadros(pecas, fps, tempos=TEMPOS, ids=None, pre='quadro'):
    """Cycles na câmera do 1440 com o busto, um quadro por t; devolve os arquivos e o recorte das peças."""
    pasta = os.path.join(v6.ROOT, PASTA)
    os.makedirs(pasta, exist_ok=True)
    comum.importar_busto()
    v6.studio()
    cam = cena._cam('1440x900')
    sc = bpy.context.scene
    sc.cycles.samples = 32
    sc.frame_set(round(2.1 * fps))
    x0, y0, x1, y1 = caixa_px(cam, [o for c, p in pecas.items() if not ids or c in ids for o in p['objs']])
    rec = [max(0, int(x0) - 30), max(0, int(y0) - 60), min(1440, int(x1) + 30), min(900, int(y1) + 20)]
    arqs = []
    for t in tempos:
        sc.frame_set(int(t * fps), subframe=t * fps - int(t * fps))
        arq = os.path.join(pasta, '%s-t%03d.png' % (pre, round(t * 100)))
        sc.render.filepath = arq
        bpy.ops.render.render(write_still=True)
        arqs.append(arq)
    bpy.data.objects.remove(cam)
    return arqs, rec


def _mundo(o, dg):
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    pts = [o.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return pts


def _giro(A, B):
    """Ângulo (°) entre as partes de rotação de duas matrizes (escala e espelho normalizados)."""
    a, b = A.to_3x3().normalized(), B.to_3x3().normalized()
    R = a.inverted() @ b
    c = max(-1.0, min(1.0, (R[0][0] + R[1][1] + R[2][2] - 1) / 2))
    return math.degrees(math.acos(c))


def estado_final(arq_novo, fps):
    sc = bpy.context.scene
    velho = comum.importar_glb(os.path.join(v6.ROOT, VELHO), 'medida_velho')
    novo = comum.importar_glb(arq_novo, 'medida_novo')
    sc.frame_set(round(2.1 * fps) + 15)             # depois do fim: o mixer prende no último quadro
    dg = bpy.context.evaluated_depsgraph_get()
    mv = {_base(o.name): o for o in velho}
    mn = {_base(o.name): o for o in novo}
    res = {'malhas_mm': {}, 'nos': {}, 'ossos': {}}
    for nome, ov in mv.items():
        if ov.type != 'MESH':
            continue
        pn = _mundo(mn[nome], dg)
        kd = KDTree(len(pn))
        for i, p in enumerate(pn):
            kd.insert(p, i)
        kd.balance()
        res['malhas_mm'][nome] = round(1000 * max(kd.find(p)[2] for p in _mundo(ov, dg)), 4)
    for nome in PECAS:
        A, B = mv[nome].matrix_world, mn[nome].matrix_world
        res['nos'][nome] = {'mm': round(1000 * (A.translation - B.translation).length, 4),
                            'graus': round(_giro(A, B), 4),
                            'escala': round(B.to_scale().length / A.to_scale().length, 5)}
    for arm in (o for o in novo if o.type == 'ARMATURE'):
        s = abs(arm.matrix_world.to_scale()[0])
        for pb in arm.pose.bones:
            M = pb.matrix_basis
            res['ossos'][pb.name] = {'mm': round(1000 * s * M.translation.length, 4),
                                     'graus': round(_giro(Matrix(), M), 4)}
    return res


def prova_json(arq):
    """Pelo JSON do glb: a última chave de TODO canal do clip == TRS de repouso do nó alvo (0,5 mm no mundo,
    0,5°, escala 0,1 %). Imprime a tabela e grava `prova-json.txt`."""
    with open(arq, 'rb') as fh:
        b = fh.read()
    n = struct.unpack_from('<I', b, 12)[0]
    j, bin0 = json.loads(b[20:20 + n]), 20 + n + 8
    nos = j['nodes']
    pai = {c: i for i, d in enumerate(nos) for c in d.get('children', [])}

    def escala_pais(i):
        s = 1.0
        while i in pai:
            i = pai[i]
            s *= max(abs(x) for x in nos[i].get('scale', [1, 1, 1]))
        return s

    def ultimo(ai):
        a = j['accessors'][ai]
        bv, k = j['bufferViews'][a['bufferView']], {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
        assert a['componentType'] == 5126 and not a.get('normalized')
        off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0) + bv.get('byteStride', 4 * k) * (a['count'] - 1)
        return struct.unpack_from('<%df' % k, b, off)
    fmt = lambda v: '(' + ', '.join('%.5f' % x for x in v) + ')'    # noqa: E731
    linhas, ok = ['no                     canal        t_fim   ultima chave -> repouso: erro'], True
    for an in j['animations']:
        for c in an['channels']:
            s, i, cam = an['samplers'][c['sampler']], c['target']['node'], c['target']['path']
            v, t, d = ultimo(s['output']), ultimo(s['input'])[0], nos[i]
            if cam == 'translation':
                r = d.get('translation', [0, 0, 0])
                err, lim, un = 1000 * escala_pais(i) * math.dist(v, r), 0.5, 'mm'
            elif cam == 'rotation':
                r = d.get('rotation', [0, 0, 0, 1])
                dot = min(1.0, abs(sum(x * y for x, y in zip(v, r))))
                err, lim, un = math.degrees(2 * math.acos(dot)), 0.5, 'grau'
            else:
                r = d.get('scale', [1, 1, 1])
                err, lim, un = 100 * max(abs(x - y) / max(abs(y), 1e-9) for x, y in zip(v, r)), 0.1, '%'
            ok &= err < lim and t <= 2.1 + 1e-4
            linhas.append('%-22s %-11s %.3f  %s -> %s: %.4f %s %s' % (d.get('name'), cam, t, fmt(v), fmt(r), err, un,
                                                                   'ok' if err < lim else 'FALHA'))
    linhas.append('PROVA_JSON %s  (%d canais, clip %s)' % ('OK' if ok else 'FALHA', len(linhas) - 1,
                                                         [a.get('name') for a in j['animations']]))
    os.makedirs(os.path.join(v6.ROOT, PASTA), exist_ok=True)
    with open(os.path.join(v6.ROOT, PASTA, 'prova-json.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(linhas) + '\n')
    print('\n'.join(linhas))
    return ok


def ler_glb(arq):
    with open(arq, 'rb') as fh:
        fh.seek(12)
        n = struct.unpack('<I', fh.read(4))[0]
        fh.read(4)
        j = json.loads(fh.read(n))
    nos, pai = j['nodes'], {}
    for i, d in enumerate(nos):
        for c in d.get('children', []):
            pai[c] = i

    def cadeia(i):
        out = []
        while i in pai:
            i = pai[i]
            out.append(nos[i].get('name'))
        return out
    an = j.get('animations', [])
    fins = [j['accessors'][s['input']]['max'][0] for a in an for s in a['samplers']]
    inis = [j['accessors'][s['input']]['min'][0] for a in an for s in a['samplers']]
    pele = {nos[i]['name']: cadeia(i)[:3] for i, d in enumerate(nos) if 'skin' in d}
    return {'clips': [a.get('name') for a in an], 'canais': sum(len(a['channels']) for a in an),
            't_min': round(min(inis), 4) if inis else None, 't_max': round(max(fins), 4) if fins else None,
            'nos': len(nos), 'malhas': len(j['meshes']), 'materiais': len(j['materials']),
            'primitivas': sum(len(m['primitives']) for m in j['meshes']), 'skins': len(j.get('skins', [])),
            'ossos': sorted(nos[k]['name'] for s in j.get('skins', []) for k in s['joints']),
            'pele_sob': pele, 'ext': j.get('extensionsUsed', [])}


def _texto(linhas, w, pt, saida):
    h = int(len(linhas) * pt * 1.35) + 16
    subprocess.run(['convert', '-size', '%dx%d' % (w, h), 'xc:#141414', '-fill', '#e8e8e8', '-font', 'DejaVu-Sans-Mono',
                    '-pointsize', str(pt), '-annotate', '+8+%d' % (pt + 4), '\n'.join(linhas), saida], check=True)


def folha(arqs, rec, linhas):
    pasta = os.path.join(v6.ROOT, PASTA)
    w, h = rec[2] - rec[0], rec[3] - rec[1]
    cel = []
    for t, a in zip(TEMPOS, arqs):
        s = '/data/tmp/mov-%s.png' % os.path.basename(a)[:-4]
        subprocess.run(['convert', a, '-crop', '%dx%d+%d+%d' % (w, h, rec[0], rec[1]), '+repage', '-resize', '516x',
                        '-background', '#141414', '-gravity', 'north', '-splice', '0x26', '-gravity', 'northwest',
                        '-fill', '#f0f0f0', '-pointsize', '18', '-annotate', '+8+3', 't = %.1f s' % t, s], check=True)
        cel.append(s)
    txt = '/data/tmp/mov-texto.png'
    _texto(linhas[:14], 516, 15, txt)
    grade = '/data/tmp/mov-grade.png'
    subprocess.run(['montage', *cel, txt, '-tile', '3x', '-geometry', '+4+4', '-background', '#0c0c0c', grade],
                   check=True)
    tab = '/data/tmp/mov-tabela.png'
    _texto([q for li in linhas[14:] for q in textwrap.wrap(li, 180)], 1560, 14, tab)
    arq = os.path.join(pasta, 'folha-movimento.png')
    subprocess.run(['convert', grade, tab, '-background', '#0c0c0c', '-append', '-resize', '1568x>', arq], check=True)
    return arq


def folha_foguete(arqs, rec, linhas):
    w, h = rec[2] - rec[0], rec[3] - rec[1]
    cel = []
    for t, a in zip(TEMPOS_FOG, arqs):
        s = '/data/tmp/fog-%s.png' % os.path.basename(a)[:-4]
        subprocess.run(['convert', a, '-crop', '%dx%d+%d+%d' % (w, h, rec[0], rec[1]), '+repage', '-resize', '386x',
                        '-background', '#141414', '-gravity', 'north', '-splice', '0x26', '-gravity', 'northwest',
                        '-fill', '#f0f0f0', '-pointsize', '18', '-annotate', '+8+3', 't = %.2f s' % t, s], check=True)
        cel.append(s)
    grade, tab = '/data/tmp/fog-grade.png', '/data/tmp/fog-tabela.png'
    subprocess.run(['montage', *cel, '-tile', '4x', '-geometry', '+3+3', '-background', '#0c0c0c', grade], check=True)
    _texto([q for li in linhas for q in textwrap.wrap(li, 180)], 1560, 14, tab)
    arq = os.path.join(v6.ROOT, PASTA, 'folha-foguete.png')
    subprocess.run(['convert', grade, tab, '-background', '#0c0c0c', '-append', '-resize', '1568x>', arq], check=True)
    return arq


def rodar(pecas, raiz_t, arq, orc, ossos, fps=30):
    fog = v6.ARGS.get('folha') == 'foguete'           # volta 4b: só o lado direito (notebook + foguete)
    arqs, rec = quadros(pecas, fps, TEMPOS_FOG, ('notebook', 'foguete'), 'foguete') if fog else quadros(pecas, fps)
    if fog:
        rec = [max(0, rec[0] - 40), max(0, rec[1] - 40), min(1440, rec[2] + 40), rec[3]]
    info = ler_glb(arq)
    med = estado_final(arq, fps)
    pior_m = max(med['malhas_mm'].values())
    pior_n = max(max(v['mm'] for v in med['nos'].values()), max(v['mm'] for v in med['ossos'].values()))
    pior_g = max(max(v['graus'] for v in med['nos'].values()), max(v['graus'] for v in med['ossos'].values()))
    ok = pior_m < 0.5 and pior_n < 0.5 and pior_g < 0.5
    linhas = ['COREOGRAFIA (t em s)', 'tampa 0,55-0,95  fatia 0,60-1,00', 'travesseiros 0,70-1,05 (+0,08)',
              'remo 0,75-1,10  post-its 0,95-1,60', 'leque 1,05-1,55 (+0,05)', 'foguete 1,20-2,10',
              'post-it solto 1,60-1,95', '',
              'clip %s  %s-%s s  %d canais' % (info['clips'], info['t_min'], info['t_max'], info['canais']),
              'glb %.1f kB (sem Draco %.1f)' % (orc['kB'], orc['kB_sem_draco']),
              'nos %d  malhas %d  materiais %d' % (info['nos'], info['malhas'], info['materiais']),
              'chamadas estimadas %d (primitivas)' % info['primitivas'], 'skins %d  ossos %d' % (
                  info['skins'], len(info['ossos'])), '',
              'ESTADO FINAL (t = 2,1) x empreendedor.glb atual: %s   limite 0,5 mm / 0,5 grau' % (
                  'OK' if ok else 'FALHA'),
              'vertices (cada vertice do glb atual -> o mais perto do novo, mundo, mm): ' + '  '.join(
                  '%s %.3f' % (k, v) for k, v in sorted(med['malhas_mm'].items())),
              'nos das pecas (mm / grau): ' + '  '.join(
                  '%s %.3f/%.3f' % (k, v['mm'], v['graus']) for k, v in med['nos'].items()),
              'ossos no fim (mm / grau): ' + '  '.join(
                  '%s %.3f/%.3f' % (k, v['mm'], v['graus']) for k, v in sorted(med['ossos'].items())),
              'piores: vertice %.4f mm  no/osso %.4f mm  %.4f grau' % (pior_m, pior_n, pior_g)]
    arq_f = folha_foguete(arqs, rec, linhas[8:]) if fog else folha(arqs, rec, linhas)
    out = {'glb': info, 'orcamento': orc, 'estado_final': med, 'ok': ok, 'janelas': ossos, 'recorte_1440': rec,
           'quadros': [os.path.relpath(a, v6.ROOT) for a in arqs], 'folha': os.path.relpath(arq_f, v6.ROOT)}
    with open(os.path.join(v6.ROOT, PASTA, 'medidas-foguete.json' if fog else 'medidas.json'), 'w',
              encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1, default=str)
    print('GLB', json.dumps(info))
    print('FINAL', 'OK' if ok else 'FALHA', pior_m, pior_n, pior_g)
    print('FOLHA', arq_f)
