# 工程制图 · 3D 交互学习站

正投影体系的交互式教学网站,当前收录两个主题:**换面法**与**判别可见性**。
把"在头脑中旋转投影面"的抽象过程变成可拖动、可展开、2D/3D 实时对照的动态演示。

在线地址:<https://kitsunemori96.github.io/huanmian3d/>

## 为什么做这个

工程制图(机械/土木类)的难点是学生需要在头脑中完成"空间形体旋转摊平到纸面"的想象。
本网站把这一过程**动画化**——投影面绕轴 90° 摊开的每一步都同时呈现在 3D 场景和 2D 工图中,
等距规律、积聚性、可见性判别等结论由投影引擎**几何自动保证**,拖动任何元素,结论实时跟随验证。

## 主题

### 换面法(7 章)

- **渐进章节**:点的换面 → 直线求实长 → 积聚成点 → 平面积聚成线 → 求实形 → 综合应用(求倾角 δ) → 自由探索沙盒
- **全要素可交互**:拖动点 a/a′/b/b′/c/c′、平移旋转新轴 OX₁、滑动 OX₂;所有派生投影实时重算
- **条件破坏即反馈**:破坏 OX₁ ∥ 水平线等几何条件时,积聚/实长结论立刻失效并红色警告——把"定理挂在条件上"演出来

### 判别可见性(3 章)

- **重影点**:同影异深/同影异高,前遮后、高遮低;不可见投影自动加括号 `(a′)`,深度/高度比较量注实时给出结论
- **交叉两直线**:投影"交叉"≠ 空间相交;锁定交点 X、找两个空间候选人、比深度定谁可见,被挡线画教材短虚线画法;一键构造真相交特例
- **直线与平面相交**:作 V₁ ⊥ 平面得积聚线 p₁,k₁ 反投影定交点 K,两面被挡段由 `hiddenInterval` 裁出实-虚-实三段;拖出"K 在三角形外/DE ∥ 平面"边界态,虚线即时消失

### 通用

- **双视图严格同步**:左侧 Three.js 3D 场景与右侧 SVG 综合投影图共享同一投影引擎与动画源
- **讲解步骤驱动状态**:每章分步讲解,步骤直接驱动展开角、标注显隐等目标状态,自动补间动画
- **URL 状态同步**:`?topic=visibility&ch=2&step=4` 可直接分享/收藏某一主题某一步(旧 `?ch=&step=` 链接自动回落换面法)

## 技术栈

React 19 · TypeScript · Vite 8 · Zustand · Three.js (@react-three/fiber + drei) · Vitest · Oxlint

## 架构

```
src/
├── App.tsx               # 主题壳:按 ?topic= 挂载首页/换面法/可见性
├── nav.ts                # 导航 store(topic 状态)
├── lib/
│   ├── math.ts           # 向量工具
│   ├── engine.ts         # 投影引擎:投影面链 → 坐标架 → 投影/展开/纸面坐标
│   ├── three-atoms.tsx   # 3D 展示原子件(Ball/Tag/PlaneQuad/AxisLine…)
│   └── useSystem.ts      # 换面法动画源:单 rAF 补间 + 单份 System 缓存
└── topics/
    ├── registry.ts       # 主题元数据(首页卡片按此渲染)
    ├── Home.tsx          # 主题卡片首页
    ├── huanmian/         # 换面法:store/chapters/Sheet2D/Scene3D/Panel
    └── visibility/       # 判别可见性
        ├── vis.ts        # 纯数学:重影判别、线段求交、线面交点、被挡区间裁剪
        ├── chapters.ts   # 三章讲解流 + 每步目标状态 + features 声明
        └── …             # store/useVisSystem/Sheet2D/Scene3D/Panel
```

核心思想:**投影体系 = 投影面链**。每个新投影面通过一根轴铰接在父面内且恒垂直于父面,
"换面不换距"等规律是该几何的自动推论,而非手工规则。视图组件只读章节的
`features` 声明(判别类型/可拖点/是否用 V₁),新增章节零改组件代码;
新增主题 = registry 加一条 + 挂载对应组件。

## 本地开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm test       # 几何不变量 + 可见性判别单测(vitest)
pnpm lint       # Oxlint
pnpm build      # 生产构建(tsc + vite build)
```

## 部署

推送到 `master` 即由 GitHub Actions 自动跑测试、构建并发布到 GitHub Pages
(工作流见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))。
