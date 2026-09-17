"""blender -b --python tools/s08_video.py -- <in.blend> <out.mp4>
Demonstração do S08: câmera orbita, os olhos acompanham a câmera, piscar natural e as expressões em sequência.
O arquivo de origem não é alterado (nada é salvo)."""
import bpy, sys, os, math, subprocess, shutil
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[0], os.path.abspath(a[1]); tmp = out + '.frames'; os.makedirs(tmp, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); sc = bpy.context.scene
for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try: sc.render.engine = e; break
    except TypeError: pass
sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x, sc.render.resolution_y = 720, 720; sc.render.image_settings.file_format = 'PNG'
if sc.world: sc.world.use_nodes = False; sc.world.color = (0.035, 0.035, 0.045)
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 85
MESH = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys]; G0 = {s: tuple(bpy.data.objects['Olho_'+s].rotation_euler) for s in 'DE'}
FPS = 24
def ss(t, a, b): x = min(1, max(0, (t-a)/(b-a))); return x*x*(3-2*x)
def pulse(t, a, b, c, d): return ss(t, a, b)*(1 - ss(t, c, d))
def blink(t, t0): return pulse(t, t0, t0+0.07, t0+0.10, t0+0.22)
def state(t):
    th = 28*math.sin(2*math.pi*t/10.0)                                                  # órbita da câmera (graus)
    k = {}; b = max(blink(t, 0.7), blink(t, 3.4), blink(t, 6.1), blink(t, 8.8))
    sm = pulse(t, 2.0, 2.8, 4.2, 4.9); k['mouthSmileLeft'] = sm; k['mouthSmileRight'] = sm
    sk = pulse(t, 4.9, 5.5, 6.3, 6.8); k['mouthSmileLeft'] = max(k['mouthSmileLeft'], sk); k['mouthSmileRight'] = max(k['mouthSmileRight'], 0.35*sk); k['browOuterUpLeft'] = 0.6*sk
    su = pulse(t, 6.8, 7.1, 7.7, 8.1); k['browInnerUp'] = 0.8*su; k['browOuterUpLeft'] = max(k['browOuterUpLeft'], su); k['browOuterUpRight'] = su
    co = pulse(t, 8.1, 8.5, 9.2, 9.6); k['browDownLeft'] = co; k['browDownRight'] = co
    wk = pulse(t, 9.5, 9.6, 9.75, 9.95)
    k['eyeBlinkLeft'] = max(b, 0.18*co); k['eyeBlinkRight'] = max(b, 0.18*co, wk)
    return th, k
N = int(10*FPS)
for f in range(N):
    t = f/FPS; th, k = state(t); r = math.radians(th)
    cam.location = (math.sin(r)*1.25, 0.10 - math.cos(r)*1.25, 0.175); cam.rotation_euler = (math.radians(90), 0, r)
    for o in MESH:
        for kb in o.data.shape_keys.key_blocks: kb.value = k.get(kb.name, 0.0)
    for s in 'DE':
        g = G0[s]; bpy.data.objects['Olho_'+s].rotation_euler = (g[0], 0, g[2] + max(-0.4, min(0.4, r)))
    sc.render.filepath = os.path.join(tmp, '%04d.png' % f); bpy.ops.render.render(write_still=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out], check=True)
for f in (0.0, 3.0, 5.9, 7.4, 8.8, 9.68): shutil.copy(os.path.join(tmp, '%04d.png' % int(f*FPS)), out.replace('.mp4', '_t%04.1f.png' % f))
shutil.rmtree(tmp); print("VIDEO", out)
