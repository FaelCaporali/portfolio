"""Aparência do adereço do financeiro (módulo do lookdev; ESTUDIO §3; BÍBLIA §5 e §8b).

`aplicar(variante)` monta os materiais da coleção `Peca` da FORMA NOVA (painel único de ATLAS — `atlas.py` — em vez
das peças por nome do c1: vidro, gravação, verde, tinta e marca do cabeçalho/fórmula/grade agora são UMA textura
só, aplicada ao material `vidro` do painel). Só Principled BSDF e o que sobrevive ao glTF: transmissão
(KHR_materials_transmission, com `transmissionTexture` — a máscara que `atlas.py` gera ao lado da cor, branca onde
o vidro é nu e preta onde é impresso), volume (KHR_materials_volume: espessura no nó `glTF Material Output`,
atenuação por Volume Absorption), IOR, clearcoat. Nada procedural (morreria na exportação).
Cores de metal = F0 LINEAR (Real-Time Rendering 4ª ed., tabela de F0); dielétricos por sRGB convertido.

Variantes da prova de material (E3, conceito, forma antiga do c1/blockout.py): 'transmissao' (vidro físico) e
'fume' (plano B: vidro fumê sem transmissão, BLEND + verniz) — mantidas como histórico, fora da cadeia de
`construir.py`. A variante em produção (FICHA R1/R2/R7, forma nova de `forma.py`) é 'fosco': vidro fosco acetinado
com a impressão do atlas opaca por cima — `construir.py` chama `aparencia.aplicar()` sem argumento, por isso é o
padrão desta função. Retorno do daily r3→r4 (24/09): 'fosco' NÃO usa mais KHR_materials_transmission (custava um
passe extra da cena inteira no three e refratava o cabelo atrás do painel, lendo marrom); o vidro nu é BLEND
(Alpha) sobre a cor do atlas.
Uso direto (prova, forma antiga): `blender -b --python 3d/tools/props/financeiro/aparencia.py -- transmissao fume`
"""

import os
import sys

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import comum  # noqa: E402

# F0 linear (RTR4): ouro (1,000; 0,766; 0,336). Aço inox: entre ferro (0,562; 0,565; 0,578) e cromo
# (0,550; 0,556; 0,554) com níquel (0,660; 0,609; 0,526) — liga 304 ≈ (0,58; 0,57; 0,55).
OURO_TABELA, ACO = (1.000, 0.766, 0.336), (0.58, 0.57, 0.55)
# Na captura (ACES, sala neutra) o F0 de tabela lê "champanhe/latão" (face da moeda sRGB 176/158/110 e 202/187/143,
# saturação 0,3–0,4): falta o que satura o ouro de verdade, o reflexo dele em si mesmo e no ambiente quente. F0^1,5
# (≈ uma inter-reflexão) é a correção de partida; o valor final sai da captura (HANDOFF, voltas r7–r8).
OURO = tuple(round(c ** 1.5, 3) for c in OURO_TABELA)
IOR_VIDRO = 1.52
VIDRO_T = 0.012  # espessura de referência do shading (volume, variantes antigas); a forma nova mede 0,009 m (R1)
# Float verde-azulado (BÍBLIA §5). Distância medida pela transmitância real: 10–12 mm de float passam ~0,82/0,90/0,87
# (R/G/B) de frente → 0,12 m. Os 0,04 m da BÍBLIA deixavam a lâmina escura e verde DE FRENTE (vidro de garrafa).
# No three a espessura é constante (não segue a geometria): a borda verde de topo pede mapa de espessura (produção).
ATENUACAO = ('#5f9a86', 0.12)

