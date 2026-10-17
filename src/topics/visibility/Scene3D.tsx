import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from '../../lib/math';
import { cross3, norm3 } from '../../lib/math';
import { projLabel } from '../../lib/engine';
import {
  Ball,
  PanHandler,
  PlaneQuad,
  Tag,
  v3,
} from '../../lib/three-atoms';
import { useVisSystem } from './useVisSystem';
import { ALL_PTS, visFlowOf, type PtKey } from './chapters';
import { useVisStore } from './store';
import {
  coincidentPair,
  hiddenInterval,
  linePoint,
  lineVsPlane,
  parenthesized,
  planePlane,
  projV,
  segSegCross,
  visibleOfCoincident,
} from './vis';

const OBJ = '#ef4444';
const DERIVED = '#d97706';
const SIGHT = '#0ea5e9';

export default function Scene3D() {
  const sys = useVisSystem();
  const points = useVisStore((s) => s.points);
  const layers = useVisStore((s) => s.layers);
  const chapter = useVisStore((s) => s.chapter);
  const step = useVisStore((s) => s.step);
  const showV1 = useVisStore((s) => s.showV1);
  const [panMode, setPanMode] = useState(false);

  const flow = visFlowOf(chapter);
  const kind = flow.features.kind;
  const { A, B, C, D, E, F } = points;

  const live: Vec3[] = useMemo(
    () => ALL_PTS.map((k) => points[k]).filter((p): p is Vec3 => p !== null),
    [points],
  );

  // 对象几何的"段":各段在每个投影面上的投影即面内投影连线
  const objSegs = useMemo(() => {
    const keys: [PtKey, PtKey][] =
      kind === 'linePlane'
        ? [['A', 'B'], ['B', 'C'], ['C', 'A'], ['D', 'E']]
        : kind === 'planePlane'
          ? [['A', 'B'], ['B', 'C'], ['C', 'A'], ['D', 'E'], ['E', 'F'], ['F', 'D']]
          : [['A', 'B'], ['C', 'D']];
    return keys
      .map(([k1, k2]) => [points[k1], points[k2]] as [Vec3, Vec3])
      .filter(([p1, p2]) => p1 && p2);
  }, [kind, points]);

  /* ch0 重影(3D 中高亮"视线段") */
  const abV = A && B && coincidentPair(A, B, 'V');
  const cdH = C && D && coincidentPair(C, D, 'H');
  const abVisV = A && B ? visibleOfCoincident(A, B, 'V') : null;
  const cdVisH = C && D ? visibleOfCoincident(C, D, 'H') : null;
  const showParen = kind === 'coincident' && step >= 1;

  /* ch1 候选人 M∈AB, N∈CD(V 面交点) */
  const xV = A && B && C && D ? segSegCross(projV(A), projV(B), projV(C), projV(D)) : null;
  const candV = useMemo(() => {
    if (!xV || !A || !B || !C || !D) return null;
    return { M: linePoint(A, B, xV.t), N: linePoint(C, D, xV.u) };
  }, [xV, A, B, C, D]);

  /* ch2 线面交点 K 与被挡空间段 */
  const lp =
    kind === 'linePlane' && A && B && C && D && E ? lineVsPlane(D, E, A, B, C) : null;
  const hidV =
    kind === 'linePlane' && A && B && C && D && E
      ? hiddenInterval('V', D, E, A, B, C)
      : null;
  const hidH =
    kind === 'linePlane' && A && B && C && D && E
      ? hiddenInterval('H', D, E, A, B, C)
      : null;

  /* ch3 两面交线 */
  const pp =
    kind === 'planePlane' && A && B && C && D && E && F
      ? planePlane(A, B, C, D, E, F)
      : null;
  const ppHit = pp?.hit ?? null;

  const baseIds: { id: string; color: string }[] = [
    { id: 'V', color: '#1d4ed8' },
    { id: 'H', color: '#047857' },
  ];
  const projs = [
    ...baseIds,
    ...(showV1 ? [{ id: 'V1', color: '#b45309' }] : []),
  ];
  const triGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    if (A && B && C) {
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([...v3(A), ...v3(B), ...v3(C)], 3),
      );
      g.computeVertexNormals();
    }
    return g;
  }, [A, B, C]);

  const triGeo2 = useMemo(() => {
    const g = new THREE.BufferGeometry();
    if (D && E && F) {
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([...v3(D), ...v3(E), ...v3(F)], 3),
      );
      g.computeVertexNormals();
    }
    return g;
  }, [D, E, F]);

  /** ch3:实体三角双 mesh(前/背面),color 按平面区分 */
  const solidTri = (geo: THREE.BufferGeometry, front: string, back: string) => (
    <>
      <mesh geometry={geo}>
        <meshBasicMaterial
          color={front}
          transparent
          opacity={0.5}
          side={THREE.FrontSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial
          color={back}
          transparent
          opacity={0.5}
          side={THREE.BackSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </>
  );

  const triNormal = useMemo(
    () => (A && B && C ? norm3(cross3([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]])) : null),
    [A, B, C],
  );

  const isInvisTag = (k: PtKey, id: string): boolean => {
    if (!showParen) return false;
    if (id === 'V' && ((k === 'A' && abV && abVisV !== A) || (k === 'B' && abV && abVisV !== B)))
      return true;
    if (id === 'H' && ((k === 'C' && cdH && cdVisH !== C) || (k === 'D' && cdH && cdVisH !== D)))
      return true;
    return false;
  };

  const tagFor = (k: PtKey, id: string): string | null => {
    if (!layers.labels) return null;
    const base = projLabel(k.toLowerCase(), id);
    if (showParen && id === 'V' && ((k === 'A' && abV && abVisV !== A) || (k === 'B' && abV && abVisV !== B)))
      return parenthesized(base);
    if (showParen && id === 'H' && ((k === 'C' && cdH && cdVisH !== C) || (k === 'D' && cdH && cdVisH !== D)))
      return parenthesized(base);
    return base;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPanMode((p) => !p);
  };

  return (
    <div className={`scene-wrap${panMode ? ' panning' : ''}`} onContextMenu={onContextMenu}>
      <Canvas
        camera={{ position: [10.5, 8.5, 14], fov: 38 }}
        style={{ background: 'linear-gradient(#eef2f7, #e2e8f0)' }}
      >
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[3.5, 2.2, 4]}
          maxPolarAngle={Math.PI * 0.92}
          mouseButtons={{
            LEFT: panMode ? (-1 as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: -1 as unknown as THREE.MOUSE,
          }}
        />
        <PanHandler enabled={panMode} />
        <gridHelper args={[18, 18, '#cbd5e1', '#dbe3ec']} position={[4, 0, 4]} />
        <Line points={[[0, 0, 0], [11.6, 0, 0]]} color="#94a3b8" lineWidth={1} />
        <Html position={[11.9, 0, 0]} center><span className="axis3d">X</span></Html>
        <Html position={[0, 11.6, 0]} center><span className="axis3d">Y</span></Html>
        <Html position={[0, 0, 11.6]} center><span className="axis3d">Z</span></Html>

        {projs.map(({ id, color }, i) => {
          const def = sys.defs.get(id)!;
          return (
            <PlaneQuad
              key={id}
              def={{ ...def, color }}
              sys={sys}
              pts={live}
              opacity={id === 'V1' ? 0.36 : 0.4}
              renderOrder={i}
            />
          );
        })}

        {/* 对象几何 */}
        {kind === 'coincident' && A && B && (
          <>
            <Ball pos={A} r={0.16} color={OBJ} />
            <Ball pos={B} r={0.16} color={OBJ} />
            <Line points={[v3(A), v3(B)]} color={SIGHT} lineWidth={3.4} dashed dashSize={0.3} gapSize={0.18} />
            {showParen && layers.labels && (
              <Tag pos={[(A[0] + B[0]) / 2, Math.max(A[1], B[1]) + 0.5, (A[2] + B[2]) / 2]} text="视线沿深度方向" color={SIGHT} />
            )}
          </>
        )}
        {kind === 'coincident' && C && D && (
          <>
            <Ball pos={C} r={0.16} color={OBJ} />
            <Ball pos={D} r={0.16} color={OBJ} />
            <Line points={[v3(C), v3(D)]} color={SIGHT} lineWidth={3.4} dashed dashSize={0.3} gapSize={0.18} />
            {showParen && layers.labels && (
              <Tag pos={[(C[0] + D[0]) / 2, (C[1] + D[1]) / 2, Math.max(C[2], D[2]) + 0.6]} text="视线沿高度方向" color={SIGHT} />
            )}
          </>
        )}
        {kind === 'crossing' && A && B && C && D && (
          <>
            <Line points={[v3(A), v3(B)]} color={OBJ} lineWidth={3} />
            <Line points={[v3(C), v3(D)]} color={OBJ} lineWidth={3} />
            {candV && step >= 2 && (
              <>
                <Ball pos={candV.M} r={0.14} color={DERIVED} />
                <Ball pos={candV.N} r={0.14} color={DERIVED} />
                <Line
                  points={[v3(candV.M), v3(candV.N)]}
                  color={SIGHT}
                  dashed
                  dashSize={0.3}
                  gapSize={0.18}
                  lineWidth={2.4}
                />
                {layers.labels && (
                  <>
                    <Tag pos={candV.M} text="M ∈ AB" color={DERIVED} />
                    <Tag pos={candV.N} text="N ∈ CD" color={DERIVED} />
                  </>
                )}
              </>
            )}
          </>
        )}
        {kind === 'linePlane' && A && B && C && D && E && (
          <>
            <mesh geometry={triGeo}>
              <meshBasicMaterial
                color={OBJ}
                transparent
                opacity={0.5}
                side={THREE.FrontSide}
                depthWrite
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
            <mesh geometry={triGeo}>
              <meshBasicMaterial
                color="#991b1b"
                transparent
                opacity={0.5}
                side={THREE.BackSide}
                depthWrite
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
            <Line points={[v3(A), v3(B), v3(C), v3(A)]} color={OBJ} lineWidth={2.6} />
            {(() => {
              const iv = step >= 3 && layers.hidden ? (hidV ?? hidH) : null;
              if (!iv) return <Line points={[v3(D), v3(E)]} color="#b91c1c" lineWidth={3} />;
              const pA = linePoint(D, E, iv[0]);
              const pB = linePoint(D, E, iv[1]);
              return (
                <group>
                  <Line points={[v3(D), v3(pA)]} color="#b91c1c" lineWidth={3} />
                  <Line points={[v3(pA), v3(pB)]} color="#7f1d1d" lineWidth={3} dashed dashSize={0.26} gapSize={0.18} />
                  <Line points={[v3(pB), v3(E)]} color="#b91c1c" lineWidth={3} />
                </group>
              );
            })()}
            {/* K 线面交点:题目核心元素,自第一步常显(覆盖层,不被实体面遮挡) */}
            {lp && (
              <group position={v3(lp.K)} renderOrder={10}>
                <mesh renderOrder={10}>
                  <sphereGeometry args={[lp.insideTri ? 0.17 : 0.12, 20, 20]} />
                  <meshBasicMaterial
                    color={lp.insideTri ? '#f59e0b' : '#94a3b8'}
                    transparent
                    depthTest={false}
                  />
                </mesh>
                {lp.insideTri && triNormal && (
                  <mesh
                    renderOrder={10}
                    quaternion={new THREE.Quaternion().setFromUnitVectors(
                      new THREE.Vector3(0, 0, 1),
                      new THREE.Vector3(...triNormal),
                    )}
                  >
                    <ringGeometry args={[0.26, 0.32, 40]} />
                    <meshBasicMaterial
                      color="#ffffff"
                      transparent
                      opacity={0.9}
                      side={THREE.DoubleSide}
                      depthWrite={false}
                      depthTest={false}
                    />
                  </mesh>
                )}
              </group>
            )}
            {lp && layers.labels && (
              <Tag
                pos={lp.K}
                text={lp.insideTri ? 'K' : 'K(面外)'}
                color={lp.insideTri ? '#f59e0b' : '#64748b'}
              />
            )}
            {lp && lp.insideTri && step >= 2 &&
              projs.map(({ id }) => {
                const pp = sys.renderPos(id, lp.K);
                return (
                  <group key={id}>
                    <Ball pos={pp} r={0.09} color={DERIVED} overlay />
                    {layers.labels && (
                      <Tag pos={pp} text={projLabel('k', id)} color={DERIVED} dy={0.3} />
                    )}
                  </group>
                );
              })}
          </>
        )}

        {kind === 'planePlane' && A && B && C && D && E && F && (
          <>
            {solidTri(triGeo, '#ef4444', '#991b1b')}
            {solidTri(triGeo2, '#4f46e5', '#312e81')}
            <Line points={[v3(A), v3(B), v3(C), v3(A)]} color="#dc2626" lineWidth={2.6} />
            <Line points={[v3(D), v3(E), v3(F), v3(D)]} color="#4338ca" lineWidth={2.6} />
            {ppHit && (
              <group>
                <Line
                  points={[v3(ppHit.K), v3(ppHit.L)]}
                  color="#f59e0b"
                  lineWidth={4}
                  transparent
                  depthTest={false}
                  renderOrder={9}
                />
                <Ball pos={ppHit.K} r={0.15} color="#f59e0b" overlay />
                <Ball pos={ppHit.L} r={0.15} color="#f59e0b" overlay />
                {layers.labels && (
                  <>
                    <Tag pos={ppHit.K} text="K" color="#b45309" />
                    <Tag pos={ppHit.L} text="L" color="#b45309" />
                  </>
                )}
              </group>
            )}
            {ppHit &&
              step >= 4 &&
              projs.map(({ id }) =>
                (['K', 'L'] as const).map((which) => {
                  const p = which === 'K' ? ppHit.K : ppHit.L;
                  const pp2 = sys.renderPos(id, p);
                  return (
                    <group key={`${id}${which}`}>
                      <Ball pos={pp2} r={0.09} color={DERIVED} overlay />
                      {layers.labels && (
                        <Tag pos={pp2} text={projLabel(which.toLowerCase(), id)} color={DERIVED} dy={0.3} />
                      )}
                    </group>
                  );
                }))}
            {pp?.parallel && (
              <Tag
                pos={[
                  (A[0] + B[0] + C[0] + D[0] + E[0] + F[0]) / 6,
                  (A[1] + B[1] + C[1] + D[1] + E[1] + F[1]) / 6 + 1,
                  (A[2] + B[2] + C[2] + D[2] + E[2] + F[2]) / 6,
                ]}
                text="两平面平行"
                color="#64748b"
              />
            )}
          </>
        )}

        {/* 存在点的定位小球与标签 */}
        {ALL_PTS.map((k) => {
          const p = points[k];
          if (!p) return null;
          if (kind === 'coincident') return null; // 已由上面成对绘制
          const overlay = kind === 'linePlane' || kind === 'planePlane';
          const col = kind === 'planePlane' && (k === 'D' || k === 'E' || k === 'F') ? '#4f46e5' : OBJ;
          return (
            <group key={k}>
              <Ball pos={p} r={0.15} color={col} overlay={overlay} />
              {layers.labels && <Tag pos={p} text={k} color={col} />}
            </group>
          );
        })}

        {/* 各投影面上的投影 + 面内投影连线(对象各段在该面上的投影) */}
        {ALL_PTS.map((k) => {
          const p = points[k];
          if (!p) return null;
          return (
            <group key={k}>
              {projs.map(({ id, color }) => {
                const pp = sys.renderPos(id, p);
                return (
                  <group key={id}>
                    <Ball pos={pp} r={0.11} color={color} overlay />
                    {tagFor(k, id) && (
                      <Tag pos={pp} text={tagFor(k, id)!} color={color} dy={isInvisTag(k, id) ? 0.95 : 0.32} />
                    )}
                  </group>
                );
              })}
            </group>
          );
        })}
        {projs.map(({ id, color }) => (
          <group key={id}>
            {objSegs.map(([p1, p2], i) => (
              <Line
                key={i}
                points={[v3(sys.renderPos(id, p1)), v3(sys.renderPos(id, p2))]}
                color={color}
                dashed
                dashSize={0.3}
                gapSize={0.2}
                lineWidth={2}
              />
            ))}
          </group>
        ))}
      </Canvas>
      <div className={`mode-badge ${panMode ? 'pan' : ''}`}>
        {panMode ? '平移中 · 移动鼠标平移画面(右键单击退出)' : '旋转模式 · 右键单击开始平移'}
      </div>
    </div>
  );
}
