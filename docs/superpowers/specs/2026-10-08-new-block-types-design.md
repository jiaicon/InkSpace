# Markdown Studio —— 新块类型：提示块 Callout 与文档内目录 TOC 设计

- 日期：2026-10-08
- 状态：草稿，待确认
- 范围：编辑器「插入」能力扩展（独立于 A–D 子项目，是对既有编辑器与导出管线的增量）
- 前置：[A 编辑器引擎设计](2026-08-27-markdown-editor-engine-design.md)、[B 文件层设计](2026-09-01-file-layer-design.md)（均已交付）

## 1. 背景与目标

编辑器目前支持标题、列表、引用、代码块、表格、分割线、数学公式、Mermaid 图表，斜杠面板已按类别分组。
本次补两类**块级内容**，它们是目前「写文档时想做但做不到」的缺口：

1. **提示块 Callout**：把「注意 / 建议 / 警告」这类内容从普通引用里区分出来，一眼可辨。
2. **文档内目录 TOC**：长文在正文里放一个可点击的目录，而不是只能看侧栏大纲。

两者的共同难点是：**都要在 markdown 里留下可被其它工具读懂的痕迹**。因此设计目标不止「本应用里好看」，
还包括**不认识这些语法的工具会看到什么**。

## 2. 设计原则

- **零新节点**：不新增 ProseMirror 节点类型，复用已有的 `blockquote` / `paragraph` + 装饰。理由见 §4.2。
- **markdown 是唯一事实源**：所有渲染层都是**呈现**，不回写文档；`[!NOTE]` 与 `[TOC]` 始终以原文存在于 md 里。
- **降级友好**：选用的语法在「不认识它的工具」里要退化成可读内容，而不是脏字符。
- **最优 / 可迭代 / 简单**：callout 用 GitHub Alerts（事实标准）、TOC 用 `[TOC]`（Typora 惯例）；
  两个功能**互不依赖**，可分别交付与回退。

## 3. 范围

### 3.1 目标内

- **Callout**：`> [!TYPE]` 的 GitHub Alerts 语法；5 种类型；编辑器内渲染成带标题与配色的块；
  斜杠面板新增「提示块」组（5 项）；导出为带样式的 `<div class="callout">`。
- **TOC**：`[TOC]` 占位段落；编辑器内渲染成可点击的层级目录（点击跳转到对应标题）；
  斜杠面板「插入」组新增一项；导出为 `<nav class="toc">` 嵌套列表，并为标题生成锚点。

### 3.2 非目标（明确不做，避免日后被当成遗漏）

- Callout：块内下拉切换类型、可折叠、自定义标题文字、callout 嵌套的专门处理。
- TOC：折叠、自动编号、按层级筛选（如只显示 h1–h3）、点击跳转后高亮当前项。
  多个 `[TOC]` **允许存在**，但渲染内容相同（不做差异渲染）。
- 不做 `:::` 容器指令、`[[toc]]`、`<!-- toc -->` 的兼容（语法已定，见 §5）。
- 不改动数学公式 / Mermaid / 其它既有块的行为。

## 4. 架构

### 4.1 文件清单

```
renderer（src/renderer/src/editor/）
  ├── callout.ts          # $view(blockquoteSchema.node, ...)：识别标记、加类名、渲染标题行
  ├── toc.ts              # $prose：.ms-toc 段落装饰 + widget 渲染目录列表
  ├── calloutMarker.ts    # 纯函数：parseCalloutMarker / 类型映射表
  ├── tocHeadings.ts      # 纯函数：isTocParagraph / 从文档收集标题并成树
  ├── slashItems.ts       # 改：+5 项 callout、+1 项 目录、+1 组、若干别名
  └── slashMenu.ts        # 改：绑定新动作
main（src/main/modules/export/）
  ├── calloutBlocks.ts    # 纯 hast→hast：blockquote → div.callout
  ├── headingIds.ts       # 纯 hast→hast：slugifyHeading（§5.3）+ 给 h1–h6 生成 id
  ├── tocBlocks.ts        # 纯 hast→hast：[TOC] 段落 → nav.toc 嵌套列表
  ├── render.ts           # 改：挂上三个插件
  └── export.css          # 改：.callout* / .toc* 样式
styles（src/renderer/src/styles/theme.css）
  └── 改：--ms-callout-<type>-* 变量（亮暗各一套）+ .ms-callout* / .ms-toc* 样式
```

数据流不变：编辑器侧是 Milkdown 插件 + CSS；导出侧是 `renderMarkdownToHtml` 管线里新增的 rehype 插件。

### 4.2 为什么「零新节点」

Mermaid 的实现确立了先例：**用 `code_block` + language 分流，不新增节点类型**。这条路的好处很具体：

