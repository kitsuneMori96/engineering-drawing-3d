---
name: eng-drawing-measure
description: 工程图扫描件的量线与视图叠加比对工具。当需要从教材/作业扫描件中量取线段位置与间距（像素→模型单位）、核对程序生成的 V/H/W 三面投影是否与题源一致、定位“多画/漏画/位置偏差”时使用。适用于本仓库 solids 题源的建模校正、截切/相贯题复核，以及任何需要把计算视图贴回扫描件做像素级比对的任务。
---

# 工程图量线与视图叠加比对

两个独立脚本，用 Bash 直接调用，不依赖 MCP 服务：

| 脚本 | 作用 | 何时用 |
| --- | --- | --- |
| `measure.py` | 扫描件量线：行/列墨迹区间、自动找横竖线、量间距、判虚实 | 需要从题源反推尺寸、确认某条棱的像素位置 |
| `render_view.ts` | 用仓库投影引擎渲染单视图(PGM/SVG) | 生成待比对的计算视图 |
| `overlay.py` | 渲染视图对齐叠加回扫描件，报告偏差/多画/漏画 | 核对模型与题源是否一致 |

## 前置

- Python: `numpy`、`PIL`、`scipy`（必需，`scipy` 用于距离变换），`cv2`（可选，缺失时连通域退回 scipy、线段列表为空）
- Node: 仓库内 `pnpm exec tsx`（`render_view.ts` 直接 import `src/topics/solids/{problems,hlr}.ts`）
- 在仓库根目录执行；脚本路径 `.qoder/skills/eng-drawing-measure/scripts/`

## 坐标约定

- 扫描件与渲染图都用**图像像素坐标，原点左上，x 右 y 下**。
- `--region/--exclude` 是原图像素坐标；`measure.py lines` 的 `pos/start/end` 与 `overlay.py` 的 bbox/线段也是原图坐标；`measure.py runs` 的区间同理。只有 `overlay.py` 叠加图内部坐标与 `bbox_xy` 是取区坐标（用于画框）。
- 渲染图只含**一个视图**、白底深线；多视图分别叠加。
- 视图映射（由 `hlr.viewBasis` 决定，渲染图已自动保持一致）：
  - **V**（正立投影面）：图面 x = 模型 x，图面 y = 模型 y
  - **H**（水平投影面）：图面 x = 模型 x，图面 y = −模型 z
  - **W**（侧立投影面）：图面 x = 10 + 模型 z，图面 y = 模型 y

## 工作流

### 1. 先量线，再改模型

从题源反推尺寸，不要凭观感。先粗看布局，再逐行/列取墨迹区间。

```bash
# 沿第 900、950 行列出墨迹区间（--region 限定到目标视图）
python3 .qoder/skills/eng-drawing-measure/scripts/measure.py runs scan.png \
  --region 240,690,900,1090 --rows 900,950 --text
```

自动找全部横竖线，看间距序列，判断哪些线是实线/虚线：

```bash
python3 .qoder/skills/eng-drawing-measure/scripts/measure.py lines scan.png \
  --region 240,690,900,1090 --min-len 60 --text
```

关键判读：

- `cov`（覆盖率）< 0.90 记为虚（`dashed`），实线一般 > 0.95。
- `--min-cov`（默认 0.15）滤掉文字；文字笔画会以低覆盖率短线段出现，必要时用 `--exclude` 挖掉标注区。
- 同一区域若混入页框/图框线，用 `--region` 收紧或 `--exclude` 排除，否则会把外框当成视图边界。
- 扫描件可能有非等比拉伸：分别用横向相邻线与纵向相邻线求 px/unit，不要默认同比例。本仓库题源实测横向 ≈72.1 px/unit、纵向 ≈63.6 px/unit（约 +13%）。

### 2. 渲染计算视图

```bash
pnpm exec tsx .qoder/skills/eng-drawing-measure/scripts/render_view.ts \
  --problem 7 --view V --out /tmp/p7-v.pgm --scale 12
```

