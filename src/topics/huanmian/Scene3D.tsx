import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec2, Vec3 } from '../../lib/math';
import { add2, add3, fmt1, len3, mul3, norm2, norm3, sub3 } from '../../lib/math';
import { projLabel, type PlaneDef } from '../../lib/engine';
import { useSystem } from './useSystem';
import {
  AxisLine,
  AxisMeasure,
  Ball,
  PanHandler,
  PlaneQuad,
  Tag,
  localToWorld,
  v3,
} from '../../lib/three-atoms';
import { flowOf } from './chapters';
import { useStore } from './store';

const OBJ = '#ef4444';
const MEAS = '#c026d3';
const MEAS_BAD = '#dc2626';

// 实长/实形线段标注(镜像 Sheet2D showTL):两投影点连线沿面内法向偏移后画出 + 判定文字
function SegTL({
  sys,
  planeId,
  pa,
  pb,
  name,
  real,
  variant,
}: {
  sys: ReturnType<typeof useSystem>;
  planeId: string;
  pa: Vec3;
  pb: Vec3;
  name: string;
  real: number;
  variant: 'tl' | 'shape';
}) {
  const f = sys.renderFrame(planeId);
  const la = sys.local(planeId, pa);
  const lb = sys.local(planeId, pb);
  const proj = Math.hypot(lb[0] - la[0], lb[1] - la[1]);
  const eq = Math.abs(proj - real) < 0.05;
  const color = eq ? MEAS : MEAS_BAD;
  const d = norm2([lb[0] - la[0], lb[1] - la[1]]);
  const off: Vec2 = [-d[1] * 0.4, d[0] * 0.4];
  const a = add2(la, off);
  const b = add2(lb, off);
  const mid: Vec2 = [(a[0] + b[0]) / 2 + off[0], (a[1] + b[1]) / 2 + off[1]];
  const text =
    variant === 'tl'
      ? eq
        ? `${name} = |AB| = ${fmt1(real)}`
        : `${name} = ${fmt1(proj)} ≠ 实长 ${fmt1(real)}`
      : eq
        ? `${name} = ${fmt1(real)}(实形)`
        : `${name} = ${fmt1(proj)} ≠ ${fmt1(real)}`;
  return (
    <>
      <Line
        points={[v3(localToWorld(f, a)), v3(localToWorld(f, b))]}
        color={color}
        lineWidth={2.8}
      />
      <Html position={v3(localToWorld(f, mid))} center zIndexRange={[12, 0]}>
        <span className="meas3d" style={{ color }}>
          {text}
        </span>
      </Html>
    </>
  );
}

