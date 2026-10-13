# 换面法 · 3D 交互学习

正投影**换面法**(auxiliary view method)的交互式教学网站。
把"点在 V/H 投影体系中的换面"从静态黑板图变成可拖动、可展开、2D/3D 实时对照的动态演示。

在线地址:<https://kitsunemori96.github.io/huanmian3d/>

## 为什么做这个

换面法是工程制图(机械/土木类)的难点:学生需要在头脑中完成"空间平面旋转摊平到纸面"的想象。
本网站把这一过程**动画化**——新投影面绕轴 90° 摊开的每一步都同时呈现在 3D 场景和 2D 工图中,
等距规律、积聚性等结论由投影引擎**几何自动保证**,拖动任何元素,结论实时跟随验证。

## 功能

- **7 个渐进章节**:点的换面 → 直线求实长 → 积聚成点 → 平面积聚成线 → 求实形 → 综合应用(求倾角 δ) → 自由探索沙盒
- **双视图严格同步**:左侧 Three.js 3D 场景与右侧 SVG 综合投影图共享同一投影引擎与动画源
- **全要素可交互**:拖动点 a/a′/b/b′/c/c′、平移旋转新轴 OX₁、滑动 OX₂;所有派生投影实时重算
- **条件破坏即反馈**:破坏 OX₁ ∥ 水平线等几何条件时,积聚/实长结论立刻失效并红色警告——把"定理挂在条件上"演出来
- **讲解步骤驱动状态**:每章分步讲解,步骤直接驱动展开角、标注显隐等目标状态,自动补间动画
- **URL 状态同步**:`?ch=4&step=2` 可直接分享/收藏某一章某一步

## 技术栈

React 19 · TypeScript · Vite 8 · Zustand · Three.js (@react-three/fiber + drei) · Vitest · Oxlint

## 架构

```
src/
├── content/chapters.ts   # 章节文案 + 每步目标状态 + ChapterFeatures 声明
├── store.ts              # Zustand 全局状态(点/轴/展开角/图层/章节步骤)
├── lib/
│   ├── math.ts           # 向量工具
│   ├── engine.ts         # 投影引擎:投影面链 → 坐标架 → 投影/展开/纸面坐标
│   └── useSystem.ts      # 共享动画源:单 rAF 补间 + 单份 System 缓存
└── components/
    ├── Scene3D.tsx       # 3D 场景(R3F)
    ├── Sheet2D.tsx       # 2D 综合投影图(SVG,含拖拽)
    └── Panel.tsx         # 视图控制侧栏
```

核心思想:**投影体系 = 投影面链**。每个新投影面通过一根轴铰接在父面内且恒垂直于父面,
"换面不换距"等规律是该几何的自动推论,而非手工规则。视图组件只读章节的
`features` 声明(第三点/标注类型/新轴默认),新增章节零改组件代码。

## 本地开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm test       # 引擎几何不变量单测(等距规律/积聚/实形/倾角)
pnpm lint       # Oxlint
pnpm build      # 生产构建(tsc + vite build)
```

## 部署

推送到 `master` 即由 GitHub Actions 自动跑测试、构建并发布到 GitHub Pages
(工作流见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))。
