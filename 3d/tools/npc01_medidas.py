"""blender -b blend/toon-npc-01.blend --python tools/npc01_medidas.py — medidas do rosto do NPC em % da interocular (cantos externos dos olhos),
comparaveis com a coluna 'foto' de tools/r_lmcompare.py (ref-15). Estimativas geometricas na malha, nao por detector."""
import bpy, numpy as np
o = bpy.data.objects['NPC01']; V = np.array([v.co[:] for v in o.data.vertices]); G = {}
for g in o.vertex_groups: G[g.name] = np.zeros(len(V), bool)
for v in o.data.vertices:
    for g in v.groups: G[o.vertex_groups[g.group].name][v.index] = True
eL = np.array(bpy.data.objects['Eye.L'].bound_box).mean(0) + np.array(bpy.data.objects['Eye.L'].location); eR = np.array(bpy.data.objects['Eye.R'].bound_box).mean(0) + np.array(bpy.data.objects['Eye.R'].location)
r = (bpy.data.objects['Eye.L'].dimensions[0]) / 2
iod = (eL[0] - eR[0]) + 2 * r * 0.95   # cantos externos ~ centro +- 0.95 r
lips = V[G['lips']]; mc = lips.mean(0); boca = lips[:, 0].max() - lips[:, 0].min()
chin = float(bpy.data.objects['NPC01.rig'].data.bones['jaw'].tail_local[2])
H = V[V[:, 2] > chin]; tip = H[np.argmin(H[:, 1])]; nb = V[(V[:, 1] < tip[1] + 0.03) & (V[:, 2] > tip[2] - 0.01) & (V[:, 2] < tip[2] + 0.02)]; nariz = nb[:, 0].max() - nb[:, 0].min()
nose_base_z = V[(V[:, 1] < tip[1] + 0.03) & (np.abs(V[:, 0]) < 0.012) & (V[:, 2] < tip[2] + 0.01)][:, 2].min()
face = V[(np.abs(V[:, 2] - eL[2]) < 0.01) & (V[:, 1] < -0.10) & ~G['ears']]; rosto_l = face[:, 0].max() - face[:, 0].min()
hl = bpy.data.objects['Hair']; Hh = np.array([v.co[:] for v in hl.data.vertices]); hair_front = Hh[(np.abs(Hh[:, 0]) < 0.01) & (Hh[:, 1] < -0.15)][:, 2].min()
rosto_a = hair_front - chin
olho_l = 2 * r * 0.95; nariz_boca = nose_base_z - lips[:, 2].max(); boca_queixo = lips[:, 2].min() - chin
bb = np.array([v.co[:] for v in bpy.data.objects['Brows'].data.vertices]); sob = np.abs(bb[:, 0]).min() * 2
foto = {'boca largura': 50.8, 'nariz largura': 45.9, 'olho largura': 31.5, 'sobrancelhas dist': 30.4, 'rosto largura': 141.5, 'rosto altura': 179.2, 'boca-queixo': 33.1, 'nariz-boca': 21.0}
npc = {'boca largura': boca, 'nariz largura': nariz, 'olho largura': olho_l, 'sobrancelhas dist': sob, 'rosto largura': rosto_l, 'rosto altura': rosto_a, 'boca-queixo': boca_queixo, 'nariz-boca': nariz_boca}
print("MEDIDA (%% interocular)   foto    NPC   dif"); 
for k in foto: v = 100 * npc[k] / iod; print("%-22s %6.1f %6.1f %+6.0f%%" % (k, foto[k], v, 100 * (v - foto[k]) / foto[k]))
top = V[:, 2].max(); print("altura total %.3f m, cabeca (queixo-topo) %.3f m, razao 1:%.2f, interocular %.3f m" % (top, top - chin, top / (top - chin), iod))
