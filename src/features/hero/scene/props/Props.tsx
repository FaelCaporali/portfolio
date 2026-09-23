import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { withDissolve } from '../dissolve'
import type { PropId } from '../../../../content/journey'

/**
 * Adereços por vida — BLOCKOUT em primitivas, para aprovar forma, tamanho e posição antes da modelagem no Blender.
 * Coordenadas no espaço do glb do S13 (metros na escala do scan, Y para cima, rosto para +Z), medidas na malha:
 * topo da cabeça y 0,32; olhos y 0,18, z −0,02, x ±0,04; orelhas x ±0,09, y 0,17–0,19, z −0,08 a −0,18;
 * crânio a y 0,22: x ±0,09, z −0,30 a 0,01; boca y 0,10, z 0,02.
 */
function useMat(color: string, o: THREE.MeshStandardMaterialParameters = {}) {
  return useMemo(
    () => withDissolve(new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o })), // eslint-disable-next-line react-hooks/exhaustive-deps
    [color],
  )
}

const GOLD = { metalness: 0.55, roughness: 0.28, emissive: new THREE.Color('#5a3d00'), emissiveIntensity: 0.6 }
const GLOSS = { roughness: 0.25 }
const GLOW = { emissive: new THREE.Color('#29d8ff'), emissiveIntensity: 1.6 }

function Float({
  children,
  speed = 1,
  amp = 0.006,
  ...p
}: { children: React.ReactNode; speed?: number; amp?: number } & React.ComponentProps<'group'>) {
  const g = useRef<THREE.Group>(null)
  const y0 = (p.position as [number, number, number] | undefined)?.[1] ?? 0
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = y0 + Math.sin(clock.elapsedTime * speed) * amp
  })
  return (
    <group ref={g} {...p}>
      {children}
    </group>
  )
}

/** Casco sobre o crânio (boné, chapéu): elipsoide cortado, centro e raios medidos. */
function Dome({ color, y = 0.232 }: { color: string; y?: number }) {
  const m = useMat(color)
  return (
    <mesh position={[0, y, -0.12]} scale={[0.098, 0.092, 0.132]} material={m}>
      <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
    </mesh>
  )
}

/** Aba de boné: meia elipse só para a frente, saindo da borda do casco. */
function Brim({ color, y = 0.236, depth = 0.09 }: { color: string; y?: number; depth?: number }) {
  const m = useMat(color)
  return (
    <mesh position={[0, y, 0.0]} rotation={[0.22, 0, 0]} scale={[0.082, 1, depth]} material={m}>
      <cylinderGeometry args={[1, 1, 0.006, 40, 1, false, -Math.PI / 2, Math.PI]} />
    </mesh>
  )
}

function Headphones({ color = '#1b1d22', mic = false }: { color?: string; mic?: boolean }) {
  const m = useMat(color, GLOSS)
  const accent = useMat('#3ddc84', GLOSS)
  const boom = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.112, 0.175, -0.12),
          new THREE.Vector3(0.1, 0.12, -0.04),
          new THREE.Vector3(0.045, 0.098, 0.035),
        ]),
        24,
        0.0032,
        8,
      ),
    [],
  )
  return (
    <group>
      <mesh position={[0, 0.2, -0.13]} scale={[0.8, 1, 1]} material={m}>
        <torusGeometry args={[0.14, 0.008, 12, 48, Math.PI]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.106, 0.18, -0.13]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={m}>
            <cylinderGeometry args={[0.034, 0.034, 0.026, 32]} />
          </mesh>
          <mesh position={[0, s * 0.014, 0]} material={accent}>
            <cylinderGeometry args={[0.024, 0.024, 0.004, 32]} />
          </mesh>
        </group>
      ))}
      {mic && (
        <>
          <mesh geometry={boom} material={m} />
          <mesh position={[0.045, 0.098, 0.035]} material={m}>
            <sphereGeometry args={[0.009, 16, 12]} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Sunglasses() {
  const frame = useMat('#111214', GLOSS)
  const lens = useMat('#0d2233', { roughness: 0.05, metalness: 0.6 })
  return (
    <group position={[0, 0.183, 0.03]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.041, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]} material={lens}>
          <cylinderGeometry args={[0.026, 0.026, 0.004, 32]} />
        </mesh>
      ))}
      <mesh position={[0, 0.008, 0]} material={frame}>
        <boxGeometry args={[0.03, 0.004, 0.004]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.088, 0.004, -0.07]} rotation={[0, s * 0.12, 0]} material={frame}>
          <boxGeometry args={[0.004, 0.004, 0.14]} />
        </mesh>
      ))}
    </group>
  )
}

