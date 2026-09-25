"""Utilitários comuns do estúdio 3D no Blender (ESTUDIO §3; dono: técnico web).

Cena padrão, busto de referência (o mesmo glb do site), câmera idêntica à do site (camera-site.json, gerado por
`node 3d/tools/props/portoes.mjs <vida> <pasta> <rótulo> --camera`), render de argila e de silhueta.

Espaços: o glb (site) tem Y para cima e rosto para +Z; o importador glTF do Blender converte para Z para cima,
(x, y, z)_gl → (x, −z, y)_blender. O grupo `frame` do site é o espaço do glb; a câmera do Blender é a do site
expressa nesse espaço (inversa(frame) · câmera), com a mesma projeção vertical e o deslocamento de vista
(setViewOffset) como shift da lente. Uso numa receita: `import sys; sys.path.insert(0, '3d/tools/props'); import comum`.
"""

import json
import math
import os
import subprocess

import bpy
from mathutils import Matrix

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
BUSTO_GLB = os.path.join(RAIZ, '3d/export/s13/busto-s13.glb')
CAMERA_JSON = os.path.join(RAIZ, '3d/tools/props/camera-site.json')
TELAS = ('1440x900', '1024x768', '360x740')
# Base glTF (Y para cima) → Blender (Z para cima).
GL_PARA_BL = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def gl_para_bl(v):
    """Ponto do espaço do glb (x, y, z) → coordenadas do Blender."""
    return (v[0], -v[2], v[1])


