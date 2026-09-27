"""Encaixe do headset no busto S13 (vida `techlead`): tudo MEDIDO na malha do site, nada de tabela.

- Orelha: o scan não tem orelha em relevo (só pintura). A pele pintada da orelha, medida pela cor da textura, vai de
  y 0,097 a 0,178 e z −0,15 a −0,09 nos dois lados (o topo da hélice some sob o cabelo, ~0,19). Centro da concha em
  (y, z) = ORELHA_YZ; o x é a pele naquele ponto (raio de fora para dentro).
- Plano da concha: plano ajustado (SVD) à pele num disco do raio da almofada em volta do centro; o eixo da concha é a
  normal dele (limitado a INCL_MAX do eixo X puro).
- Almofada: altura da pele sobre o plano medida por raio em cada ponto; o plano de contato fica no percentil CONTATO_P
  e o que passa dele comprime a espuma (a face de dentro da almofada segue a pele).
- Arco: curva de Hermite no plano das conchas; a altura do ápice é resolvida para a folga da almofada do arco ao
  cabelo ficar em FOLGA_ARCO.
"""
import math

import numpy as np

import prop_techlead_geo as G

ORELHA_YZ = (0.146, -0.118)                  # centro da concha no glb (medido pela pintura da orelha)
RAIO_ALMOFADA = G.R(31.0)                    # almofada on-ear de 62 mm reais
CONTATO_P = 88                               # percentil da altura da pele que vira o plano de contato
INCL_MAX = math.radians(16)
FOLGA_ARCO = 0.0015                          # almofada do arco × cabelo no topo (pedido: 0–3 mm)


class Encaixe:
    def __init__(self, busto):
        self.b = busto

    def perto(self, p):
        """(ponto mais próximo, normal, distância com sinal) da pele, em glb; negativo = dentro."""
        r = self.b.perto(G.bl(p))
        return G.gl(r[0]), G.gl(r[1]), r[2]

    def raio(self, p, d):
        """Primeiro ponto da pele saindo de p na direção −d (raio de fora para dentro); None se não bate."""
        d = G.un(d)
        h = self.b.raio(G.bl(np.asarray(p) - d * 0.6), G.bl(d))
        return None if h is None else G.gl(h[0])

    def lateral(self, y, z, s):
        return self.raio((s * 0.3, y, z), (s, 0, 0))

    def copa(self, s):
        """Quadro da concha do lado s (+1 = esquerda do Fael, +X): centro na pele, eixo n (para fora), up, frente,
        e o mapa de alturas da pele sobre o plano (para o contato e a compressão da espuma)."""
        y0, z0 = ORELHA_YZ
        c = self.lateral(y0, z0, s)
        pts = []
        for dy in np.linspace(-RAIO_ALMOFADA, RAIO_ALMOFADA, 13):
            for dz in np.linspace(-RAIO_ALMOFADA, RAIO_ALMOFADA, 13):
                if dy * dy + dz * dz <= RAIO_ALMOFADA ** 2:
                    q = self.lateral(y0 + dy, z0 + dz, s)
                    if q is not None:
                        pts.append(q)
        pts = np.array(pts)
        _, _, vt = np.linalg.svd(pts - pts.mean(0))
        n = vt[2] * np.sign(vt[2][0] * s)
        eixo = np.array((s, 0.0, 0.0))
        ang = math.acos(min(1.0, float(np.dot(n, eixo))))
        if ang > INCL_MAX:
            k = INCL_MAX / ang
            n = G.un(eixo * (1 - k) + n * k)
        up = G.un(np.array((0, 1.0, 0)) - n * n[1])
        fr = np.cross(n, up) * s
        fr = fr if fr[2] > 0 else -fr
        q = {'s': s, 'c_pele': c, 'n': n, 'up': up, 'fr': fr, 'ang_graus': math.degrees(math.acos(abs(n[0])))}
        q['alturas'] = self.alturas(c, n, up, fr)
        h = q['alturas'][:, 2]
        q['contato'] = float(np.percentile(h, CONTATO_P))
        q['compressao_max'] = float(h.max() - q['contato'])
        q['o'] = c + n * q['contato']                      # centro da face de contato da almofada
        return q

    def alturas(self, c, n, up, fr, r=None):
        r = r or RAIO_ALMOFADA
        out = []
        for a in np.linspace(-r, r, 17):
            for b in np.linspace(-r, r, 17):
                if a * a + b * b <= r * r:
                    h = self.altura(c, n, up, fr, a, b)
                    if h is not None:
                        out.append((a, b, h))
        return np.array(out)

    def altura(self, c, n, up, fr, a, b):
        """Altura da pele (ao longo de n) sobre o plano que passa em c, no ponto (a em fr, b em up) do plano."""
        base = c + fr * a + up * b
        q = self.raio(base + n * 0.05, n)
        return None if q is None else float(np.dot(q - c, n))

    # ------------------------------------------------------------------------------------------------------ arco
    def arco(self, S, U, amostras=161, k1=0.20, k2=0.105, ya=None, folga_fn=None):
        """Linha de centro do aço: Hermite de S[−1] (topo do deslizador D, subindo por U[−1]) ao ápice e dele ao topo
        do deslizador E (descendo por −U[+1]). Se `folga_fn(pts)` → folga mínima, resolve a altura do ápice."""
        sd, se = np.asarray(S[-1]), np.asarray(S[1])
        ud, ue = np.asarray(U[-1]), np.asarray(U[1])

        def curva(y):
            a = np.array((0.5 * (sd[0] + se[0]), y, 0.5 * (sd[2] + se[2])))
            m = np.array((k2 * 2, 0, 0))
            p1 = G.hermite(sd, ud * k1, a, m, amostras // 2 + 1)
            p2 = G.hermite(a, m, se, -ue * k1, amostras // 2 + 1)
            return np.concatenate([p1, p2[1:]])

        y = ya if ya is not None else 0.33
        rel = []
        if folga_fn is not None:
            for _ in range(6):
                f = folga_fn(curva(y))
                rel.append((round(y, 5), round(f * 1000, 2)))
                if abs(f - FOLGA_ARCO) < 0.0001:
                    break
                y -= (f - FOLGA_ARCO)
        return curva(y), y, rel
