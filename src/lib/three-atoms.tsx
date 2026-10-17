import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec2, Vec3 } from './math';
import { add3, fmt1, mul3, norm2 } from './math';
import type { Frame3, PlaneDef, System } from './engine';

export const v3 = (a: Vec3): [number, number, number] => [a[0], a[1], a[2]];

// 平面局部坐标 → 世界坐标(当前渲染位形)
export const localToWorld = (f: Frame3, q: Vec2): Vec3 =>
  add3(f.o, add3(mul3(f.u, q[0]), mul3(f.v, q[1])));

export function Ball({
  pos,
  r,
  color,
  overlay = false,
}: {
  pos: Vec3;
  r: number;
  color: string;
  overlay?: boolean;
}) {
  return (
    <mesh position={v3(pos)} renderOrder={overlay ? 10 : 0}>
      <sphereGeometry args={[r, 20, 20]} />
      <meshBasicMaterial color={color} transparent={overlay} depthTest={!overlay} />
    </mesh>
  );
}

export function Tag({
  pos,
  text,
  color,
  dy = 0.32,
}: {
  pos: Vec3;
  text: string;
  color: string;
  dy?: number;
}) {
  return (
    <Html position={[pos[0], pos[1] + dy, pos[2]]} center zIndexRange={[10, 0]}>
      <span className="tag3d" style={{ color }}>
        {text}
      </span>
    </Html>
  );
}

/**
 * 投影面面片:按该面上所有投影点的局部坐标包围盒(u 沿轴、v 到轴)自适应生成,
 * 并始终包含轴线(v=0),保证"点永远落在面内、面永远托着点"。
 */
export function PlaneQuad({
  def,
  sys,
  pts,
  opacity = 0.45,
  renderOrder = 0,
}: {
  def: PlaneDef;
  sys: System;
  pts: Vec3[];
  opacity?: number;
  renderOrder?: number;
}) {
  const f = sys.renderFrame(def.id);
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...f.u),
      new THREE.Vector3(...f.v),
      new THREE.Vector3(...f.n),
    ),
  );
  const locals = pts.map((P) => sys.local(def.id, P));
  const us = locals.map((l) => l[0]);
  const vs = locals.map((l) => l[1]);
  const MARGIN = 1.6;
  const uMin = Math.min(0, ...us) - MARGIN;
  const uMax = Math.max(0, ...us) + MARGIN;
  const vMin = Math.min(0, ...vs) - MARGIN;
  const vMax = Math.max(0, ...vs) + MARGIN;
  const uC = (uMin + uMax) / 2;
  const vC = (vMin + vMax) / 2;
  const uH = Math.max(3, (uMax - uMin) / 2);
  const vH = Math.max(3, (vMax - vMin) / 2);
  const corner = (u: number, v: number): [number, number, number] =>
    v3(add3(f.o, add3(mul3(f.u, u), mul3(f.v, v))));
  const corners = [
    corner(uC - uH, vC - vH),
    corner(uC + uH, vC - vH),
    corner(uC + uH, vC + vH),
    corner(uC - uH, vC + vH),
    corner(uC - uH, vC - vH),
  ];
  const center = corner(uC, vC);
  const back = new THREE.Color(def.color).multiplyScalar(0.82).getStyle();
  return (
    <group position={v3(center)} quaternion={q}>
      <mesh renderOrder={renderOrder}>
        <planeGeometry args={[uH * 2, vH * 2]} />
        <meshBasicMaterial
          color={def.color}
          transparent
          opacity={opacity}
          side={THREE.FrontSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh renderOrder={renderOrder}>
        <planeGeometry args={[uH * 2, vH * 2]} />
        <meshBasicMaterial
          color={back}
          transparent
          opacity={opacity}
          side={THREE.BackSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <Line points={corners} color={def.color} lineWidth={1.1} transparent opacity={0.55} />
    </group>
  );
}

/**
 * 同名投影跨面虚线:点 P 在各投影面上的落点两两相连(可含"对象点→投影"段)。
 * 覆盖层渲染(depthTest=false):投影连线是读图辅助线,不被实体面切断。
 */
export function ProjLink({
  pts,
  color = '#475569',
  lineWidth = 1.6,
}: {
  pts: Vec3[];
  color?: string;
  lineWidth?: number;
}) {
  const segs: [Vec3, Vec3][] = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) segs.push([pts[i], pts[j]]);
  return (
    <group>
      {segs.map(([a, b], i) => (
        <Line
          key={i}
          points={[v3(a), v3(b)]}
          color={color}
          lineWidth={lineWidth}
          dashed
          dashSize={0.28}
          gapSize={0.2}
          transparent
          opacity={0.9}
          depthTest={false}
          renderOrder={9}
        />
      ))}
    </group>
  );
}