# Reflexo próprio (extras → scene/envIntensity.ts): (intensidade, sala nítida). A cena usa 0,35 e sala borrada (pele).
# Retorno dos dailies r2→r3 (24/09): 1,4 estava ACIMA da cena (0,35) e o site soma esse especular também sobre o
# IMPRESSO do painel (cabeçalho/texto/células liam claro demais); 0,5 é o ponto de partida calculado pelo
# orquestrador — o verniz do vidro nu (Coat Weight, mascarado pela transmissão) continua dando o reflexo nítido.
ENV = {'vidro': (0.5, True), 'ouro': (0.55, True), 'aco': (0.8, True)}
# r3: specular/rugosidade do IMPRESSO (máscara preta do atlas) vs. do vidro NU (máscara branca), pela FICHA R1 (vidro
# nu: rugosidade 0,35–0,45) e pelo pedido do daily (impresso: Specular IOR Level ~0,2, rugosidade ~0,6 — a tinta não
# deve brilhar como o vidro em volta).
from atlas import IMPRESSO_RUG, IMPRESSO_SPEC  # noqa: E402,F401  (valores gravados no ORM/spec)
# r4 (retorno do daily): vidro nu agora é BLEND (Alpha), não transmissão — alpha 0,5-0,6 (meio da faixa) sobre a
# cor do atlas (já cinza neutra, FUNDO '#8a8c88'); impresso continua opaco (alpha 1,0, "como hoje").
from atlas import ALPHA_NU, VIDRO_RUG  # noqa: E402  (alfa gravado em atlas_painel_rgba.png)
# Borda de vidro (verso/cantos/chanfro, UV constante de `forma.py:_painel`): cor e rugosidade pintadas na faixa de
# baixo do atlas por `atlas.derivadas()` (BORDA_COR, BORDA_RUG, lá).

# Parâmetros por variante (ajustados na luz do site; histórico das voltas no HANDOFF).
VARIANTES = {
    'transmissao': {
        'vidro': dict(base='#eef5f2', rug=0.05, trans=1.0, volume=True, env=ENV['vidro']),
        # opaca: só o opaco entra na textura de refração do three (gravada no verso, é vista ATRAVÉS do vidro)
        'gravacao': dict(base='#86908c', rug=0.55),
    },
    'fume': {
        # r9: alpha 0,45 / #2a3a36 lia painel verde leitoso; mais transparente e mais escuro para deixar a gravação do verso
        'vidro': dict(base='#1f2a28', rug=0.04, alpha=0.30, coat=1.0, env=ENV['vidro']),
        'gravacao': dict(base='#86908c', rug=0.60),
    },
    # C1/produção (REQUISITOS R1, R2, R7): vidro FOSCO acetinado, material ÚNICO do painel de atlas. `atlas=True`
    # pede o material especial `_vidro_painel`: a cor vem de `atlas_painel.png` (cabeçalho, letras, fórmula, grade
    # — R2/R3/R4) e `atlas_painel_transmissao.png` (a máscara que `atlas.py` gera ao lado: branco = vidro nu,
    # preto = impresso opaco) dirige o ALFA (BLEND) desde o daily r3→r4 — não mais transmissão (custava um passe
    # extra da cena inteira no three e refratava o cabelo atrás do painel).
    'fosco': {
        'vidro': dict(atlas=True, rug=VIDRO_RUG, coat=1.0, coat_rug=0.04, env=ENV['vidro']),
    },
}
# fio, nós, filete polidos; bandeira em chapa escovada; moedas: face fosca de manuseio (a face de cima reflete o teto
# claro da sala e passava a bandeira em valor, contra a hierarquia da BÍBLIA §3). Variação por região = ORM na produção.
OURO_RUG = {'ouro': 0.20, 'ouro_escovado': 0.32, 'ouro_moeda': 0.38}
# C1 (laudo arte, defeito 3): moedas mais foscas que a bandeira (a face de cima reflete o teto claro e empatava com ela)
MOEDA_RUG = {'fosco': 0.45}
# C1: na captura as moedas (p50 188) passavam a bandeira (p50 175): reflexo próprio menor só nelas (a bandeira é o foco).
MOEDA_ENV = {'fosco': (0.35, True)}
# C1: fio e mastro de aço saíam quase brancos (o maior bloco claro no topo); aço acetinado/grafite (ficha R5)
ACO_ENV = {'fosco': (0.60, True)}
# r5: com rugosidade 0,36 o reflexo da sala borra num cinza claro uniforme e o fio lia tubo de PVC; mais liso = faixas
# claras e escuras do reflexo (o que diz metal)
ACO_RUG_VAR = {'fosco': 0.22}
ACO_RUG = 0.36
# forma nova (`forma.py`): objetos `painel`, `fio`, `mastro` (material já vem certo pelo NOME do material: vidro/aço);
# só bandeira e moedas (`bandeira`, `moedas` — a pilha inteira é UM objeto joined) trocam de metal por prefixo do nome.
POR_OBJETO = {'bandeira': 'ouro_escovado', 'moedas': 'ouro_moeda'}


