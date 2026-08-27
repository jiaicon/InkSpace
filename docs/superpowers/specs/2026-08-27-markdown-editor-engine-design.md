# Markdown Studio —— 子项目 A：编辑器引擎 设计

- 日期：2026-08-27
- 状态：已确认，待实现
- 范围：子项目 A / 共 A→B→C→D（A 编辑器引擎 → B 文件层 → C 知识库 → D 导出与打磨）

## 1. 背景与目标

在现有 Electron + Vite + React 18 + antd + better-sqlite3 工程上，把「企业后台 demo」改造成
Typora 类的 AI 原生 Markdown 编辑器（编辑器即应用本体）。本子项目交付**编辑器引擎**：一个
隔离在稳定接口之后、可被后续文件层/知识库复用的编辑核心。

编辑模型为 **Typora 式单一表面**：WYSIWYG 输入即渲染，源码模式一键切换，无独立预览窗格。

## 2. 设计原则

- **最优方案**：选社区主流、文档好、可替换的方案；Markdown 是唯一事实源。
- **可版本迭代**：引擎（Milkdown/CodeMirror）隔离在薄边界后，将来可整体替换而不影响上层。
- **简单易用**：对外只暴露一个极小接口；v1 只做 Typora 核心，YAGNI 掉冷门功能。
- **满足多数需求**：接口面向「打开→编辑→保存→自动保存」这类常见用法设计。

## 3. 范围

### 3.1 目标内

- 自建 `Editor` 组件边界与稳定文档接口（`getMarkdown/setMarkdown/onChange/模式切换`）。
- WYSIWYG 模式：Milkdown，支持 GFM + Mermaid + KaTeX 数学 + 代码块高亮 + 表格 + 图片。
- 源码模式：CodeMirror 6，markdown 语法高亮。
- 模式切换（wysiwyg ⇄ source），内容双向一致。
- Markdown 输入规则（`# `→标题 等）。
- TOC：标题 → 大纲（纯函数，供布局层渲染面板）。
- 引擎初始化失败兜底 + 序列化失败兜底（不丢用户数据）。

### 3.2 非目标（后续子项目）

- 文件树、多 Tab、新建/打开/保存、自动保存、最近打开 → 子项目 B。
- SQLite 持久化（最近打开、工作区配置）→ B；知识库元数据 → C。
- AI 补全/重写/知识库 → C（本子项目只预留插件缝隙）。
- 导出 HTML/PDF、全局搜索/替换、快捷键、主题 → D。

## 4. 架构

`Editor` 是 renderer 内一个自包含组件，内部持有「当前 markdown 字符串 + 当前模式」作为唯一
状态，两个引擎分别实现同一套读写接口：

```
Editor（稳定边界）
├── EditorProps / EditorHandle（对外接口，见 §5）
├── 状态：{ markdown: string, mode: 'wysiwyg' | 'source' }
├── WYSIWYG 引擎 = Milkdown（parse: markdown→ProseMirror doc；serialize: doc→markdown）
└── 源码引擎 = CodeMirror 6（doc 即 markdown 文本）
```

- 数据流：外部通过 `setMarkdown` 写入 → 引擎初始化/替换内容 → 用户编辑 → 引擎回调 →
  `Editor` 更新 `markdown` 状态并触发 `onChange(md)` 与 `onChangeDirty(dirty)`。
- 切换模式：先取当前引擎的最新 markdown 存入状态，再初始化另一引擎；v1 不追求光标/滚动
  精确定位，只保证内容一致。

## 5. 接口

```ts
export type EditorMode = 'wysiwyg' | 'source'

export interface OutlineNode {
  id: string      // 锚点 id，由 heading 文本生成
  level: number   // 1–6
  text: string
}

export interface EditorProps {
  initialMarkdown: string
  onChange: (md: string) => void
  onChangeDirty: (dirty: boolean) => void   // 供 B 的自动保存
  onModeChange?: (mode: EditorMode) => void
  onOutlineChange?: (outline: OutlineNode[]) => void
}

export interface EditorHandle {
  getMarkdown(): string
  setMarkdown(md: string): void   // 程序化替换内容，不触发 onChange；重置 dirty=false
  markSaved(): void               // 把当前内容记为「已保存基线」，置 dirty=false
  getMode(): EditorMode
  setMode(mode: EditorMode): void
  focus(): void
}
```

约束：markdown 字符串是唯一跨层数据。`onChange(md)` 仅在用户编辑时触发；`initialMarkdown`
首次加载与外部 `setMarkdown` 均不触发。dirty 定义为「当前 markdown ≠ 已保存基线」，初始基线 =
`initialMarkdown`；`onChangeDirty` 只在 dirty 跳变时触发一次（false→true 与 true→false），
连续编辑期间不重复触发。`setMarkdown` 与 `markSaved` 都会把基线更新为当前内容并置 dirty=false。

## 6. Markdown 能力清单

- 块级：标题、段落、引用、列表（有序/无序/任务）、表格、代码块（语言高亮）、水平线、
  Mermaid 图、数学块、TOC 大纲。
- 行内：加粗、斜体、删除线、行内代码、链接、图片、行内数学。
- 输入规则：`# `→标题、`- `/`1. `→列表、`> `→引用、```` ``` ````→代码块、`---`→水平线，
  以及 `**`/`` ` ``/`~~` 等行内标记。

Markdown 方言为 GFM。Mermaid 与数学为按需懒加载（对应插件触发时再加载渲染资源），避免首屏
体积过大。

## 7. 依赖

- 运行时（renderer，加入 `dependencies`）：`@milkdown/core`、`@milkdown/kit`、`@milkdown/react`、
  `katex`、`@codemirror/state`、`@codemirror/view`、`@codemirror/lang-markdown`、`@lezer/markdown`、
  及 Milkdown 的 diagram/math 插件对应依赖。
- 主进程与 preload 不新增依赖；本子项目不触碰 SQLite。

## 8. 错误处理

- 引擎初始化失败：`Editor` 进入 error 态，渲染可读错误信息与「重试」按钮，不外抛导致整页崩溃。
- 序列化失败兜底：极端情况下 parse/serialize 抛错时，保留原始 markdown 字符串并继续，绝不丢失
  用户已输入内容；错误经 `onChange` 之外单独上报（预留 `console.error`/后续运行日志接入点）。

## 9. 测试

- 接口契约单测：mock 引擎，验证 `getMarkdown/setMarkdown`、模式切换、`dirty` 语义。
- 往返保真测试：代表性样例（嵌套列表、表格、任务列表、代码块、数学、Mermaid）经
  parse→serialize 断言不漂移。
- 大纲解析测试：headings → `OutlineNode[]`，含 level 与锚点 id。

## 10. 验收标准

1. 组件能加载一段 markdown 并 WYSIWYG 渲染。
2. 输入 `# ` 自动转为标题，退格可还原。
3. 切换到源码模式显示原始 markdown 且高亮；切回 WYSIWYG 内容一致。
4. 表格/代码块/Mermaid/数学/图片可正常渲染。
5. `onChange` 与 `onChangeDirty` 语义符合 §5 约束。
6. 相关单测通过（`pnpm test`）。