- `--scale` 是模型单位→像素；overlay 会自动拟合尺度，12 足够。
- `.pgm` 为纯位图（推荐，ImageMagick 的 SVG 光栅化不可靠）；`.svg` 仅用于人眼查看，转 PNG 必须 `convert -density 200`，否则输出空白。
- 默认含虚线；`--no-hidden` 只画可见线（题源省略虚线时用）。

### 3. 叠加比对

```bash
python3 .qoder/skills/eng-drawing-measure/scripts/overlay.py scan.png \
  --region 240,690,900,1090 --render /tmp/p7-v.pgm \
  --tol 4 --aniso --out /tmp/p7-overlay.png --text
```

输出字段：

- `fit`：`flip`（含镜像时 fit 更优会自动选，可用 `--flip none|x` 强制）与 `scale_x/scale_y`。
- `dev_px`：渲染线到扫描墨迹的距离（mean/p95/max）。
- `within_tol_pct`：渲染墨迹落在容差内的比例（该被扫描件解释）。
- `explained_pct`：扫描墨迹被渲染线覆盖的比例（反向：题源里有多少被解释）。
- `extra`：渲染有、扫描无 → **疑似多画**。
- `missing`：扫描有、渲染无 → **疑似漏画**。
- `segments`：对每个连通块做的 HoughLinesP 拟合，直接读端点判断是哪条线。

判读规则：

1. **虚线/点划线一定出现在 `missing`**：渲染虚线的间隔与题源不可能逐像素一致。先看 `segments` 是否落在已知虚线位置，再用 `measure.py lines` 的 `cov/dashed` 复核，不要把它当成漏画。
2. `within < 85%` 或触发“确认 --region”提示时，先怀疑取区含页框、方向颠倒、或取区不是目标视图，而不是模型错。
3. “长直线未被解释且贴取区边界”= 页框线，`--exclude` 掉重跑。
4. 宽高比差 >3% 且未加 `--aniso` 时，先收紧 `--region`；确认题源确实被拉伸后再用 `--aniso`。
5. 真正的几何错误表现为：`missing/+extra` 成对出现在同一位置，或偏差集中在某条棱上。此时回到 `src/topics/solids/problems.ts` 改模型，再重跑 1–3。
6. 已知题源与实际制图约定有出入（省略线、近似形状）时，优先改 `problems.ts` 里的 `note` 说明，而不是为对齐扫描件去扭曲几何。

## 已验证示例（4-3 第 7 题）

```bash
# 量 V 视：台阶 1.825、肩宽 3.571、槽顶 4.082、隐棱 0.716（模型 1.83/3.578/4.09/0.77）
python3 .qoder/skills/eng-drawing-measure/scripts/measure.py lines hi-07.png \
  --region 240,690,900,1060 --min-len 60 --text

pnpm exec tsx .qoder/skills/eng-drawing-measure/scripts/render_view.ts \
  --problem 7 --view V --out ov/p7v.pgm
python3 .qoder/skills/eng-drawing-measure/scripts/overlay.py hi-07.png \
  --region 240,690,900,1090 --render ov/p7v.pgm \
  --tol 4 --aniso --out ov/p7v-overlay.png --text
```

叠加图配色：扫描墨迹浅蓝、渲染线红、多画品红框、漏画绿框。绿框里有大量虚线碎段属预期。

## 局限

- 只做横/竖线检测，不识别圆弧、圆、斜线（斜线需用 `runs` 多点取样手算）。
- 不做 OCR；标注文字靠 `--min-len/--min-cov` 过滤，密集标注区建议 `--exclude`。
- overlay 的 `--aniso` 只在 ±4% 内搜索，拉伸超出时先手动确认 `scale_x/scale_y` 比值是否符合量线结果。
- `overlay.py` 取区必须是目标视图的紧贴框；框太松时外接框初值会被页框带偏，导致整体拟合失败。