- markdown 往返天然正确——`[!NOTE]` 是 blockquote 里的普通文本、`[TOC]` 是段落文本，
  文档结构与「不支持该功能时的普通 markdown」完全一致，不存在自定义节点的 `toMarkdown` 写坏用户文档的风险。
- 不触碰 schema，撤销、粘贴、未来的协同都不会因为新节点类型出问题。

代价是「类型是文本而非结构化属性」，所以**改类型 = 改文本**（§6.4 明确这一点）。
这是有意取舍：v1 的收益（往返安全）大于代价（没有类型下拉）。

### 4.3 TOC 为什么不用 node view

给 `paragraph` 挂 node view 会接管**每一个段落**，要么复刻 Milkdown 的默认段落渲染（Mermaid 那块
已经吃过「复刻默认渲染」的亏，代码注释里写着改前必须回归），要么回归风险极高。段落远比代码块常见，
不值得为 TOC 冒这个险。因此 TOC 走**装饰**：段落本身不动，只在呈现层加类名与 widget。

## 5. 语法契约

### 5.1 Callout（GitHub Alerts）

```markdown
> [!NOTE]
> 内容第一段
>
> 内容第二段
```

- 识别条件：**blockquote 的第一个子节点是段落**，且该段落的纯文本满足
  `^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$`（`trim` 后，**大小写不敏感**）——
  即**标记独占首段**。
- 写入格式（面板插入即为此形，GitHub 同样认这个写法）：

  > [!NOTE]
  >
  > 内容

  也就是：标记独占一段，中间一个空的 `>` 行，然后才是内容段。解析后是**两个段落**，
  首段纯文本恰好是 `[!NOTE]`。

- **已知限制（有意为之）**：标记与内容写在同一段（`> [!NOTE]` 后直接换行跟内容、中间无空 `>` 行）
  **不识别**，降级为普通引用块。理由：那种写法在 ProseMirror 里是同一个段落，要在段内隐藏第一行
  必须拆段落，复杂度与回归风险都不值得；而且内容不会丢失，只是没有样式。
  这是一个**明确记录的限制**，不是遗漏。
- 写入统一用**大写**类型名。读取容忍小写与前后空白，避免手写内容显示不出样式。
- 其它不满足条件的情况（标记不在首段、类型名未知、段落里还有别的文字）→ **原样当普通引用块**。

类型映射（唯一真源，编辑侧与导出侧共用同一张表）：

| 标记           | 类名                | 中文标题 |
| -------------- | ------------------- | -------- |
| `[!NOTE]`      | `callout-note`      | 提示     |
| `[!TIP]`       | `callout-tip`       | 建议     |
| `[!IMPORTANT]` | `callout-important` | 重要     |
| `[!WARNING]`   | `callout-warning`   | 警告     |
| `[!CAUTION]`   | `callout-caution`   | 危险     |

### 5.2 TOC

- 识别条件：**整段文本恰为 `[TOC]`**（`trim` 后、大小写不敏感）。段落里夹着别的文字（如 `见 [TOC] 一节`）
  或出现在代码块里 → 不识别。
- 写入统一用 `[TOC]`。
- 目录内容：文档内**所有** `h1`–`h6`，按文档顺序，按层级缩进；无标题时目录为空。

### 5.3 标题锚点（导出）

导出当前**完全不给标题加 id**，TOC 链接依赖它，因此新增：

- 取标题的纯文本 → 去首尾空白 → 去标点 → 空白转 `-` → 保留中文与字母数字。
- 空标题回落为 `section`。
- 重名按出现顺序追加 `-1`、`-2`（第一个不加后缀）。
- 该规则只影响**标题元素新增 `id` 属性**，不改变标题的层级、文本或其它属性。

## 6. Callout 详细设计

### 6.1 编辑器渲染（`callout.ts`）

`$view(blockquoteSchema.node, ...)` —— 给**已有**的 blockquote 节点挂 node view：

- 命中标记时：容器加 `ms-callout ms-callout-<type>`，标记段加 `.ms-callout-marker`，
  并在标记段**前**插入一个标题行 DOM（内容取自 §5.1 的中文标题）。
- 未命中时：返回与默认一致的渲染（普通引用），**普通引用块的结构与样式必须保持不变**。
- **硬约束：node view 只操作 DOM，绝不 dispatch 事务改文档。** 标记文本必须留在文档里，
  这是往返正确性的前提。任何「把 `[!NOTE]` 从文本里删掉、改用属性存」的写法都违反本设计。

### 6.2 源码层切换

复用 [editingDecoration.ts](../../../src/renderer/src/editor/editingDecoration.ts) 的既有机制：