export default function Scene3D() {
  const sys = useSystem();
  const points = useStore((s) => s.points);
  const layers = useStore((s) => s.layers);
  const showAxis = useStore((s) => s.showAxis);
  const showAxis2 = useStore((s) => s.showAxis2);
  const showTL = useStore((s) => s.showTL);
  const chapter = useStore((s) => s.chapter);
  const features = flowOf(chapter).features;
  const [panMode, setPanMode] = useState(false);
  const { A, B, C } = points;
  // 平面章节(3/4)才引入第三点与三角形面
  const isPlane = features.thirdPoint;
  // 面片/轴线按这些点的投影范围自适应(直线章只有 A/B)
  const planePts: Vec3[] = isPlane ? [A, B, C] : [A, B];

  // 三角形面片(半透明,直观点与投影面的关系)
  const triGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...v3(A), ...v3(B), ...v3(C)], 3));
    g.computeVertexNormals();
    return g;
  }, [A, B, C]);

  // 右键单击切换平移:开启后鼠标移动即平移相机,再点一次右键回到旋转。
  // 右键不绑定任何拖动动作,避免按住右键拖动触发浏览器手势。
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPanMode((p) => !p);
  };

  // V₁ 及其投影在讲解引入它之前(showAxis=false)隐藏;H₂ 同理
  const baseIds: { id: string; color: string }[] = [
    { id: 'V', color: '#2563eb' },
    { id: 'H', color: '#059669' },
  ];
  const projs: { id: string; color: string }[] = [
    ...baseIds,
    ...(showAxis ? [{ id: 'V1', color: '#d97706' }] : []),
    ...(showAxis2 ? [{ id: 'H2', color: '#8b5cf6' }] : []),
  ];
  const planes: PlaneDef[] = projs.map((p) => sys.defs.get(p.id)!);
  const hDef = sys.defs.get('H')!;
  const v1Def = sys.defs.get('V1');
  const h2Def = sys.defs.get('H2');

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
        target={[3.5, 2.2, 4.5]}
        maxPolarAngle={Math.PI * 0.92}
        mouseButtons={{
          // 平移模式下左键不再拖动旋转(鼠标移动本身就是平移)
          LEFT:
            panMode
              ? (-1 as unknown as THREE.MOUSE)
              : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          // -1 是 OrbitControls 内部的"无动作"哨兵(switch 不匹配任何拖动行为);
          // 右键只承担单击切换模式,不绑定任何拖动,避免触发浏览器手势
          RIGHT: -1 as unknown as THREE.MOUSE,
        }}
      />
      <PanHandler enabled={panMode} />
      <gridHelper args={[18, 18, '#cbd5e1', '#dbe3ec']} position={[4, 0, 4]} />
      <Line points={[[0, 0, 0], [11.6, 0, 0]]} color="#94a3b8" lineWidth={1} />
      <Html position={[11.9, 0, 0]} center><span className="axis3d">X</span></Html>
      <Html position={[0, 11.6, 0]} center><span className="axis3d">Y</span></Html>
      <Html position={[0, 0, 11.6]} center><span className="axis3d">Z</span></Html>

      {/* 变换轴(独立于 layers.planes,始终跟随讲解步骤;长度覆盖投影点范围) */}
      <AxisLine sys={sys} def={hDef} pts={planePts} />
      {showAxis && v1Def && <AxisLine sys={sys} def={v1Def} pts={planePts} />}
      {showAxis2 && h2Def && <AxisLine sys={sys} def={h2Def} pts={planePts} />}

      {layers.planes && planes.map((def) => <PlaneQuad key={def.id} def={def} sys={sys} pts={planePts} />)}

      {/* 几何元素 */}
      <Line points={[v3(A), v3(B)]} color={OBJ} lineWidth={3} />
      {isPlane && (
        <mesh geometry={triGeo}>
          <meshBasicMaterial
            color={OBJ}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {isPlane && <Line points={[v3(B), v3(C)]} color={OBJ} lineWidth={3} />}
      {isPlane && <Line points={[v3(C), v3(A)]} color={OBJ} lineWidth={3} />}
      <Ball pos={A} r={0.16} color={OBJ} />
      <Ball pos={B} r={0.16} color={OBJ} />
      {isPlane && <Ball pos={C} r={0.16} color={OBJ} />}
      {layers.labels && (
        <>
          <Tag pos={A} text="A" color={OBJ} />
          <Tag pos={B} text="B" color={OBJ} />
          {isPlane && <Tag pos={C} text="C" color={OBJ} />}
        </>
      )}

      {/* 各面上的投影 + 投射线 */}
      {projs.map(({ id, color }) => {
        const pa = sys.renderPos(id, A);
        const pb = sys.renderPos(id, B);
        const pc = sys.renderPos(id, C);
        return (
          <group key={id}>
            {layers.projectors && (
              <>
                <Line points={[v3(A), v3(pa)]} color="#94a3b8" dashed dashSize={0.34} gapSize={0.2} lineWidth={1.1} />
                <Line points={[v3(B), v3(pb)]} color="#94a3b8" dashed dashSize={0.34} gapSize={0.2} lineWidth={1.1} />
                {isPlane && (
                  <Line points={[v3(C), v3(pc)]} color="#94a3b8" dashed dashSize={0.34} gapSize={0.2} lineWidth={1.1} />
                )}
              </>
            )}
            <Ball pos={pa} r={0.1} color={color} />
            <Ball pos={pb} r={0.1} color={color} />
            {isPlane && <Ball pos={pc} r={0.1} color={color} />}
            {/* 投影连线:线段/三角形在各面上的投影(镜像 Sheet2D 作图线) */}
            {layers.construct && (
              <>
                <Line points={[v3(pa), v3(pb)]} color={color} dashed dashSize={0.34} gapSize={0.2} lineWidth={2} />
                {isPlane && (
                  <>
                    <Line points={[v3(pb), v3(pc)]} color={color} dashed dashSize={0.34} gapSize={0.2} lineWidth={2} />
                    <Line points={[v3(pc), v3(pa)]} color={color} dashed dashSize={0.34} gapSize={0.2} lineWidth={2} />
                  </>
                )}
              </>
            )}
            {layers.labels && (
              <>
                <Tag pos={pa} text={projLabel('a', id)} color={color} />
                <Tag pos={pb} text={projLabel('b', id)} color={color} />
                {isPlane && <Tag pos={pc} text={projLabel('c', id)} color={color} />}
              </>
            )}
          </group>
        );
      })}

      {/* 等距规律:features.measuresV1 —— a′→OX 与 a₁→OX₁ 同值 */}
      {showAxis && layers.measures && features.measuresV1 && (
        <>
          <AxisMeasure sys={sys} planeId="V" point={A} />
          <AxisMeasure sys={sys} planeId="V1" point={A} />
        </>
      )}
      {/* 等距链:features.measuresH2 —— a→OX₁ 与 a₂→OX₂ 同值 */}
      {showAxis && showAxis2 && layers.measures && features.measuresH2 && h2Def && (
        <>
          <AxisMeasure
            sys={sys}
            planeId="H"
            point={A}
            axis={{ pos: v1Def!.axisPos, dir: norm2(v1Def!.axisDir) }}
          />
          <AxisMeasure sys={sys} planeId="H2" point={A} />
        </>
      )}
      {/* 实形对照(镜像 Sheet2D showTL):features.realShape 时画在 H₂ */}
      {showTL && showAxis && features.realShape && h2Def && (
        <>
          <SegTL sys={sys} planeId="H2" pa={A} pb={B} name="a₂b₂" real={len3(sub3(B, A))} variant="shape" />
          <SegTL sys={sys} planeId="H2" pa={A} pb={C} name="a₂c₂" real={len3(sub3(C, A))} variant="shape" />
        </>
      )}
      {showTL && showAxis && !features.realShape && v1Def && (
        <SegTL sys={sys} planeId="V1" pa={A} pb={B} name="a₁b₁" real={len3(sub3(B, A))} variant="tl" />
      )}
      {/* 积聚成线结论高亮:a₁b₁c₁ 共线 */}
      {features.collapseLine && showAxis && layers.construct && (() => {
        const pa = sys.renderPos('V1', A);
        const pc = sys.renderPos('V1', C);
        const dir = norm3(sub3(pc, pa));
        return (
          <Line
            points={[v3(add3(pa, mul3(dir, -1.4))), v3(add3(pc, mul3(dir, 1.4)))]}
            color={MEAS}
            lineWidth={4}
          />
        );
      })()}
      {/* 倾角 δ(积聚线与 OX₁ 的夹角;共线破坏时红色警告) */}
      {features.tiltAngle && showAxis && layers.measures && (() => {
        const la = sys.local('V1', A);
        const lb = sys.local('V1', B);
        const lc = sys.local('V1', C);
        const d = norm2([lb[0] - la[0], lb[1] - la[1]]);
        if (Math.hypot(lb[0] - la[0], lb[1] - la[1]) < 1e-6) return null;
        const deg = (Math.acos(Math.min(1, Math.abs(d[0]))) * 180) / Math.PI;
        const dev = Math.abs((lc[0] - la[0]) * d[1] - (lc[1] - la[1]) * d[0]);
        const ok = dev < 0.1;
        const f = sys.renderFrame('V1');
        // 标签放在积聚线中点上方
        const midL: Vec2 = [(la[0] + lb[0]) / 2 + -d[1] * 0.9, (la[1] + lb[1]) / 2 + d[0] * 0.9];
        const pos = localToWorld(f, midL);
        return (
          <Html position={v3(pos)} center zIndexRange={[12, 0]}>
            <span className="meas3d" style={{ color: ok ? MEAS : MEAS_BAD }}>
              {ok ? `δ = ${deg.toFixed(1)}°` : `δ = ${deg.toFixed(1)}°(条件已破坏)`}
            </span>
          </Html>
        );
      })()}
    </Canvas>
    <div className={`mode-badge ${panMode ? 'pan' : ''}`}>
      {panMode ? '平移中 · 移动鼠标平移画面(右键单击退出)' : '旋转模式 · 右键单击开始平移'}
    </div>
    </div>
  );
}
