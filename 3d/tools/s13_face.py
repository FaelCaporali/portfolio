"""S13 (P1 da auditoria): contorno do olho D com a ASSIMETRIA REAL medida na foto ref-15, aplicada sobre a forma boa do E espelhado.
Medido em analise/gate/olhos_foto_ref-15.json (MediaPipe, frações da largura do olho):
  D: margem sup 0,174, inf 0,162, canto lateral 3,4 graus mais alto que o medial;  E: sup 0,155, inf 0,171, cantos nivelados.
asym_D(): lê olhos_contorno_s10.json (D = E espelhado); escala dos ramos DESLIGADA (up=low=1: abrir mais a margem superior foi na direção errada, a foto cobre o topo da íris);
à corda canto-a-canto, gira a corda 3,7 graus a mais que o E (lateral para cima; o E do scan já tem 2,9 graus, a foto diz que o D tem 3,7 a mais) e grava olhos_contorno_s13.json."""
import json, numpy as np
ROOT = '/home/fael/projects/portfolio/3d/'
def asym_D(up=1.0, low=1.0, tilt_deg=-3.7, src='olhos_contorno_s10.json', out='olhos_contorno_s13.json'):
    C = json.load(open(ROOT + 'analise/gate/' + src)); D = np.array(C['D'], float)
    i_lat, i_med = int(np.argmin(D[:, 0])), int(np.argmax(D[:, 0]))          # olho D: lateral = x mais negativo
    a, b = D[i_lat], D[i_med]; d = (b - a)/np.linalg.norm(b - a); n = np.array([-d[1], d[0]])   # n aponta para cima (z)
    h = (D - a) @ n; t = (D - a) @ d
    h2 = np.where(h > 0, h*up, h*low)
    th = np.radians(tilt_deg); d2 = np.array([np.cos(th)*d[0] - np.sin(th)*d[1], np.sin(th)*d[0] + np.cos(th)*d[1]])
    # girar em torno do centro da corda: lateral (t=0) sobe, medial desce, mantendo o centro no lugar
    c = a + d*(t.max()/2); t2 = t - t.max()/2; n2 = np.array([-d2[1], d2[0]])
    D2 = c + np.outer(t2, d2) + np.outer(h2, n2)
    C['D'] = D2.round(2).tolist(); C['_doc'] = C.get('_doc', '') + ' | olhos_contorno_s13: D com assimetria da ref-15 (s13_face.asym_D)'
    json.dump(C, open(ROOT + 'analise/gate/' + out, 'w'), indent=1)
    ab = lambda P: (np.max((P - P[i_lat]) @ n) - np.min((P - P[i_lat]) @ n))
    print('ASYM D: abertura %.2f -> %.2f mm; canto lateral z %.2f -> %.2f, medial %.2f -> %.2f' % (ab(D), ab(D2), a[1], D2[i_lat][1], b[1], D2[i_med][1]))
if __name__ == '__main__': asym_D()