// 变换轴:画在所属平面上(子面的 u 轴方向,原点在轴上),着子面色
export function AxisLine({ sys, def, pts }: { sys: System; def: PlaneDef; pts: Vec3[] }) {
  const f = sys.renderFrame(def.id);
  const us = pts.map((P) => sys.local(def.id, P)[0]);
  const HALF = Math.max(7, Math.min(11, Math.max(0, ...us.map(Math.abs)) + 1.5));
  const a = v3(add3(f.o, mul3(f.u, -HALF)));
  const b = v3(add3(f.o, mul3(f.u, HALF)));
  const lp = v3(add3(f.o, mul3(f.u, HALF + 0.7)));
  return (
    <>
      <Line points={[a, b]} color={def.color} lineWidth={3} />
      <Html position={lp} center zIndexRange={[9, 0]}>
        <span className="axis-label3d" style={{ color: def.color }}>
          {def.axisLabel}
        </span>
      </Html>
    </>
  );
}

// 面内"点到轴"垂线段 + 直角符号 + 数值(镜像 Sheet2D measure)
export function AxisMeasure({
  sys,
  planeId,
  point,
  axis,
  value,
  color = '#c026d3',
}: {
  sys: System;
  planeId: string;
  point: Vec3;
  /** 轴线在该面局部坐标下的 {pos, dir};缺省 = 该面自身 u 轴 */
  axis?: { pos: Vec2; dir: Vec2 };
  value?: string;
  color?: string;
}) {
  const f = sys.renderFrame(planeId);
  const [lu, lv] = sys.local(planeId, point);
  const p: Vec2 = [lu, lv];
  const pos = axis?.pos ?? [0, 0];
  const d = norm2(axis?.dir ?? [1, 0]);
  const t = (p[0] - pos[0]) * d[0] + (p[1] - pos[1]) * d[1];
  const foot: Vec2 = [pos[0] + d[0] * t, pos[1] + d[1] * t];
  const dist = Math.hypot(p[0] - foot[0], p[1] - foot[1]);
  if (dist < 1e-6) return null;
  const pw = localToWorld(f, p);
  const fw = localToWorld(f, foot);
  const e: Vec2 = [(p[0] - foot[0]) / dist, (p[1] - foot[1]) / dist];
  const sq: Vec3[] = [
    localToWorld(f, [foot[0] + d[0] * 0.28, foot[1] + d[1] * 0.28]),
    localToWorld(f, [foot[0] + (d[0] + e[0]) * 0.28, foot[1] + (d[1] + e[1]) * 0.28]),
    localToWorld(f, [foot[0] + e[0] * 0.28, foot[1] + e[1] * 0.28]),
  ];
  const midW = localToWorld(f, [
    (foot[0] + p[0]) / 2 + d[0] * 0.5,
    (foot[1] + p[1]) / 2 + d[1] * 0.5,
  ]);
  return (
    <>
      <Line points={[v3(fw), v3(pw)]} color={color} lineWidth={2.6} />
      <Line points={sq.map(v3)} color={color} lineWidth={1.6} />
      <Html position={v3(midW)} center zIndexRange={[12, 0]}>
        <span className="meas3d" style={{ color }}>
          {value ?? fmt1(dist)}
        </span>
      </Html>
    </>
  );
}

// 平移:右键单击武装后,鼠标移动即平移相机(无需按住任何键);再点一次右键解除
export function PanHandler({ enabled }: { enabled: boolean }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const cam = camera as THREE.PerspectiveCamera;
      const dist = controls
        ? cam.position.distanceTo(controls.target)
        : cam.position.length();
      const k = (2 * Math.tan((cam.fov * Math.PI) / 360) * dist) / el.clientHeight;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
      const dx = e.movementX * k;
      const dy = e.movementY * k;
      cam.position.addScaledVector(right, dx).addScaledVector(up, -dy);
      if (controls) {
        controls.target.addScaledVector(right, dx).addScaledVector(up, -dy);
        controls.update();
      }
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [enabled, camera, gl, controls]);
  return null;
}
