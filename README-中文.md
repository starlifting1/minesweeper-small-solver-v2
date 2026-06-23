# 扫雷

一个原生 HTML/CSS/JavaScript 扫雷小游戏，带一个可选的公平 AI 助手。

本项目刻意保持轻量：不依赖前端框架、不需要运行时依赖、不需要后端服务。直接用现代浏览器打开 `index.html` 即可运行，也可以使用已经打包好的单文件版本 `dist/index.html`。

## 功能

- Classic Minesweeper gameplay with beginner, intermediate, and expert levels.
- Mobile-friendly flag mode for touch devices.
- Fair AI assistant that only reads revealed numbers and flags.
- AI hint, one-step AI move, and auto-play takeover modes.
- Constraint-based solving with exact local enumeration and probability fallback.

- 经典扫雷玩法，包含初级、中级、高级难度。
- 适配触屏设备的插旗模式。
- 公平 AI，只读取已翻开的数字和旗子，不偷看隐藏雷位。
- 支持 AI 提示、AI 走一步、AI 接管自动游玩。
- 使用约束推理、局部穷举和概率决策。

## 快速开始

### 方式一：直接打开

用现代浏览器打开：

```text
index.html
```

不需要安装任何依赖。

### 方式二：使用单文件构建版

打开：

```text
dist/index.html
```

这个文件已经把 HTML、CSS、游戏逻辑、AI 求解器和 UI 代码内联到同一个文档里。

### 方式三：重新构建

只有在你想重新生成打包文件时才需要 Node.js。

```bash
npm run build
```

## 操作

| Control | English | 中文 |
|---|---|---|
| Left click | Reveal a cell | 翻开格子 |
| Right click | Toggle a flag | 插旗/取消插旗 |
| Flag mode | Use flags on touch devices | 触屏设备插旗 |
| AI hint | Highlight the current AI recommendation | 高亮 AI 当前建议 |
| AI step | Let AI make one move | AI 执行一步 |
| AI takeover | Let AI play continuously | AI 自动接管 |

## 项目结构

```text
minesweeper-v2/
├── index.html              # Page structure and script entry points
├── css/
│   └── styles.css          # Layout, board, cell states, and AI highlights
├── js/
│   ├── minesweeper.js      # Game model and rules; no DOM access
│   ├── solver.js           # Fair AI solver; reads only public board state
│   └── app.js              # DOM events, rendering, timer, and AI controls
├── scripts/
│   └── build.mjs           # Builds the single-file dist/index.html
├── dist/
│   ├── index.html          # Bundled single-file version
│   └── source/             # Source snapshots used by the bundled version
├── LICENSE
└── package.json
```

## 策略说明

这个 AI 不是神经网络，也不会读取隐藏雷位。它是一个小型离散数学求解器。

对于每个已经翻开的数字格，求解器建立一个约束：

```text
sum(adjacent unknown cells) = number - adjacent flags
```

每个未知格被视为一个二进制变量：

```text
0 = safe
1 = mine
```

求解过程分为几层：

1. 基础规则：如果某个约束还缺 `0` 个雷，则相关未知格全安全；如果缺的雷数等于未知格数量，则相关未知格全是雷。
2. 子集推理：如果一个约束包含另一个约束，可以相减推出新的安全格或雷。
3. 组件拆分：把互不相关的边界区域分开，降低穷举规模。
4. 局部穷举：把每个连通边界区域当成 0/1 约束问题搜索。
5. 全局雷数加权：结合剩余总雷数，对局部解进行组合数加权。
6. 概率决策：如果没有确定步，则选择估计雷率最低、信息量略高的格子。

求解器设置了搜索上限，避免浏览器卡死。如果某个组件过大，会退回到轻量级概率估算。

## 开发

源码是原生 JavaScript，通过浏览器全局对象暴露模块。不依赖打包器；`scripts/build.mjs` 只是把源文件内联到 `dist/index.html`。

常用命令：

```bash
npm run build
npm run check
```

`npm run check` 只使用 Node.js 做 JavaScript 语法检查，不包含浏览器 UI 自动化测试。

## 说明

- 当前 UI 文案为中文。
- AI 定位是娱乐和演示用途，不是竞赛级扫雷求解器基准项目。
- 扫雷存在必须猜测的局面，因此 AI 接管仍然可能失败。
- 本游戏在第一次翻开后才布雷，并排除首格附近区域，所以第一步安全。

## 协议

MIT 协议。见 [LICENSE](LICENSE)。

## 开发说明

本项目在开发过程中使用了 AI 工具（包括 ChatGPT 5.5）提供辅助。

所有 AI 生成的代码和文档均经过项目维护者审阅、修改和验证。