- `editingDecoration('MS_CALLOUT_EDITING', isCalloutBlockquote)` —— 选区进入该 blockquote 时打 `.is-editing`。
- CSS 据此隐藏标题行、显示 `[!NOTE]` 原文，用户可直接把 `[!TIP]` 改成 `[!WARNING]`。
- 这样「改类型」不需要任何额外 UI。

### 6.3 创建（斜杠面板）

- 新增第 5 组「提示块」，5 项，顺序：提示 / 建议 / 重要 / 警告 / 危险。
- 动作：插入一个 blockquote，含**两个段落**——首段文本为 `[!TYPE]`、次段为空；光标落在次段，
  可直接开始写内容。这个结构就是 §5.1 的写入格式，往返后仍是合法的 GitHub Alerts。
- 面板分组顺序变为：`标题 → 列表 → 基础块 → 提示块 → 插入`。

### 6.4 明确不做：块内改类型下拉

改类型的方式是「光标进入 → 源码层改标记」（§6.2）。v1 不做下拉菜单，这是**有意的 YAGNI**，
不是缺失（§3.2 已记录）。

### 6.5 导出（`calloutBlocks.ts`）

纯 hast→hast 的 rehype 插件（模式同既有的 `ensureCodeClass.ts`、`mermaidBlocks.ts`，可脱离 Electron 单测）：

```
blockquote
  └─ p  "[!NOTE]"
  └─ p  "内容第一段"
  └─ p  "内容第二段"
        ↓
<div class="callout callout-note">
  <p class="callout-title">提示</p>
  <p>内容第一段</p>
  <p>内容第二段</p>
</div>
```

- 标记段落被**移除**（其信息已转成 `callout-title`）。
- 未知类型（`[!FOO]`）→ 不动，原样保留为普通引用块（降级）。
- 空内容（只有标记段）→ 仍然生成 `callout-title`，内容区为空。

## 7. TOC 详细设计

### 7.1 编辑器渲染（`toc.ts`）

一个 `$prose` 插件，构建 DecorationSet：

- **node decoration**：命中「整段 = `[TOC]`」的段落 → `.ms-toc`。
- **widget decoration**：在该段落位置渲染生成的目录列表（`<nav class="ms-toc">` + 嵌套列表）。
- CSS：`.ms-toc:not(.is-editing) { display: none }` 隐藏原文；widget 是该段落的兄弟节点，
  不受段落 `display:none` 影响，正好顶替它的位置。
- 源码层同样复用 `editingDecoration`：光标进入时露出 `[TOC]` 原文，可编辑、可删除。
- 点击目录项 → 在 widget 内 `view.dom.querySelectorAll('h1,h2,h3,h4,h5,h6')[i].scrollIntoView(...)`，
  与既有 `EditorHandle.scrollToHeading` 同一套做法，插件自包含，不需要拿到 EditorHandle。

**性能约束**：装饰集在 `docChanged` 时重建，但**先用标题签名（`level + text` 序列）比对**，
签名未变则复用原 widget，不重建 DOM。避免每次按键都重排列表。

### 7.2 导出（`headingIds.ts` + `tocBlocks.ts`）

两个独立的纯 hast 函数，顺序执行：

1. `addHeadingIds(tree)`：按 §5.3 规则给 `h1`–`h6` 加 `id`。
2. `replaceTocPlaceholder(tree)`：把文本恰为 `[TOC]` 的 `<p>` 换成
   `<nav class="toc"><ul><li><a href="#id">文本</a>` 的嵌套结构（按层级嵌套 `<ul>`，缺级不留空层）。

两点顺序相关：

- 必须**先加 id 再替换占位符**（链接要用到 id）。
- 必须在 `remarkRehype` 之后、`rehypeStringify` 之前执行；在 `renderMarkdownToHtml` 里挂载。

## 8. 面板与主题

### 8.1 面板条目与别名

- `SlashGroup` 增 `'callout'`；`SLASH_GROUP_ORDER` → `heading, list, block, callout, insert`。
- 新增 6 项：5 项 callout + 1 项「目录」（归 `insert` 组）。
- 别名（过滤是**子串匹配**，因此逐条核对，避免与既有别名互为子串）：

| 项             | 别名                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| 提示 NOTE      | `note` `ts`                                                                               |
| 建议 TIP       | `tip` `jy`                                                                                |
| 重要 IMPORTANT | `important` `zy`                                                                          |
| 警告 WARNING   | `warning` `jg`                                                                            |
| 危险 CAUTION   | `caution`（**刻意不给 2 字拼音别名**：`wx` 会与「无序列表」的 `wxlb` 冲突，产生歧义命中） |
| 目录 TOC       | `toc` `contents` `ml`                                                                     |

