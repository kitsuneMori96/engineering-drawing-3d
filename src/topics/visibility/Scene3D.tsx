import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from '../../lib/math';
import { projLabel } from '../../lib/engine';
import {
  Ball,
  PanHandler,
  PlaneQuad,
  Tag,
  v3,
} from '../../lib/three-atoms';
import { useVisSystem } from './useVisSystem';
import { visFlowOf, type PtKey } from './chapters';
import { useVisStore } from './store';
import {
  coincidentPair,
  linePoint,
  parenthesized,
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
  const { A, B, C, D, E } = points;

  const live: Vec3[] = useMemo(
    () => [A, B, C, D, E].filter((p): p is Vec3 => p !== null),
    [A, B, C, D, E],
  );

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

  const baseIds: { id: string; color: string }[] = [
    { id: 'V', color: '#2563eb' },
    { id: 'H', color: '#059669' },
  ];
  const projs = [
    ...baseIds,
    ...(showV1 ? [{ id: 'V1', color: '#d97706' }] : []),
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

        {projs.map(({ id, color }) => {
          const def = sys.defs.get(id)!;
          return <PlaneQuad key={id} def={{ ...def, color }} sys={sys} pts={live} />;
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
              <meshBasicMaterial color={OBJ} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <Line points={[v3(A), v3(B), v3(C), v3(A)]} color={OBJ} lineWidth={2.6} />
            <Line points={[v3(D), v3(E)]} color="#b91c1c" lineWidth={3} />
          </>
        )}

        {/* 存在点的定位小球与标签 */}
        {(['A', 'B', 'C', 'D', 'E'] as PtKey[]).map((k) => {
          const p = points[k];
          if (!p) return null;
          if (kind === 'coincident') return null; // 已由上面成对绘制
          return (
            <group key={k}>
              {kind !== 'linePlane' && <Ball pos={p} r={0.15} color={OBJ} />}
              {layers.labels && <Tag pos={p} text={k} color={OBJ} />}
            </group>
          );
        })}

        {/* 各投影面上的投影 + 投射线 */}
        {projs.map(({ id, color }) => (
          <group key={id}>
            {(['A', 'B', 'C', 'D', 'E'] as PtKey[]).map((k) => {
              const p = points[k];
              if (!p) return null;
              const pp = sys.renderPos(id, p);
              return (
                <group key={k}>
                  {layers.projectors && (
                    <Line points={[v3(p), v3(pp)]} color="#94a3b8" dashed dashSize={0.34} gapSize={0.2} lineWidth={1.1} />
                  )}
                  <Ball pos={pp} r={0.1} color={color} />
                  {tagFor(k, id) && (
                    <Tag pos={pp} text={tagFor(k, id)!} color={color} dy={isInvisTag(k, id) ? 0.95 : 0.32} />
                  )}
                </group>
              );
            })}
          </group>
        ))}
      </Canvas>
      <div className={`mode-badge ${panMode ? 'pan' : ''}`}>
        {panMode ? '平移中 · 移动鼠标平移画面(右键单击退出)' : '旋转模式 · 右键单击开始平移'}
      </div>
    </div>
  );
}