const NEURAL_NODES = 9

/** Nó i do anel neural (o índice dá a volta). */
function neuralNode(i: number) {
  const k = i % NEURAL_NODES
  const a = (k / NEURAL_NODES) * Math.PI * 2
  return new THREE.Vector3(Math.cos(a) * 0.19, Math.sin(k * 2.1) * 0.025, Math.sin(a) * 0.19)
}

function Neural() {
  const g = useRef<THREE.Group>(null)
  const node = useMat('#bff4ff', GLOW)
  const line = useMemo(
    () => withDissolve(new THREE.LineBasicMaterial({ color: '#29d8ff', transparent: true, opacity: 0.6 })),
    [],
  )
  const pts = useMemo(() => Array.from({ length: NEURAL_NODES }, (_, i) => neuralNode(i)), [])
  // Cada nó liga ao vizinho e ao terceiro seguinte no anel.
  const links = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => [p, neuralNode(i + 1), p, neuralNode(i + 3)])),
    [pts],
  )
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.35
  })
  return (
    <group position={[0, 0.25, -0.125]} rotation={[0.25, 0, 0.08]}>
      <group ref={g}>
        {pts.map((p, i) => (
          <mesh key={i} position={p} material={node}>
            <sphereGeometry args={[0.007, 16, 12]} />
          </mesh>
        ))}
        <lineSegments geometry={links} material={line} />
      </group>
    </group>
  )
}

function Magnifier() {
  const rim = useMat('#e0324b', GLOSS)
  const glass = useMat('#cfe8ff', { transparent: true, opacity: 0.18, roughness: 0.05 })
  return (
    <Float position={[-0.045, 0.172, 0.06]} speed={1.3} amp={0.004}>
      <group rotation={[0, 0.25, 0.5]}>
        <mesh material={rim}>
          <torusGeometry args={[0.034, 0.0045, 12, 48]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={glass}>
          <cylinderGeometry args={[0.032, 0.032, 0.002, 40]} />
        </mesh>
        <mesh position={[0, -0.068, 0]} material={rim}>
          <cylinderGeometry args={[0.0055, 0.0065, 0.07, 16]} />
        </mesh>
      </group>
    </Float>
  )
}

function Coins() {
  const gold = useMat('#ffcc3d', GOLD)
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.6
  })
  return (
    <group position={[0, 0.2, -0.125]}>
      <group ref={g}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.17, Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.17]}
              rotation={[Math.PI / 2, 0, a]}
              material={gold}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.004, 32]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

function Rocket() {
  const body = useMat('#f2f2f2', GLOSS)
  const red = useMat('#ff7a1a', GLOSS)
  const flame = useMat('#ffd166', { emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 2 })
  return (
    <Float position={[0.19, 0.2, -0.06]} speed={1.6} amp={0.01}>
      <group rotation={[0, 0, -0.35]}>
        <mesh material={body}>
          <cylinderGeometry args={[0.018, 0.02, 0.07, 24]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={red}>
          <coneGeometry args={[0.018, 0.032, 24]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i * 2 * Math.PI) / 3) * 0.02, -0.03, Math.sin((i * 2 * Math.PI) / 3) * 0.02]}
            rotation={[0, (-i * 2 * Math.PI) / 3, 0]}
            material={red}
          >
            <boxGeometry args={[0.018, 0.022, 0.003]} />
          </mesh>
        ))}
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]} material={flame}>
          <coneGeometry args={[0.012, 0.03, 16]} />
        </mesh>
      </group>
    </Float>
  )
}