- `lb` 是三个列表项**刻意共享**的别名（一个查询命中整类），不视为冲突。
- 既有 7 条「精确命中」断言（`gs`/`bt`/`lb`/`zw`/`tp`/`fgx`/`yy`）必须继续成立。

### 8.2 主题变量

- `theme.css`：`:root` 与 `[data-theme='dark']` **各加一套** 5 组
  `--ms-callout-<type>-{bg,border,title,text}`。亮暗各给是硬要求——[App.tsx](../../../src/renderer/src/App.tsx)
  已注明 antd 暗色算法会把 seed 当「真值」，缺一套会导致暗色下不可见。
- `export.css`：同样 5 组颜色**写死**（导出产物自包含，不能依赖编辑器的 CSS 变量），并定义 `.toc*`。
- 所有颜色走变量，不写裸色值（编辑器侧）。

## 9. 错误处理与降级

| 情形                          | 行为                                                    |
| ----------------------------- | ------------------------------------------------------- |
| 标记不在引用首段              | 不识别，普通引用块                                      |
| 标记与内容同段（无空 `>` 行） | 不识别，普通引用块（内容不丢，只是没样式，§5.1 已记录） |
| 未知类型 `[!FOO]`             | 编辑侧不识别；导出侧原样保留                            |
| `[TOC]` 夹在别的文字里        | 不识别，普通段落                                        |
| `[TOC]` 在代码块里            | 不识别（代码块内容不参与段落匹配）                      |
| 文档无标题                    | 目录渲染为空（编辑器侧提示「暂无标题」，导出侧空 nav）  |
| 重名标题                      | slug 追加 `-1`/`-2`，链接仍正确                         |
| 标题含纯符号                  | slug 为空时回落 `section`                               |
| 以上任何情况                  | **都不报错、不阻塞编辑**，最差退化为普通 markdown       |

## 10. 测试

新增测试文件：

- `tests/callout-marker.test.ts`：`parseCalloutMarker()` —— 大小写、前后空白、未知类型，
  以及三种应返回 null 的写法：标记不在首段、标记与内容同段（`[!NOTE]\n内容`）、`[!NOTE] 跟上正文`；
  类型↔类名↔中文标题映射完整。
- `tests/callout-blocks.test.ts`：导出插件 —— 正常转换、未知类型降级、非首段不转换、只有标记无内容。
- `tests/toc-headings.test.ts`：`isTocParagraph()`（大小写/空白/夹带文字）+ 从文档收集标题并成树
  （层级缩进、缺级、无标题）。
- `tests/toc-blocks.test.ts`：`slugifyHeading()`（中文保留、去标点、空回落、重名去重）+
  `replaceTocPlaceholder()` 的 HTML 片段；`addHeadingIds()` 只加 id 不动其它属性。
- `tests/slash-items.test.ts`（改）：新增 6 项存在且分组正确、新别名精确命中、既有 7 条断言仍成立。

回归面（**必须专门验**，这是复用既有节点的最大风险）：

- 普通引用块的结构与样式不变。
- 普通段落的结构不变（TOC 用装饰正是为了避开这个）。
- 既有导出产物：标题**只多 `id` 属性**，其余（层级、文本、代码高亮、公式、图表、图片内联）不变。

GUI 行为用既有的 Electron 驱动夹具验证（`sendInputEvent` + `executeJavaScript`，量 DOM 与几何，
不依赖截图）：改动即重绘、点目录跳转、光标进出切换源码层。

## 11. 验收标准

1. 在段落开头 `/` →「提示块」组选「警告」，插入 `> [!WARNING]`，编辑器内渲染成带「警告」标题与配色的块。
2. 光标进入该块，标题行消失、露出 `[!WARNING]`；把 `WARNING` 改成 `TIP`，块立即变成「建议」样式。
3. 普通引用块（`> 普通引用`）外观与行为**完全不变**。
4. 导出的 HTML 里该块是 `<div class="callout callout-warning">`，含 `<p class="callout-title">警告</p>`。
5. `/` →「目录」插入 `[TOC]`，编辑器内显示可点击的层级目录；标题增删后目录自动更新。
6. 点击目录项滚动到对应标题。
7. 导出的 HTML 里 `[TOC]` 变成 `<nav class="toc">` 嵌套列表，链接指向标题 `id`，点击可用。
8. 文档无标题时不报错，目录为空。
9. `pnpm test` 全绿；`typecheck:node` / `typecheck:web` / `build` 通过。

## 12. 实施顺序

两个功能互不依赖，分两步交付、各自可提交：

1. **Callout**（较简单，先把「复用既有节点 + 装饰」的模式跑通并验完回归面）。
2. **TOC**：编辑侧 → 导出侧（`headingIds` 先于 `tocBlocks`）。
