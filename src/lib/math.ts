export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/* ---------- 2D ---------- */
export const add2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const mul2 = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
export const dot2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const len2 = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const norm2 = (a: Vec2): Vec2 => {
  const l = len2(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** rotate +90° (CCW) */
export const perp2 = (a: Vec2): Vec2 => [-a[1], a[0]];
export const mid2 = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/* ---------- 3D ---------- */
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: Vec3): Vec3 => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* ---------- misc ---------- */
export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const fmt1 = (n: number): string => {
  const r = round1(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