function Sailboat() {
  const hull = useMat('#f2f2f2', GLOSS)
  const sail = useMat('#2ea8ff', { side: THREE.DoubleSide })
  const sailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.005, 0, 0, 0.075, 0, 0.045, 0.005, 0], 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <Float position={[-0.2, 0.1, -0.05]} speed={1.1} amp={0.008}>
      <group rotation={[0.1, 0.6, 0]}>
        <mesh scale={[1, 0.35, 0.4]} material={hull}>
          <sphereGeometry args={[0.04, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.04, 0]} material={hull}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.08, 8]} />
        </mesh>
        <mesh geometry={sailGeo} material={sail} />
      </group>
    </Float>
  )
}

function Compass() {
  const body = useMat('#ffd166', GOLD)
  const face = useMat('#101216')
  const needle = useMat('#ff4d4d', { emissive: new THREE.Color('#ff4d4d'), emissiveIntensity: 0.6 })
  const n = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (n.current) n.current.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.5
  })
  return (
    <Float position={[0.19, 0.13, -0.03]} speed={1.2}>
      <group rotation={[0.2, -0.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={body}>
          <cylinderGeometry args={[0.036, 0.036, 0.012, 40]} />
        </mesh>
        <mesh position={[0, 0, 0.0065]} rotation={[Math.PI / 2, 0, 0]} material={face}>
          <cylinderGeometry args={[0.031, 0.031, 0.001, 40]} />
        </mesh>
        <mesh ref={n} position={[0, 0, 0.008]} material={needle}>
          <coneGeometry args={[0.006, 0.05, 4]} />
        </mesh>
      </group>
    </Float>
  )
}

function Wheel() {
  const m = useMat('#2a2c31', GLOSS)
  return (
    <Float position={[0.2, 0.12, -0.04]} speed={0.9} amp={0.006}>
      <group rotation={[0.1, -0.5, 0.25]}>
        <mesh material={m}>
          <torusGeometry args={[0.075, 0.009, 14, 56]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            rotation={[0, 0, (i * 2 * Math.PI) / 3 + Math.PI / 2]}
            position={[
              Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 2) * 0.037,
              Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 2) * 0.037,
              0,
            ]}
            material={m}
          >
            <boxGeometry args={[0.075, 0.009, 0.006]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 24]} />
        </mesh>
      </group>
    </Float>
  )
}

function Tears() {
  const m = useMat('#9fd3ff', { transparent: true, opacity: 0.85, roughness: 0.05 })
  const drops = useRef<THREE.Mesh[]>([])
  useFrame(({ clock }) => {
    drops.current.forEach((d, i) => {
      const t = (clock.elapsedTime * 0.7 + i * 0.37) % 1
      d.position.y = 0.162 - t * 0.075
      d.position.z = 0.012 + t * 0.012
      d.scale.setScalar(t < 0.1 ? t * 10 : 1)
    })
  })
  return (
    <>
      {[-1, 1].flatMap((s) =>
        [0, 1].map((k) => (
          <mesh
            key={`${s}${k}`}
            ref={(el) => {
              if (el) drops.current[s + 1 + k] = el
            }}
            position={[s * 0.05, 0.16, 0.01]}
            scale={[1, 1.5, 1]}
            material={m}
          >
            <sphereGeometry args={[0.0045, 12, 10]} />
          </mesh>
        )),
      )}
    </>
  )
}

export function Props({ id }: { id: PropId }) {
  switch (id) {
    case 'neural':
      return <Neural />
    case 'magnifier':
      return <Magnifier />
    case 'coins':
      return <Coins />
    case 'headphones':
      return <Headphones />
    case 'rocket':
      return <Rocket />
    case 'headset':
      return <Headphones color="#26222e" mic />
    case 'sailor':
      return (
        <>
          <Dome color="#f4f4f2" />
          <Brim color="#1d3557" />
          <Sunglasses />
          <Sailboat />
        </>
      )
    case 'compass':
      return <Compass />
    case 'uber':
      return (
        <>
          <Dome color="#111214" />
          <Brim color="#111214" />
          <Wheel />
          <Tears />
        </>
      )
  }
}
