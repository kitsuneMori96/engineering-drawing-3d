import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { projLabel } from '../../lib/engine';
import { Ball, PanHandler, PlaneQuad, Tag, v3 } from '../../lib/three-atoms';
import { activeBuilt } from './active';
import { displayVertices } from './mesh';
import { useSolidsSystem } from './useSolidsSystem';
import { useSolidsStore } from './store';
import { sheetLayout, solidX0, VIEW_COLORS } from './views';

const C_INK = '#1f2937';
const C_PROBE = '#c026d3';

export default function Scene3D() {
  const sys = useSolidsSystem();
  const chapter = useSolidsStore((s) => s.chapter);
  const problemId = useSolidsStore((s) => s.problemId);
  const layers = useSolidsStore((s) => s.layers);
  const showSolid3D = useSolidsStore((s) => s.showSolid3D);
  const probe = useSolidsStore((s) => s.probe);
  const [panMode, setPanMode] = useState(false);

  const built = useMemo(() => activeBuilt(chapter, problemId), [chapter, problemId]);
  const mesh = built.mesh;
  const x0 = useMemo(() => solidX0(mesh), [mesh]);
  const layout = useMemo(() => sheetLayout(mesh, x0), [mesh, x0]);
  const groupMap = useMemo(() => new Map(mesh.groups.map((g) => [g.id, g])), [mesh]);
  const dverts = useMemo(() => displayVertices(mesh), [mesh]);

  const bounds = useMemo(() => {
    const left = layout.V.x;
    const hH = layout.V.h;
    const wDepth = layout.W.w;
    return {
      V: { uMin: left, uMax: x0, vMin: 0, vMax: hH },
      H: { uMin: left, uMax: x0, vMin: 0, vMax: wDepth },
      W: { uMin: 0, uMax: hH, vMin: 0, vMax: wDepth },
    };
  }, [layout, x0]);

  const geos = useMemo(() => {
    const by = new Map<string, { color: string; pos: number[] }>();
    for (const t of mesh.tris) {
      const g = groupMap.get(t.group);
      const color =
        g?.color ?? (g?.kind === 'base' ? '#64748b' : g?.kind === 'top' ? '#cbd5e1' : '#94a3b8');
      const entry = by.get(t.group) ?? { color, pos: [] };
      for (const idx of [t.a, t.b, t.c]) entry.pos.push(...mesh.verts[idx]);
      by.set(t.group, entry);
    }
    const out: { id: string; color: string; geo: THREE.BufferGeometry }[] = [];
    for (const [id, e] of by) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(e.pos, 3));
      geo.computeVertexNormals();
      out.push({ id, color: e.color, geo });
    }
    return out;
  }, [mesh, groupMap]);

  const edges = useMemo(
    () =>
      mesh.edges.map((e) => {
        const cutId = e.groups.find((g) => groupMap.get(g)?.kind === 'cut');
        return {
          a: mesh.verts[e.a],
          b: mesh.verts[e.b],
          color: cutId ? (groupMap.get(cutId)?.color ?? '#f59e0b') : '#334155',
          width: cutId ? 2.8 : 1.5,
        };
      }),
    [mesh, groupMap],
  );

  const projs = (['V', 'H', 'W'] as const).map((id) => ({ id, color: VIEW_COLORS[id] }));

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPanMode((p) => !p);
  };

  return (
    <div className={`scene-wrap${panMode ? ' panning' : ''}`} onContextMenu={onContextMenu}>
      <Canvas
        camera={{ position: [16, 13, 20], fov: 38 }}
        style={{ background: 'linear-gradient(#eef2f7, #e2e8f0)' }}
      >
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[1, 2.5, 3.5]}
          maxPolarAngle={Math.PI * 0.94}
          mouseButtons={{
            LEFT: panMode ? (-1 as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: -1 as unknown as THREE.MOUSE,
          }}
        />
        <PanHandler enabled={panMode} />

        <Line points={[[layout.V.x, 0, 0], [x0 + 0.8, 0, 0]]} color="#94a3b8" lineWidth={1.2} />
        <Html position={[x0 + 1.1, 0, 0]} center><span className="axis3d">X</span></Html>
        <Line points={[[0, 0, 0], [0, 0, layout.W.w + 0.8]]} color="#94a3b8" lineWidth={1.2} />
        <Html position={[0, 0, layout.W.w + 1.1]} center><span className="axis3d">Y</span></Html>
        <Line points={[[0, 0, 0], [0, layout.V.h + 0.8, 0]]} color="#94a3b8" lineWidth={1.2} />
        <Html position={[0, layout.V.h + 1.1, 0]} center><span className="axis3d">Z</span></Html>

        {projs.map(({ id, color }, i) => {
          const def = sys.defs.get(id)!;
          return (
            <PlaneQuad
              key={id}
              def={{ ...def, color }}
              sys={sys}
              pts={[]}
              opacity={0.26}
              renderOrder={i}
              bounds={bounds[id]}
            />
          );
        })}

        {showSolid3D && (
          <group>
            {geos.map((g) => (
              <mesh key={g.id} geometry={g.geo} renderOrder={5}>
                <meshBasicMaterial
                  color={g.color}
                  transparent
                  opacity={0.9}
                  side={THREE.DoubleSide}
                  depthWrite
                />
              </mesh>
            ))}
            {edges.map((e, i) => (
              <Line
                key={i}
                points={[v3(e.a), v3(e.b)]}
                color={e.color}
                lineWidth={e.width}
                renderOrder={6}
              />
            ))}
            {layers.labels &&
              dverts.map((p, i) => (
                <Tag key={i} pos={p} text={String(i + 1)} color={C_INK} dy={0.16} />
              ))}
          </group>
        )}

        {probe && (
          <group>
            <Ball pos={probe.point} r={0.16} color={C_PROBE} />
            {layers.labels && (
              <Tag
                pos={probe.point}
                text={`P · ${groupMap.get(probe.group)?.name ?? '表面'}`}
                color={C_PROBE}
                dy={0.32}
              />
            )}
            {projs.map(({ id, color }) => {
              const p = sys.renderPos(id, probe.point);
              return (
                <group key={id}>
                  <Ball pos={p} r={0.1} color={C_PROBE} overlay />
                  {layers.labels && (
                    <Tag pos={p} text={projLabel('p', id)} color={color} dy={0.3} />
                  )}
                </group>
              );
            })}
          </group>
        )}
      </Canvas>
      <div className={`mode-badge ${panMode ? 'pan' : ''}`}>
        {panMode ? '平移中 · 移动鼠标平移画面(右键单击退出)' : '左键旋转 · 滚轮缩放 · 右键单击平移'}
      </div>
    </div>
  );
}
