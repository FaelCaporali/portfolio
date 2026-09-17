"""blender -b --python tools/r_anim.py -- <in.blend> <out.blend> [video.mp4]
Cria a animação de demonstração das expressões (shape keys do MPFB) e, se pedido, renderiza o vídeo.
Basta apertar Espaço no Blender para ver."""
import bpy, sys, os, math
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[:2]; vid = a[2] if len(a) > 2 else None
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); sc = bpy.context.scene
bu = bpy.data.objects['Busto']; kb = bu.data.shape_keys.key_blocks
sc.render.fps = 24; sc.frame_start = 1; sc.frame_end = 240
# (quadro, {chave: valor}) — piscar, sorriso, sobrancelhas, fala, surpresa
POSES = [
    (1, {}), (18, {}),
    (22, {'eye-left-closure': 1.0, 'eye-right-closure': 1.0}), (26, {}),
    (46, {}),
    (60, {'mouth-corner-puller': 0.9, 'mouth-upward-retraction': 0.4, 'eye-left-closure': 0.25, 'eye-right-closure': 0.25}),
    (84, {'mouth-corner-puller': 0.9, 'mouth-upward-retraction': 0.4, 'eye-left-closure': 0.25, 'eye-right-closure': 0.25}),
    (100, {}),
    (112, {'eyebrows-left-up': 1.0, 'eyebrows-right-up': 1.0, 'eye-left-opened-up': 0.8, 'eye-right-opened-up': 0.8}),
    (136, {'eyebrows-left-up': 1.0, 'eyebrows-right-up': 1.0, 'eye-left-opened-up': 0.8, 'eye-right-opened-up': 0.8}),
    (150, {}),
    (160, {'mouth-open': 0.5}), (168, {'mouth-part-later': 0.6}), (176, {'mouth-open': 0.7}), (184, {'mouth-pursing': 0.5}), (192, {'mouth-open': 0.4}), (200, {}),
    (212, {'eyebrows-left-down': 0.8, 'eyebrows-right-down': 0.8, 'mouth-compression': 0.7}),
    (228, {'eyebrows-left-down': 0.8, 'eyebrows-right-down': 0.8, 'mouth-compression': 0.7}),
    (240, {}),
]
base = {'eye-left-closure': 0.25, 'eye-right-closure': 0.25}
names = [k.name for k in kb if k.name != 'Basis']
for fr, pose in POSES:
    vals = dict(base); vals.update(pose)
    for n in names:
        kb[n].value = vals.get(n, 0.0); kb[n].keyframe_insert('value', frame=fr)
for fc in bu.data.shape_keys.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
print("R_ANIM %d chaves, %d quadros" % (len(names), sc.frame_end))
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
if vid:
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError: sc.render.engine = 'BLENDER_EEVEE'
    w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.32, 0.33, 0.35, 1); bg.inputs[1].default_value = 0.75
    from mathutils import Vector
    for nm_, loc, en in (('S1', (0.5, -0.8, 0.8), 45.0), ('S2', (-0.7, -0.6, 0.3), 22.0)):
        lt = bpy.data.lights.new(nm_, 'AREA'); lt.energy = en; lt.size = 1.0
        lo = bpy.data.objects.new(nm_, lt); lo.location = loc; sc.collection.objects.link(lo)
        lo.rotation_euler = (-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 85; cam.location = (0.03, -0.62, 0.17); cam.rotation_euler = (math.radians(92), 0, math.radians(3))
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = 720, 720
    sc.render.image_settings.file_format = 'FFMPEG'; sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'; sc.render.ffmpeg.constant_rate_factor = 'HIGH'
    sc.render.filepath = os.path.abspath(vid)
    bpy.ops.render.render(animation=True); print("R_ANIM video", vid)
