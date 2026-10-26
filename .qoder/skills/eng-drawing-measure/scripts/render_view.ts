/**
 * 渲染单个视图(不含标题文字),供 overlay.py 叠加比对。
 *
 * 用法(在仓库根目录):
 *   pnpm exec tsx .qoder/skills/eng-drawing-measure/scripts/render_view.ts \
 *     --problem 7 --view V --out /tmp/p7-v.pgm [--scale 12] [--no-hidden]
 *
 * 输出按扩展名决定:
 *   .pgm  纯位图(P5),overlay.py 直接可读,推荐
 *   .svg  矢量,便于人工查看(ImageMagick 需 -density 200 才画得出)
 *
 * 约定:白底 255,墨迹 0;虚线也照画(与题源一致),overlay 不区分线型。
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name: string, def?: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : (def ?? '');
};
const has = (name: string): boolean => argv.includes(name);

const root = resolve(arg('--root', '.'));
const out = arg('--out');
if (!out) {
  console.error('ERROR: 需要 --out <file.pgm|file.svg>');
  process.exit(1);
}

const problems = await import(pathToFileURL(resolve(root, 'src/topics/solids/problems.ts')).href);
const hlr = await import(pathToFileURL(resolve(root, 'src/topics/solids/hlr.ts')).href);

const id = Number(arg('--problem', '1'));
const view = (arg('--view', 'V').toUpperCase()) as 'V' | 'H' | 'W';
const scale = Number(arg('--scale', '12'));
const withHidden = !has('--no-hidden');

const { mesh } = problems.problemSolid(id);
const res = hlr.hiddenLines(mesh, hlr.viewBasis(view));
const segs = withHidden ? [...res.visible, ...res.hidden] : res.visible;

let xmin = Infinity;
let xmax = -Infinity;
let ymin = Infinity;
let ymax = -Infinity;
for (const s of segs) {
  for (const p of [s.a, s.b]) {
    xmin = Math.min(xmin, p[0]);
    xmax = Math.max(xmax, p[0]);
    ymin = Math.min(ymin, p[1]);
    ymax = Math.max(ymax, p[1]);
  }
}
const pad = 4;
const W = Math.round((xmax - xmin + pad * 2) * scale);
const H = Math.round((ymax - ymin + pad * 2) * scale);
const px = (x: number) => (x - xmin + pad) * scale;
const py = (y: number) => (ymax - (y - ymin) + pad) * scale;

const summary = `${out} view=${view} ${W}x${H} vis=${res.visible.length} hid=${withHidden ? res.hidden.length : 0}`;

if (out.endsWith('.pgm')) {
  const buf = Buffer.alloc(W * H, 255);
  const dot = (x: number, y: number) => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const xi = Math.round(x) + dx;
        const yi = Math.round(y) + dy;
        if (xi >= 0 && xi < W && yi >= 0 && yi < H) buf[yi * W + xi] = 0;
      }
    }
  };
  for (const s of segs) {
    const x1 = px(s.a[0]);
    const y1 = py(s.a[1]);
    const x2 = px(s.b[0]);
    const y2 = py(s.b[1]);
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      dot(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }
  const header = Buffer.from(`P5\n${W} ${H}\n255\n`, 'ascii');
  writeFileSync(out, Buffer.concat([header, buf]));
  console.log(summary);
} else {
  const line = (s: (typeof segs)[number], cls: 'vis' | 'hid') => {
    const style =
      cls === 'hid'
        ? 'stroke="#111" stroke-width="1.6" stroke-dasharray="7 4"'
        : 'stroke="#111" stroke-width="2.2" stroke-linecap="round"';
    return `<line x1="${px(s.a[0]).toFixed(1)}" y1="${py(s.a[1]).toFixed(1)}" x2="${px(s.b[0]).toFixed(1)}" y2="${py(s.b[1]).toFixed(1)}" fill="none" ${style}/>`;
  };
  const body = [
    ...(withHidden ? res.hidden.map((s) => line(s, 'hid')) : []),
    ...res.visible.map((s) => line(s, 'vis')),
  ].join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="100%" height="100%" fill="#fff"/>
${body}
</svg>`;
  writeFileSync(out, svg);
  console.log(summary);
  console.log(`查看: convert -density 200 ${out} ${out.replace(/\.svg$/, '.png')}`);
}