def cena_nova():
    """Cena vazia, metros, sem nada da fábrica."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cena = bpy.context.scene
    cena.unit_settings.system = 'METRIC'
    cena.unit_settings.scale_length = 1.0
    if cena.world is None:
        cena.world = bpy.data.worlds.new('Mundo')
    return cena


def sem_meshopt(caminho):
    """Caminho legível byte a byte de um glb: com EXT_meshopt_compression, uma cópia `otimizar.mjs --cru` em
    /data/tmp (a quantização fica: acessor pode ser inteiro normalizado); sem ela, o próprio arquivo."""
    with open(caminho, 'rb') as f:
        if b'EXT_meshopt_compression' not in f.read(1 << 16):
            return caminho
    cru = os.path.join('/data/tmp', 'cru_' + os.path.basename(caminho))
    subprocess.run(['node', os.path.join(RAIZ, '3d/tools/props/otimizar.mjs'), '--cru', caminho, cru],
                   check=True, cwd=RAIZ)
    return cru


def importar_glb(caminho, colecao):
    """Importa um glb para uma coleção própria e devolve os objetos importados. glb com meshopt (o importador do
    Blender 4.5 não lê EXT_meshopt_compression) passa antes por `sem_meshopt`."""
    caminho = sem_meshopt(caminho)
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    novos = [o for o in bpy.data.objects if o not in antes]
    col = bpy.data.collections.get(colecao) or bpy.data.collections.new(colecao)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for o in novos:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    return novos


def importar_busto():
    """Busto de referência do site (S13), na coleção `Referencia`, no neutro."""
    objs = importar_glb(BUSTO_GLB, 'Referencia')
    for o in objs:
        if o.type == 'MESH' and o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks:
                k.value = 0.0
    return objs


def ler_camera_site(tela, caminho=CAMERA_JSON):
    with open(caminho, encoding='utf-8') as f:
        return json.load(f)['telas'][tela]


def _matriz(elems):
    """Matrix4 do three.js (coluna a coluna) → mathutils."""
    return Matrix([[elems[c * 4 + r] for c in range(4)] for r in range(4)])


def camera_site(tela='1440x900', escala=None, nome=None):
    """Câmera idêntica à do site na tela pedida; resolução = tela CSS × escala (padrão: densidade da máscara).

    three.js: fov vertical; setViewOffset desloca a janela em px (x+ para a direita, y+ para baixo). Blender com
    sensor vertical: shift em unidades da altura do quadro, y+ para cima. Logo shift_x = offsetX/H e
    shift_y = −offsetY/H.
    """
    c = ler_camera_site(tela)
    w, h = c['css']['w'], c['css']['h']
    k = escala if escala is not None else c.get('dprMascara', 1)
    cena = bpy.context.scene
    cena.render.resolution_x = round(w * k)
    cena.render.resolution_y = round(h * k)
    cena.render.resolution_percentage = 100
    cena.render.pixel_aspect_x = cena.render.pixel_aspect_y = 1

    dados = bpy.data.cameras.new(nome or f'CamSite_{tela}')
    dados.sensor_fit = 'VERTICAL'
    dados.sensor_height = 24.0
    dados.lens = (dados.sensor_height / 2) / math.tan(math.radians(c['fov']) / 2)
    dados.clip_start = c['near']
    dados.clip_end = c['far']
    v = c.get('view') or {}
    if v.get('enabled'):
        # Janela de vista parcial (width < fullWidth) não é usada pelo site; o enquadramento só desloca.
        assert v['width'] == v['fullWidth'] and v['height'] == v['fullHeight'], 'vista parcial não suportada'
        dados.shift_x = v['offsetX'] / v['fullHeight']
        dados.shift_y = -v['offsetY'] / v['fullHeight']
    cam = bpy.data.objects.new(dados.name, dados)
    cena.collection.objects.link(cam)
    frame = _matriz(c['frameMatrixWorld']) if c.get('frameMatrixWorld') else Matrix.Identity(4)
    cam.matrix_world = GL_PARA_BL @ frame.inverted() @ _matriz(c['matrixWorld'])
    cena.camera = cam
    return cam


def _workbench(luz, aa):
    cena = bpy.context.scene
    cena.render.engine = 'BLENDER_WORKBENCH'
    cena.display_settings.display_device = 'sRGB'
    cena.view_settings.view_transform = 'Standard'
    cena.view_settings.look = 'None'
    cena.render.film_transparent = False
    cena.display.render_aa = aa
    sh = cena.display.shading
    sh.light = luz
    sh.show_shadows = False
    sh.show_specular_highlight = luz != 'FLAT'
    sh.show_object_outline = False
    cena.world.color = (1.0, 1.0, 1.0)
    cena.render.image_settings.file_format = 'PNG'
    cena.render.image_settings.color_mode = 'RGB'
    return sh


def _render(saida, visiveis):
    visiveis = set(visiveis)
    estado = {o: o.hide_render for o in bpy.context.scene.objects}
    for o in bpy.context.scene.objects:
        if o.type in {'MESH', 'CURVE', 'SURFACE', 'META', 'FONT'}:
            o.hide_render = o not in visiveis
    os.makedirs(os.path.dirname(os.path.abspath(saida)), exist_ok=True)
    bpy.context.scene.render.filepath = os.path.abspath(saida)
    bpy.ops.render.render(write_still=True)
    for o, h in estado.items():
        o.hide_render = h
    return saida


def render_silhueta(saida, pretos, cinzas=()):
    """Silhueta sem antisserrilhado: `pretos` em preto, `cinzas` em cinza claro (contexto), fundo branco."""
    sh = _workbench('FLAT', 'OFF')
    sh.color_type = 'OBJECT'
    for o in pretos:
        o.color = (0.0, 0.0, 0.0, 1.0)
    for o in cinzas:
        o.color = (0.62, 0.62, 0.62, 1.0)
    return _render(saida, list(pretos) + list(cinzas))


def render_argila(saida, objetos, cavidade=True):
    """Argila: luz de estúdio, cinza único, cavidade; mostra dobra, degrau e placa flutuante."""
    sh = _workbench('STUDIO', '8')
    sh.color_type = 'SINGLE'
    sh.single_color = (0.62, 0.6, 0.58)
    sh.show_cavity = cavidade
    if cavidade:
        sh.cavity_type = 'BOTH'
    return _render(saida, objetos)


# Vistas da argila (método dos perfis; D/E = lado direito/esquerdo DELE; o rosto olha para −Y no Blender).
VISTAS = (('frente', 0, 0), ('34D', -40, 0), ('perfilD', -90, 0), ('34E', 40, 0), ('perfilE', 90, 0),
          ('cima', 0, 60), ('baixo', 0, -45))


def vistas_argila(objetos, pasta, rotulo, alvo=None, dist=None, lado=520):
    """Folha de argila em 7 vistas em volta do alvo (centro da caixa dos objetos, se omitido); grava cada vista e a
    folha `<rotulo>-argila-folha.png` (ImageMagick). Adaptado de clay_views.py (git show e43be8f^)."""
    import subprocess

    from mathutils import Vector

    cena = bpy.context.scene
    pts = [o.matrix_world @ Vector(c) for o in objetos for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    alvo = Vector(alvo) if alvo is not None else (lo + hi) / 2
    dist = dist or max((hi - lo).length * 2.2, 0.15)
    cam = bpy.data.objects.new('CamArgila', bpy.data.cameras.new('CamArgila'))
    cena.collection.objects.link(cam)
    cam.data.lens = 85
    cam.data.clip_start = 0.005
    anterior = cena.camera
    cena.camera = cam
    cena.render.resolution_x = cena.render.resolution_y = lado
    arquivos = []
    for nome, yaw, pitch in VISTAS:
        y, p = math.radians(yaw), math.radians(pitch)
        d = Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p)))
        cam.location = alvo + d * dist
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        arquivos.append(render_argila(os.path.join(pasta, f'{rotulo}-argila-{nome}.png'), objetos))
    cena.camera = anterior
    bpy.data.objects.remove(cam)
    folha = os.path.join(pasta, f'{rotulo}-argila-folha.png')
    rotulados = []
    for (nome, _, _), f in zip(VISTAS, arquivos):
        rotulados += ['(', f, '-gravity', 'north', '-pointsize', '22', '-annotate', '+0+6', nome, ')']
    subprocess.run(['convert', *rotulados, '+append', folha], check=True)
    return folha


def otimizar_glb(saida, posicao_float=False):
    """Passo final de toda exportação para o site: `node 3d/tools/props/otimizar.mjs` (meshopt + quantização, sem
    Draco: o decodificador Draco viria do gstatic, que a CSP de produção bloqueia). `posicao_float` para peças cujo
    site usa `nodes.X.geometry` fora do nó (ex.: calculadora do financeiro). Falha se o inventário mudar."""
    cmd = ['node', os.path.join(RAIZ, '3d/tools/props/otimizar.mjs'), os.path.abspath(saida)]
    subprocess.run(cmd + (['--posicao-float'] if posicao_float else []), check=True, cwd=RAIZ)
    return saida


def exportar_glb(objetos, saida, otimizar=True, posicao_float=False):
    """Exporta só `objetos` (a coleção da peça) para glb: +Y para cima, modificadores aplicados, sem câmera nem luz,
    nomes de objeto preservados, SEM Draco, texturas como estão (JPEG/WebP definidos pelo lookdev) e, com `otimizar`,
    o passo final `otimizar_glb` (meshopt). `otimizar=False` deixa o glb cru (legível pelo importador do Blender, para
    provas). Depois de exportar, conferir o JSON: `node 3d/tools/props/glb.mjs <saida>` (extensão esperada ausente =
    defeito)."""
    for o in bpy.context.scene.objects:
        o.select_set(o in set(objetos))
    os.makedirs(os.path.dirname(os.path.abspath(saida)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(saida),
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,  # extras do material (ex.: envMapIntensity do lookdev, lido por scene/envIntensity.ts)
        export_draco_mesh_compression_enable=False,
    )
    return otimizar_glb(saida, posicao_float) if otimizar else saida
