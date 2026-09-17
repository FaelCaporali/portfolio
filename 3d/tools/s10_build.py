"""Receita completa do S10, no Blender interativo:  import s10_build; s10_build.run()
S07 -> textura no lugar, bigode, lábio inferior discreto (arcada retraída), olho D = E espelhado, cirurgia dos olhos, expressões. Salva no NEUTRO."""
import bpy, os, sys, importlib
ROOT = '/home/fael/projects/portfolio/3d/'
def run(expr=True, name='s10', head=False):
    os.environ['S_EYE'] = 's10_eye'
    bpy.ops.wm.open_mainfile(filepath=ROOT + 'blend/busto-s07.blend'); bpy.ops.wm.save_as_mainfile(filepath=ROOT + 'blend/busto-%s.blend' % name)
    import s09_face, s10_face; importlib.reload(s09_face); F = importlib.reload(s10_face)
    F.F9.restore_xz(); F.F9.moustache(); F.lower_lip(); F.mirror_eye()
    if head:
        import s11_head; H = importlib.reload(s11_head); V0 = H._V(); H.dome(smooth=120 if head == 's12' else 0)                                 # S11: crânio arredondado e laterais estreitas (só cabelo)
        if head == 's12':
            H.sides(); H.sides(); H.relax(V0); H.ears(); H.width_report()
            import s12_tex; TX = importlib.reload(s12_tex); TX.top_patch(); TX.nostril()                                   # S12: remendo cinza do topo vira cabelo                                           # S12: cabelo atrás das orelhas medido contra a foto de longe (ref-22)
    c = ROOT + 'analise/gate/olhos_centro_s10.json'
    if os.path.exists(c): os.remove(c)
    import s10_eye; E = importlib.reload(s10_eye); E.UPPER_WALL = (head == 's12')
    E.build('D', F.CD[0], F.CD[1], pitch=-5, yaw=3.4); E.build('E', F.CE[0], F.CE[1], pitch=-5, yaw=-3.4)
    if expr:
        import s08_expr; X = importlib.reload(s08_expr); X.build_all()
    for ob in bpy.data.objects:
        if ob.type == 'MESH' and ob.data.shape_keys:
            for k in ob.data.shape_keys.key_blocks: k.value = 0.0
    bpy.ops.wm.save_mainfile()