def _lin(s):
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def _cor(h):
    h = h.lstrip('#')
    return tuple(_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def _grupo_gltf():
    """Nó `glTF Material Output` (o exportador lê dele a espessura do KHR_materials_volume)."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', socket_type='NodeSocketFloat')
        g.interface.new_socket('Thickness', socket_type='NodeSocketFloat')
        g.nodes.new('NodeGroupInput')
    return g


def _limpo(nome):
    """Material `nome` com só Principled + saída; devolve (material, bsdf, saída)."""
    m = bpy.data.materials.get(nome) or bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return m, b, out


def _env(m, env):
    for k in ('envMapIntensity', 'envSharp'):
        m.pop(k, None)
    if env is not None:
        m['envMapIntensity'], m['envSharp'] = env[0], bool(env[1])


def _metal(nome, f0, rug, env=None):
    m, b, _ = _limpo(nome)
    _env(m, env)
    b.inputs['Base Color'].default_value = (*f0, 1.0)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = rug
    return m


def _dieletrico(nome, base, rug, trans=0.0, alpha=1.0, coat=0.0, coat_rug=0.02, volume=False, env=None):
    m, b, out = _limpo(nome)
    _env(m, env)
    b.inputs['Base Color'].default_value = _cor(base)
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Roughness'].default_value = rug
    b.inputs['IOR'].default_value = IOR_VIDRO
    b.inputs['Transmission Weight'].default_value = trans
    b.inputs['Alpha'].default_value = alpha
    b.inputs['Coat Weight'].default_value = coat
    # Uma face só (glTF doubleSided false): peça fechada com espessura real; no three, face de trás de material
    # transmissivo duplo entra num passe extra da textura de refração (custo e artefato sem ganho aqui).
    m.use_backface_culling = True
    if coat:
        b.inputs['Coat Roughness'].default_value = coat_rug
    if volume:
        nt = m.node_tree
        gn = nt.nodes.new('ShaderNodeGroup')
        gn.node_tree = _grupo_gltf()
        gn.inputs['Thickness'].default_value = VIDRO_T
        va = nt.nodes.new('ShaderNodeVolumeAbsorption')
        cor, dist = ATENUACAO
        va.inputs['Color'].default_value = _cor(cor)
        va.inputs['Density'].default_value = 1.0 / dist
        nt.links.new(va.outputs['Volume'], out.inputs['Volume'])
    return m


def _vidro_painel(rug, coat=0.0, coat_rug=0.02, env=None):
    """Material único do painel da forma nova (ATLAS, R1/R2/R3/R4/R7), SÓ com imagens ligadas direto no Principled.

    Retorno do daily r4 do lookdev (24/09, REPROVADO por regressão): a r4 dirigia Alpha/Roughness/Specular/Base Color
    por nós de conta (Math) sobre a máscara; o exportador glTF não leva conta — o glb saiu com baseColorTexture = RGB
    do atlas + ALFA = máscara CRUA, e o impresso (máscara preta) ficou com alfa 0, invisível. Agora `atlas.derivadas()`
    (PIL, fora do Blender: `python3 atlas.py`) grava as texturas já calculadas e aqui só há ligação direta:
    `atlas_painel_rgba.png` Color→Base Color e Alpha→Alpha (impresso 255, vidro nu `ALPHA_NU`, faixa da borda de
    vidro opaca na UV do verso/chanfro); `atlas_painel_orm.png` G→Roughness (glTF metallicRoughnessTexture);
    `atlas_painel_spec.png`→Specular IOR Level; máscara→Coat Weight (clearcoatTexture: verniz só no vidro nu).
    `rug` fica em `atlas.VIDRO_RUG` (a rugosidade está gravada no ORM); sem transmissão (BLEND, daily r3→r4)."""
    m, b, _ = _limpo('vidro')
    _env(m, env)
    nt = m.node_tree
    raiz = os.path.join(AQUI, 'atlas_painel')
    fontes = [f'{raiz}.png', f'{raiz}_transmissao.png']
    derivadas = [f'{raiz}_rgba.png', f'{raiz}_orm.png', f'{raiz}_spec.png']
    if any(not os.path.exists(d) or os.path.getmtime(d) < max(map(os.path.getmtime, fontes)) for d in derivadas):
        raise RuntimeError('texturas derivadas do atlas ausentes ou velhas: rode `python3 atlas.py`')

    def tex(caminho, nome, dados):
        img = bpy.data.images.load(caminho, check_existing=True)
        img.colorspace_settings.name = 'Non-Color' if dados else 'sRGB'
        no = nt.nodes.new('ShaderNodeTexImage')
        no.name, no.image, no.interpolation = nome, img, 'Linear'
        return no

    t_rgba = tex(derivadas[0], 'AtlasRGBA', False)
    t_rgba.image.alpha_mode = 'STRAIGHT'
    t_orm = tex(derivadas[1], 'AtlasORM', True)
    t_spec = tex(derivadas[2], 'AtlasSpec', True)
    t_masc = tex(fontes[1], 'AtlasMascara', True)
    nt.links.new(t_rgba.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t_rgba.outputs['Alpha'], b.inputs['Alpha'])
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    sep.name = 'ORM'
    nt.links.new(t_orm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
    nt.links.new(t_spec.outputs['Color'], b.inputs['Specular IOR Level'])
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Transmission Weight'].default_value = 0.0
    b.inputs['IOR'].default_value = IOR_VIDRO
    if coat:
        b.inputs['Coat Roughness'].default_value = coat_rug
        b.inputs['Coat Weight'].default_value = 1.0
        nt.links.new(t_masc.outputs['Color'], b.inputs['Coat Weight'])  # fator `coat` = 1 (única variante em uso)
    else:
        b.inputs['Coat Weight'].default_value = 0.0
    m.use_backface_culling = True
    try:
        m.surface_render_method = 'BLENDED'
    except AttributeError:
        m.blend_method = 'BLEND'
    return m


def aplicar(variante='fosco'):
    """Troca os materiais da coleção `Peca` pelos da variante; devolve {material: [objetos]}."""
    p = VARIANTES[variante]
    mats = {
        'ouro': _metal('ouro', OURO, OURO_RUG['ouro'], ENV['ouro']),
        'ouro_escovado': _metal('ouro_escovado', OURO, OURO_RUG['ouro_escovado'], ENV['ouro']),
        'ouro_moeda': _metal('ouro_moeda', OURO, MOEDA_RUG.get(variante, OURO_RUG['ouro_moeda']),
                             MOEDA_ENV.get(variante, ENV['ouro'])),
        'aco': _metal('aco', ACO, ACO_RUG_VAR.get(variante, ACO_RUG), ACO_ENV.get(variante, ENV['aco'])),
    }
    vidro = p.get('vidro')
    if vidro and vidro.get('atlas'):
        mats['vidro'] = _vidro_painel(**{k: v for k, v in vidro.items() if k != 'atlas'})
    elif vidro:
        mats['vidro'] = _dieletrico('vidro', **vidro)
    mats.update({k: _dieletrico(k, **v) for k, v in p.items() if k not in mats and k != 'vidro'})
    uso = {}
    for o in bpy.data.collections['Peca'].all_objects:
        if o.type != 'MESH':
            continue
        nome = o.data.materials[0].name if o.data.materials else None
        nome = next((m for pref, m in POR_OBJETO.items() if o.name.startswith(pref)), nome)
        o.data.materials.clear()
        o.data.materials.append(mats[nome])
        uso.setdefault(nome, []).append(o.name)
    return uso


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    import blockout
    import exportar

    # --chanfro=<m>: prova de leitura do chanfro do vidro (a forma é do modelador; aqui só muda o glb da prova).
    chanfro = next((float(a.split('=')[1]) for a in args if a.startswith('--chanfro=')), None)
    sufixo = next((a.split('=')[1] for a in args if a.startswith('--sufixo=')), '')
    if chanfro:
        blockout.CHANFRO = chanfro
    # --grav=<-1|1>: face gravada (frente/verso), idem (prova de leitura; a constante é do modelador).
    grav = next((int(a.split('=')[1]) for a in args if a.startswith('--grav=')), None)
    if grav:
        blockout.GRAV_LADO = grav
    for var in [a for a in args if not a.startswith('--')] or ['transmissao', 'fume']:
        comum.cena_nova()
        blockout.construir()
        print('APARENCIA', var, aplicar(var))
        print('EXPORTADO', exportar.exportar(f'prova-{var}{sufixo}'))
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, '3d/blend/props/financeiro_v7_prova-material.blend'))


if __name__ == '__main__':
    main()
