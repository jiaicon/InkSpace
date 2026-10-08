# 新块类型（提示块 Callout / 文档内目录 TOC）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Markdown Studio 里加两类块级内容——GitHub Alerts 语法的提示块 callout，与 `[TOC]` 文档内目录——编辑侧渲染、斜杠面板入口、导出侧渲染全部打通。

**Architecture:** 全程**零新节点**（不改 ProseMirror schema）：callout 复用 `blockquote` + 首段文本标记 `[!TYPE]`，TOC 复用**根层段落**的 `[TOC]` 文本；两者的呈现都由 **ProseMirror 装饰**（node decoration 加类名 + widget decoration 渲染标题行/目录列表）完成，**绝不回写文档**，所以 markdown 往返天然正确。导出侧在 `renderMarkdownToHtml` 管线里挂三个纯 hast 变换插件（callout 转换、标题加 id、`[TOC]` 替换）。

**Tech Stack:** Electron + Vite + React 18；编辑器 Milkdown（ProseMirror）；导出 remark/rehype；测试 vitest（`environment: 'node'`）；包管理 pnpm（脚本用 npm 调用亦可）。

**Spec:** [docs/superpowers/specs/2026-10-08-new-block-types-design.md](../specs/2026-10-08-new-block-types-design.md)

## Global Constraints

- **零新节点**：不得新增或修改任何 ProseMirror `$nodeSchema`。渲染层不得 dispatch 事务修改文档内容。
- **markdown 是唯一事实源**：`[!TYPE]` 与 `[TOC]` 必须以原文存在于 markdown 中，往返不丢。
- **普通内容零回归**：普通引用块、普通段落的 DOM 结构与样式必须与本计划实施前完全一致。
- **共用规则放 `src/shared/`**：主进程不能 import `src/renderer`，凡两侧都要用的判定一律放 shared（同 `src/shared/mermaid.ts` 的先例）。
- **面板别名不得产生歧义命中**：过滤是**子串**匹配，新增别名需核对不与既有别名互为子串。
- **CSS**：编辑器侧配色一律走 `--ms-*` 变量（亮暗各一套）；`export.css` 沿用既有约定，写 `var(--ms-x, <浅色兜底>)`，**不新增映射层**。
- **不新增依赖**。Milkdown 相关一律从 `@milkdown/kit/*` 导入（`$prose`/`$view` 来自 `@milkdown/kit/utils`）。
- 提交信息用中文、沿用仓库风格；每个 Task 末尾提交一次。

## Review Focus

以下是 spec 隐含、但没有哪个 Task 的测试能自动覆盖、且最容易伤到真实用户的输入。每一条都在对应 Task 的测试里显式钉住：

1. **`> [TOC]` / `- [TOC]`（引用内、列表项内的 `[TOC]`）** → 必须保持普通文本，不能被当成目录（占位符只认**根层段落**）。→ Task 6、Task 8
2. **标题里带行内标记**（如 ``## 用 `code` 的标题``）→ 编辑侧与导出侧的目录文本、slug 必须一致（都取纯文本）。→ Task 6、Task 7
3. **标题只有 emoji 或符号**（`## !!!`、`## 😀`）→ slug 回落为 `section`，链接仍可用、不产生空 `href="#"`。→ Task 7
4. **`> [!NOTE]` 不在引用首段**（如 `> 正文` 之后才是标记）→ 保持普通引用块，且普通引用结构完全不变。→ Task 2、Task 4
5. **callout 内含代码块 / 列表 / Mermaid** → 导出后内容完整留在 `div.callout` 内，且后续管线（语法高亮、图表渲染、图片内联）仍能识别到它们。→ Task 3

## 与 spec 的两处偏差（有意为之，理由随附）

1. **callout 的呈现用「装饰」而非 spec §6.1 写的 `$view(blockquoteSchema.node, ...)`。**
   `$view` 会接管**所有** blockquote，普通引用也会被套上自定义 DOM 结构（例如多一层 wrapper），
   直接威胁 Review Focus #4。改用 node decoration + widget decoration 后，普通引用的 DOM 一个字节都不动，
   而且与 TOC 复用同一套机制。spec 的意图（零新节点、不回写文档、普通引用不变）全部保留且更稳。
2. **共用判定放 `src/shared/`**（spec §4.1 把它们放在 `renderer/editor/` 下）。
   导出在主进程、编辑器在渲染进程，主进程无法 import 渲染进程代码，因此 `parseCalloutMarker`、
   `buildTocTree`、`isTocParagraph` 必须放 shared 才能两边共用一套规则。

---

## Task 1: Callout 标记的共用判定（纯函数）

**Files:**

- Create: `src/shared/callout.ts`
- Test: `tests/callout-marker.test.ts`

**Interfaces:**

- Consumes: 无
- Produces: `CalloutType`、`CalloutMeta`、`CALLOUTS`、`calloutMeta(type)`、`parseCalloutMarker(text): CalloutType | null`、`calloutMarkerText(type): string`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/callout-marker.test.ts
import { describe, expect, it } from 'vitest'
import { CALLOUTS, calloutMarkerText, calloutMeta, parseCalloutMarker } from '../src/shared/callout'

describe('parseCalloutMarker', () => {
  it('识别 5 种类型', () => {
    expect(parseCalloutMarker('[!NOTE]')).toBe('NOTE')
    expect(parseCalloutMarker('[!TIP]')).toBe('TIP')
    expect(parseCalloutMarker('[!IMPORTANT]')).toBe('IMPORTANT')
    expect(parseCalloutMarker('[!WARNING]')).toBe('WARNING')
    expect(parseCalloutMarker('[!CAUTION]')).toBe('CAUTION')
  })

  it('容忍小写与前后空白', () => {
    expect(parseCalloutMarker('  [!note]  ')).toBe('NOTE')
    expect(parseCalloutMarker('[!Caution]')).toBe('CAUTION')
  })

  it('标记与内容同段不识别（spec §5.1 已知限制）', () => {
    expect(parseCalloutMarker('[!NOTE]\n内容')).toBeNull()
  })

  it('标记后面跟正文不识别', () => {
    expect(parseCalloutMarker('[!NOTE] 跟上正文')).toBeNull()
  })

  it('未知类型不识别', () => {
    expect(parseCalloutMarker('[!FOO]')).toBeNull()
  })

  it('普通文本与空串不识别', () => {
    expect(parseCalloutMarker('普通引用')).toBeNull()
    expect(parseCalloutMarker('')).toBeNull()
  })
})

describe('类型表', () => {
  it('5 种类型齐全，类名与中文标题符合约定', () => {
    expect(CALLOUTS.map((c) => c.type)).toEqual(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])
    expect(calloutMeta('WARNING')).toEqual({ type: 'WARNING', slug: 'warning', title: '警告' })
    expect(calloutMeta('CAUTION').title).toBe('危险')
  })

  it('calloutMarkerText 产出大写标记', () => {
    expect(calloutMarkerText('NOTE')).toBe('[!NOTE]')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/callout-marker.test.ts`
Expected: FAIL —— `Failed to load url ../src/shared/callout`（模块不存在）

- [ ] **Step 3: 实现**

```ts
// src/shared/callout.ts
/**
 * 提示块（GitHub Alerts）的共用规则：编辑器的装饰插件与导出的块转换都要用，
 * 所以放 shared，避免两边判断不一致（同 shared/mermaid.ts 的理由）。
 *
 * 语法：blockquote 的**首段**整段恰为 `[!TYPE]`，如
 *   > [!NOTE]
 *   >
 *   > 内容
 * 标记与内容写在同一段（无空 `>` 行）**不识别**——见 spec §5.1 的已知限制。
 */

export type CalloutType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

export interface CalloutMeta {
  type: CalloutType
  /** css 类后缀：note → callout-note */
  slug: string
  /** 展示用中文标题 */
  title: string
}

export const CALLOUTS: readonly CalloutMeta[] = [
  { type: 'NOTE', slug: 'note', title: '提示' },
  { type: 'TIP', slug: 'tip', title: '建议' },
  { type: 'IMPORTANT', slug: 'important', title: '重要' },
  { type: 'WARNING', slug: 'warning', title: '警告' },
  { type: 'CAUTION', slug: 'caution', title: '危险' }
]

const BY_TYPE = new Map(CALLOUTS.map((c) => [c.type, c]))

export function calloutMeta(type: CalloutType): CalloutMeta {
  return BY_TYPE.get(type) as CalloutMeta
}

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i

/** 整段文本是否为 callout 标记；不是则返回 null */
export function parseCalloutMarker(text: string): CalloutType | null {
  const m = MARKER_RE.exec(text.trim())
  return m ? (m[1].toUpperCase() as CalloutType) : null
}

/** 写入文档时统一用大写标记 */
export function calloutMarkerText(type: CalloutType): string {
  return `[!${type}]`
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/callout-marker.test.ts`
Expected: PASS（8 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/shared/callout.ts tests/callout-marker.test.ts
git commit -m "feat: 提示块标记的共用判定（callout 第一步）"
```

---

## Task 2: 导出侧把 callout 引用转成带样式的 div

**Files:**

- Modify: `src/main/modules/export/ensureCodeClass.ts:2-7`（给 `HastNode` 补 `value?: string`）
- Create: `src/main/modules/export/calloutBlocks.ts`
- Test: `tests/callout-blocks.test.ts`

**Interfaces:**

- Consumes: `calloutMeta`、`parseCalloutMarker`（Task 1）
- Produces: `transformCallouts(node: HastNode | undefined): void`

- [ ] **Step 1: 先给 HastNode 补上文本字段**

`HastNode` 目前没有 `value`，而文本节点是 `{ type: 'text', value: '...' }`。加一个可选字段（向后兼容）：

```ts
// src/main/modules/export/ensureCodeClass.ts（替换原接口）
/** hast 节点的最小结构（只用到这些字段，便于单测构造普通对象） */
export interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}
```

- [ ] **Step 2: 写失败的测试**

```ts
// tests/callout-blocks.test.ts
import { describe, expect, it } from 'vitest'
import { transformCallouts } from '../src/main/modules/export/calloutBlocks'
import type { HastNode } from '../src/main/modules/export/ensureCodeClass'

const text = (value: string): HastNode => ({ type: 'text', value })
const p = (...children: HastNode[]): HastNode => ({ type: 'element', tagName: 'p', children })
const quote = (...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName: 'blockquote',
  children
})
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

describe('transformCallouts', () => {
  it('把首段是标记的引用转成 div.callout', () => {
    const tree = root(quote(p(text('[!NOTE]')), p(text('内容一')), p(text('内容二'))))
    transformCallouts(tree)

    const div = tree.children![0]
    expect(div.tagName).toBe('div')
    expect(div.properties?.className).toEqual(['callout', 'callout-note'])

    const kids = div.children!
    expect(kids[0].tagName).toBe('p')
    expect(kids[0].properties?.className).toEqual(['callout-title'])
    expect(kids[0].children![0].value).toBe('提示')
    expect(kids[1].children![0].value).toBe('内容一')
    expect(kids[2].children![0].value).toBe('内容二')
  })

  it('大小写与空白容错', () => {
    const tree = root(quote(p(text(' [!warning] ')), p(text('x'))))
    transformCallouts(tree)
    expect(tree.children![0].properties?.className).toEqual(['callout', 'callout-warning'])
  })

  it('未知类型原样保留为引用', () => {
    const tree = root(quote(p(text('[!FOO]')), p(text('x'))))
    transformCallouts(tree)
    expect(tree.children![0].tagName).toBe('blockquote')
  })

  it('标记不在首段不转换（Review Focus #4）', () => {
    const tree = root(quote(p(text('正文')), p(text('[!NOTE]'))))
    transformCallouts(tree)
    expect(tree.children![0].tagName).toBe('blockquote')
  })

  it('只有标记没有内容', () => {
    const tree = root(quote(p(text('[!TIP]'))))
    transformCallouts(tree)
    const div = tree.children![0]
    expect(div.tagName).toBe('div')
    expect(div.children!.map((c) => c.tagName)).toEqual(['p'])
  })

  it('内容里的列表/代码块完整保留在 div 内', () => {
    const list: HastNode = {
      type: 'element',
      tagName: 'ul',
      children: [{ type: 'element', tagName: 'li', children: [p(text('项'))] }]
    }
    const code: HastNode = {
      type: 'element',
      tagName: 'pre',
      children: [{ type: 'element', tagName: 'code', children: [text('x()')] }]
    }
    const tree = root(quote(p(text('[!NOTE]')), list, code))
    transformCallouts(tree)
    expect(tree.children![0].children!.map((c) => c.tagName)).toEqual(['p', 'ul', 'pre'])
  })

  it('嵌套引用只转换最内层命中', () => {
    const tree = root(quote(quote(p(text('[!NOTE]')), p(text('x')))))
    transformCallouts(tree)
    const outer = tree.children![0]
    expect(outer.tagName).toBe('blockquote')
    expect(outer.children![0].tagName).toBe('div')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/callout-blocks.test.ts`
Expected: FAIL —— `Failed to load url ../src/main/modules/export/calloutBlocks`

- [ ] **Step 4: 实现**

```ts
// src/main/modules/export/calloutBlocks.ts
import { calloutMeta, parseCalloutMarker } from '@shared/callout'
import type { HastNode } from './ensureCodeClass'

/** 元素节点的纯文本（递归拼接） */
function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

/**
 * 把 `> [!TYPE]` 的引用块换成 `<div class="callout callout-<slug>">`。
 *
 * 判定与编辑器侧共用 @shared/callout，两边规则不会漂移。
 * 不满足条件的引用块一律原样不动（降级为普通引用）。
 */
export function transformCallouts(node: HastNode | undefined): void {
  if (!node?.children) return

  node.children.forEach((child, i) => {
    if (child.type === 'element' && child.tagName === 'blockquote') {
      const converted = asCallout(child)
      if (converted) {
        node.children![i] = converted
        return // 内容已原样搬进 div，不必再往里递归
      }
    }
    transformCallouts(child)
  })
}

function asCallout(quote: HastNode): HastNode | null {
  const kids = quote.children ?? []
  const first = kids[0]
  if (!first || first.type !== 'element' || first.tagName !== 'p') return null

  const type = parseCalloutMarker(textOf(first))
  if (!type) return null

  const meta = calloutMeta(type)
  const title: HastNode = {
    type: 'element',
    tagName: 'p',
    properties: { className: ['callout-title'] },
    children: [{ type: 'text', value: meta.title }]
  }
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['callout', `callout-${meta.slug}`] },
    children: [title, ...kids.slice(1)]
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/callout-blocks.test.ts`
Expected: PASS（7 个用例）

- [ ] **Step 6: 提交**

```bash
git add src/main/modules/export/ensureCodeClass.ts src/main/modules/export/calloutBlocks.ts tests/callout-blocks.test.ts
git commit -m "feat: 导出侧把 callout 引用转成带样式的 div"
```

---

## Task 3: 把 callout 挂进导出管线 + 导出样式

**Files:**

- Modify: `src/main/modules/export/render.ts`
- Modify: `src/main/modules/export/export.css`（末尾追加）
- Test: `tests/callout-pipeline.test.ts`

**Interfaces:**

- Consumes: `transformCallouts`（Task 2）
- Produces: `renderMarkdownToHtml` 的输出里含 `.callout`（后续 Task 9 沿用同一管线）

- [ ] **Step 1: 写失败的集成测试**

````ts
// tests/callout-pipeline.test.ts
import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '../src/main/modules/export/render'
import { hasMermaid } from '../src/main/modules/export/mermaidBlocks'

describe('导出管线的 callout', () => {
  it('markdown → 带样式的 div', async () => {
    const html = await renderMarkdownToHtml('> [!WARNING]\n>\n> 注意风险\n')
    expect(html).toContain('<div class="callout callout-warning">')
    expect(html).toContain('<p class="callout-title">警告</p>')
    expect(html).toContain('注意风险')
    expect(html).not.toContain('[!WARNING]')
  })

  it('普通引用块不受影响（Review Focus #4）', async () => {
    const html = await renderMarkdownToHtml('> 普通引用\n')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<p>普通引用</p>')
    expect(html).not.toContain('callout')
  })

  it('callout 里的 Mermaid 仍能被后续管线识别（Review Focus #5）', async () => {
    const html = await renderMarkdownToHtml('> [!NOTE]\n>\n> ```mermaid\n> graph TD\n> ```\n')
    expect(html).toContain('<div class="callout callout-note">')
    expect(hasMermaid(html)).toBe(true)
  })

  it('callout 里的代码块仍带 hljs 类（Review Focus #5）', async () => {
    const html = await renderMarkdownToHtml('> [!NOTE]\n>\n> ```js\n> const a = 1\n> ```\n')
    expect(html).toContain('class="hljs language-js"')
  })
})
````

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/callout-pipeline.test.ts`
Expected: FAIL —— 输出里没有 `callout`（插件还没挂上）

- [ ] **Step 3: 挂上插件**

在 `src/main/modules/export/render.ts` 里：加 import、加一个 rehype 包装函数、并插进管线。

```ts
// 加在文件顶部 import 区
import { transformCallouts } from './calloutBlocks'

// 加在 rehypeEnsureHljsClass 后面
/**
 * 把 `> [!TYPE]` 的引用块换成带样式的 div.callout。
 * 放在 hljs 补类之后：块内的代码块先拿到 hljs 类，再整体被搬进 div，互不干扰。
 */
function rehypeCallouts() {
  return (tree: HastNode): void => transformCallouts(tree)
}

// 管线里插在 rehypeEnsureHljsClass 之后、rehypeKatex 之前
  .use(rehypeEnsureHljsClass)
  .use(rehypeCallouts)
  .use(rehypeKatex)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/callout-pipeline.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 加导出样式**

追加到 `src/main/modules/export/export.css` 末尾（配色读主题变量、第二参数是浅色兜底，沿用本文件既有约定）：

```css
/* 提示块（GitHub Alerts 语法） */
.callout {
  margin: 1em 0;
  padding: 0.75em 1em;
  border-left: 4px solid transparent;
  border-radius: 4px;
}
.callout-title {
  margin: 0 0 0.4em;
  font-weight: 600;
}
.callout .callout-body > *:last-child,
.callout > *:last-child {
  margin-bottom: 0;
}

.callout-note {
  background: var(--ms-callout-note-bg, #ddf4ff);
  border-left-color: var(--ms-callout-note-border, #54aeff);
}
.callout-note .callout-title {
  color: var(--ms-callout-note-title, #0969da);
}

.callout-tip {
  background: var(--ms-callout-tip-bg, #dafbe1);
  border-left-color: var(--ms-callout-tip-border, #4ac26b);
}
.callout-tip .callout-title {
  color: var(--ms-callout-tip-title, #1a7f37);
}

.callout-important {
  background: var(--ms-callout-important-bg, #fbefff);
  border-left-color: var(--ms-callout-important-border, #c297ff);
}
.callout-important .callout-title {
  color: var(--ms-callout-important-title, #8250df);
}

.callout-warning {
  background: var(--ms-callout-warning-bg, #fff8c5);
  border-left-color: var(--ms-callout-warning-border, #d4a72c);
}
.callout-warning .callout-title {
  color: var(--ms-callout-warning-title, #9a6700);
}

.callout-caution {
  background: var(--ms-callout-caution-bg, #ffebe9);
  border-left-color: var(--ms-callout-caution-border, #ff8182);
}
.callout-caution .callout-title {
  color: var(--ms-callout-caution-title, #cf222e);
}
```

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿

```bash
git add src/main/modules/export/render.ts src/main/modules/export/export.css tests/callout-pipeline.test.ts
git commit -m "feat: 导出管线挂上 callout 转换与样式"
```

---

## Task 4: 编辑器里的 callout 渲染

**Files:**

- Create: `src/renderer/src/editor/callout.ts`
- Modify: `src/renderer/src/editor/milkdownEditor.ts`（`.use(...)` 一行）
- Modify: `src/renderer/src/styles/theme.css`（变量 + 样式）
- Test: `tests/callout-decorations.test.ts`

**Interfaces:**

- Consumes: `calloutMeta`、`parseCalloutMarker`（Task 1）
- Produces: `collectCallouts(doc)`（纯函数，供测试）、`calloutPlugin`（Milkdown 插件）

- [ ] **Step 1: 写失败的测试（只测纯函数部分）**

装饰本身要跑在浏览器里，但「哪些块是 callout」这段判定是纯的，先测它：

```ts
// tests/callout-decorations.test.ts
import { describe, expect, it } from 'vitest'
import { collectCallouts, type CalloutDocLike } from '../src/renderer/src/editor/callout'

/** 用最小结构伪造 ProseMirror doc；子节点从父节点 pos+1 开始，与真实文档一致 */
function fakeDoc(topLevel: any[]): CalloutDocLike {
  return {
    descendants(cb) {
      const walk = (list: any[], base: number) => {
        let pos = base
        for (const n of list) {
          const keepGoing = cb(n, pos)
          if (keepGoing !== false && n.children) walk(n.children, pos + 1)
          pos += n.nodeSize
        }
      }
      walk(topLevel, 0)
    }
  } as CalloutDocLike
}

const para = (text: string): any => ({
  type: { name: 'paragraph' },
  textContent: text,
  nodeSize: text.length + 2,
  firstChild: null
})
const quote = (children: any[], nodeSize: number): any => ({
  type: { name: 'blockquote' },
  textContent: children.map((c: any) => c.textContent).join(''),
  nodeSize,
  firstChild: children[0],
  children
})

describe('collectCallouts', () => {
  it('找出首段是标记的引用块，并给出标记段结束位置', () => {
    const doc = fakeDoc([quote([para('[!NOTE]'), para('内容')], 100)])
    // 标记段自身 nodeSize = 8 + 2 = 10，从 pos+1 开始 → markerTo = 11
    expect(collectCallouts(doc)).toEqual([{ pos: 0, to: 100, markerTo: 11, type: 'NOTE' }])
  })

  it('标记不在首段则不算（Review Focus #4）', () => {
    const doc = fakeDoc([quote([para('正文'), para('[!NOTE]')], 100)])
    expect(collectCallouts(doc)).toEqual([])
  })

  it('普通引用不算', () => {
    const doc = fakeDoc([quote([para('普通引用')], 100)])
    expect(collectCallouts(doc)).toEqual([])
  })

  it('外层不是 callout 时，仍能找到内层嵌套的 callout', () => {
    const inner = quote([para('[!TIP]'), para('x')], 50)
    const doc = fakeDoc([quote([inner], 200)])
    const hits = collectCallouts(doc)
    expect(hits).toHaveLength(1)
    expect(hits[0].type).toBe('TIP')
  })

  it('大小写容错', () => {
    const doc = fakeDoc([quote([para('[!caution]'), para('x')], 100)])
    expect(collectCallouts(doc)[0].type).toBe('CAUTION')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/callout-decorations.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现插件**

```ts
// src/renderer/src/editor/callout.ts
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { calloutMeta, parseCalloutMarker, type CalloutType } from '@shared/callout'

export interface CalloutHit {
  pos: number
  to: number
  /** 标记段（首段）的结束位置 —— 渲染层靠它给标记段单独加类名，而不是用 :first-child */
  markerTo: number
  type: CalloutType
}

/** collectCallouts 只需要文档这几个能力，便于用伪造对象单测 */
export interface CalloutDocLike {
  descendants(cb: (node: CalloutNodeLike, pos: number) => boolean | void): void
}
export interface CalloutNodeLike {
  type: { name: string }
  firstChild: CalloutNodeLike | null
  textContent: string
  nodeSize: number
}

/** 文档里所有「首段是 callout 标记」的引用块 */
export function collectCallouts(doc: CalloutDocLike): CalloutHit[] {
  const hits: CalloutHit[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return true
    const first = node.firstChild
    if (!first || first.type.name !== 'paragraph') return true
    const type = parseCalloutMarker(first.textContent)
    if (!type) return true // 继续下探，内层可能才是 callout
    hits.push({ pos, to: pos + node.nodeSize, markerTo: pos + 1 + first.nodeSize, type })
    return false
  })
  return hits
}

interface CalloutState {
  deco: DecorationSet
  key: string
}

function buildState(doc: PMNode, selection: { from: number; to: number }): CalloutState {
  const hits = collectCallouts(doc)
  const decos: Decoration[] = []
  const parts: string[] = []

  for (const hit of hits) {
    const meta = calloutMeta(hit.type)
    // 选区落在块内 = 用户正在编辑或选中它，此时露出 [!TYPE] 源码
    const editing = selection.from >= hit.pos && selection.to <= hit.to
    parts.push(`${hit.pos}:${hit.type}:${editing ? 1 : 0}`)

    const classes = ['ms-callout', `ms-callout-${meta.slug}`]
    if (editing) classes.push('is-editing')
    decos.push(Decoration.node(hit.pos, hit.to, { class: classes.join(' ') }))
    // 标记段单独打类名 —— 标题 widget 会成为 blockquote 的第一个子元素，
    // 用 `:first-child` 会选中标题而不是标记段
    decos.push(Decoration.node(hit.pos + 1, hit.markerTo, { class: 'ms-callout-marker' }))

    if (!editing) {
      // 标题行是 widget，不进文档；渲染层靠 CSS 隐藏标记段，让它顶替那一行
      decos.push(
        Decoration.widget(
          hit.pos + 1,
          () => {
            const el = document.createElement('p')
            el.className = 'ms-callout-title'
            el.setAttribute('contenteditable', 'false')
            el.textContent = meta.title
            return el
          },
          { side: -1, key: `ms-callout-title-${hit.pos}-${meta.slug}` }
        )
      )
    }
  }

  return { deco: DecorationSet.create(doc, decos), key: parts.join('|') }
}

export const calloutPlugin = $prose(() => {
  const key = new PluginKey<CalloutState>('MS_CALLOUT')
  return new Plugin({
    key,
    state: {
      init: (_config, state) => buildState(state.doc, state.selection),
      apply: (tr, prev, _old, next) => {
        if (!tr.docChanged && !tr.selectionSet) return prev
        const built = buildState(next.doc, next.selection)
        // 结构没变就复用旧装饰集，避免每次按键都重建 widget DOM
        return built.key === prev.key ? prev : built
      }
    },
    props: {
      decorations: (state) => key.getState(state)?.deco ?? null
    }
  })
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/callout-decorations.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 注册进编辑器**

`src/renderer/src/editor/milkdownEditor.ts`：加 import，并在插件的链式调用里加一行（紧邻 `.use(mathPlugins)` 附近即可）：

```ts
import { calloutPlugin } from './callout'
// ...
    .use(mathPlugins)
    .use(calloutPlugin)
    .use(mermaidPlugins)
```

- [ ] **Step 6: 加编辑器样式与变量**

`src/renderer/src/styles/theme.css`：

在 `:root` 里（紧跟 `--ms-table-header-bg` 之后）追加浅色 5 组：

```css
/* 提示块（callout）：每类 4 个值，亮暗各一套 */
--ms-callout-note-bg: #ddf4ff;
--ms-callout-note-border: #54aeff;
--ms-callout-note-title: #0969da;
--ms-callout-tip-bg: #dafbe1;
--ms-callout-tip-border: #4ac26b;
--ms-callout-tip-title: #1a7f37;
--ms-callout-important-bg: #fbefff;
--ms-callout-important-border: #c297ff;
--ms-callout-important-title: #8250df;
--ms-callout-warning-bg: #fff8c5;
--ms-callout-warning-border: #d4a72c;
--ms-callout-warning-title: #9a6700;
--ms-callout-caution-bg: #ffebe9;
--ms-callout-caution-border: #ff8182;
--ms-callout-caution-title: #cf222e;
```

在 `[data-theme='dark']` 里（紧跟 `--ms-table-header-bg` 的暗色值之后）追加暗色 5 组：

```css
--ms-callout-note-bg: rgba(47, 129, 247, 0.15);
--ms-callout-note-border: #2f81f7;
--ms-callout-note-title: #6cb6ff;
--ms-callout-tip-bg: rgba(63, 185, 80, 0.15);
--ms-callout-tip-border: #3fb950;
--ms-callout-tip-title: #56d364;
--ms-callout-important-bg: rgba(163, 113, 247, 0.15);
--ms-callout-important-border: #a371f7;
--ms-callout-important-title: #b083f0;
--ms-callout-warning-bg: rgba(210, 153, 34, 0.15);
--ms-callout-warning-border: #d29922;
--ms-callout-warning-title: #e3b341;
--ms-callout-caution-bg: rgba(248, 81, 73, 0.15);
--ms-callout-caution-border: #f85149;
--ms-callout-caution-title: #ff7b72;
```

再把编辑器的块样式追加到 `theme.css` 末尾：

```css
/* 提示块（GitHub Alerts 语法）：标记段就是首段，渲染层藏掉它、由 widget 标题行顶替 */
.milkdown .ms-callout {
  margin: 1em 0;
  padding: 0.75em 1em;
  border-left: 4px solid transparent;
  border-radius: 4px;
}
.milkdown .ms-callout-title {
  margin: 0 0 0.4em;
  font-weight: 600;
  user-select: none;
}
.milkdown .ms-callout > *:last-child {
  margin-bottom: 0;
}
/* 非编辑态：隐藏 [!TYPE] 标记段。
   用专门的类名而不是 :first-child —— 标题 widget 排在标记段前面，会是第一个子元素 */
.milkdown .ms-callout:not(.is-editing) .ms-callout-marker {
  display: none;
}
/* 编辑态：藏掉标题行，露出原始标记让用户改类型 */
.milkdown .ms-callout.is-editing .ms-callout-title {
  display: none;
}

.milkdown .ms-callout-note {
  background: var(--ms-callout-note-bg);
  border-left-color: var(--ms-callout-note-border);
}
.milkdown .ms-callout-note .ms-callout-title {
  color: var(--ms-callout-note-title);
}
.milkdown .ms-callout-tip {
  background: var(--ms-callout-tip-bg);
  border-left-color: var(--ms-callout-tip-border);
}
.milkdown .ms-callout-tip .ms-callout-title {
  color: var(--ms-callout-tip-title);
}
.milkdown .ms-callout-important {
  background: var(--ms-callout-important-bg);
  border-left-color: var(--ms-callout-important-border);
}
.milkdown .ms-callout-important .ms-callout-title {
  color: var(--ms-callout-important-title);
}
.milkdown .ms-callout-warning {
  background: var(--ms-callout-warning-bg);
  border-left-color: var(--ms-callout-warning-border);
}
.milkdown .ms-callout-warning .ms-callout-title {
  color: var(--ms-callout-warning-title);
}
.milkdown .ms-callout-caution {
  background: var(--ms-callout-caution-bg);
  border-left-color: var(--ms-callout-caution-border);
}
.milkdown .ms-callout-caution .ms-callout-title {
  color: var(--ms-callout-caution-title);
}
```

- [ ] **Step 7: 全量回归 + 在真实 app 里验证**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: 全绿

手动验证（`npm run dev`，或用 Electron 驱动夹具）：

1. 打开一个文档，粘贴 `> [!WORKING]`… 逐个试 `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`，确认各自渲染成带中文标题与配色的块。
2. 光标点进这个块 → 标题行消失、露出 `[!NOTE]`；把 `NOTE` 改成 `WARNING` → 样式与标题立刻变成「警告」。
3. **回归**：写一个普通引用 `> 普通引用`，确认外观、缩进、文字色与本计划实施前**完全一致**（可对 `git stash` 前后截图比对）。
4. 明暗两种主题下都看一眼配色的可读性。

- [ ] **Step 8: 提交**

```bash
git add src/renderer/src/editor/callout.ts src/renderer/src/editor/milkdownEditor.ts src/renderer/src/styles/theme.css tests/callout-decorations.test.ts
git commit -m "feat: 编辑器里把 callout 引用渲染成提示块"
```

---

## Task 5: 斜杠面板加「提示块」组

**Files:**

- Modify: `src/renderer/src/editor/slashItems.ts`
- Modify: `src/renderer/src/editor/slashMenu.ts`
- Test: `tests/slash-items.test.ts`（追加）

**Interfaces:**

- Consumes: `CALLOUTS`、`calloutMarkerText`（Task 1）
- Produces: 面板里 `id` 为 `callout-note` / `callout-tip` / `callout-important` / `callout-warning` / `callout-caution` 的 5 项

- [ ] **Step 1: 写失败的测试**

追加到 `tests/slash-items.test.ts` 末尾：

```ts
describe('提示块面板项', () => {
  it('5 种 callout 各一项，归在 callout 组', () => {
    const ids = [
      'callout-note',
      'callout-tip',
      'callout-important',
      'callout-warning',
      'callout-caution'
    ]
    for (const id of ids) {
      const item = slashItems.find((i) => i.id === id)
      expect(item, `${id} 应存在`).toBeDefined()
      expect(item!.group).toBe('callout')
      expect(item!.label).toBeTruthy()
    }
  })

  it('callout 组排在基础块之后、插入之前', () => {
    expect(SLASH_GROUP_ORDER).toEqual(['heading', 'list', 'block', 'callout', 'insert'])
    expect(SLASH_GROUP_LABELS.callout).toBe('提示块')
  })

  it('新增别名精确命中，不与既有别名撞车', () => {
    const ids = (q: string) => filterSlashItems(slashItems, q).map((i) => i.id)
    expect(ids('ts')).toEqual(['callout-note'])
    expect(ids('jy')).toEqual(['callout-tip'])
    expect(ids('zy')).toEqual(['callout-important'])
    expect(ids('jg')).toEqual(['callout-warning'])
    expect(ids('caution')).toEqual(['callout-caution'])
    // 「危险」刻意不给 wx —— 否则会与「无序列表」的 wxlb 歧义命中
    expect(ids('wx')).toEqual(['bullet'])
  })
})
```

`tests/slash-items.test.ts` 顶部的 import 需要补上 `SLASH_GROUP_LABELS`：

```ts
import {
  SLASH_GROUP_LABELS,
  SLASH_GROUP_ORDER,
  filterSlashItems,
  groupSlashItems,
  slashItems,
  type SlashItemMeta
} from '../src/renderer/src/editor/slashItems'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/slash-items.test.ts`
Expected: FAIL —— `callout` 组与 5 个条目都不存在

- [ ] **Step 3: 加组与条目**

`src/renderer/src/editor/slashItems.ts`：

```ts
// 组类型与顺序、标题
export type SlashGroup = 'heading' | 'list' | 'block' | 'callout' | 'insert'

export const SLASH_GROUP_ORDER: SlashGroup[] = ['heading', 'list', 'block', 'callout', 'insert']

export const SLASH_GROUP_LABELS: Record<SlashGroup, string> = {
  heading: '标题',
  list: '列表',
  block: '基础块',
  callout: '提示块',
  insert: '插入'
}
```

在 `slashItems` 数组里、`id: 'quote'` 那项**之前**插入 5 项（让它们紧跟基础块之后、插入组之前）：

```ts
  {
    id: 'callout-note',
    group: 'callout',
    icon: 'ⓘ',
    label: '提示',
    tooltip: '提示块：值得注意的信息',
    keywords: ['note', 'alert', '提示', 'ts']
  },
  {
    id: 'callout-tip',
    group: 'callout',
    icon: '✦',
    label: '建议',
    tooltip: '提示块：有用的建议',
    keywords: ['tip', '建议', 'jy']
  },
  {
    id: 'callout-important',
    group: 'callout',
    icon: '❗',
    label: '重要',
    tooltip: '提示块：必须知道的信息',
    keywords: ['important', '重要', 'zy']
  },
  {
    id: 'callout-warning',
    group: 'callout',
    icon: '⚠',
    label: '警告',
    tooltip: '提示块：需要注意的风险',
    keywords: ['warning', '警告', 'jg']
  },
  {
    id: 'callout-caution',
    group: 'callout',
    icon: '⛔',
    label: '危险',
    tooltip: '提示块：可能导致问题或损失',
    keywords: ['caution', '危险']
  },
```

- [ ] **Step 4: 接上动作**

`src/renderer/src/editor/slashMenu.ts`：

```ts
// import 区补上
import { calloutMarkerText, type CalloutType } from '@shared/callout'
```

在 `actions` 对象里加一个工厂（放在 `text: toParagraph,` 之后）：

```ts
      // 提示块：插一个「标记独占首段 + 空内容段」的引用块，光标落在内容段
      ...Object.fromEntries(
        CALLOUTS.map((c) => [
          `callout-${c.slug}`,
          () => {
            if (!view) return
            const { schema } = view.state
            const marker = schema.nodes.paragraph.create(
              null,
              schema.text(calloutMarkerText(c.type))
            )
            const body = schema.nodes.paragraph.create()
            replaceBlock(schema.nodes.blockquote.create(null, [marker, body]))
          }
        ])
      ),
```

同样在 import 区补上 `CALLOUTS`：

```ts
import { CALLOUTS, calloutMarkerText } from '@shared/callout'
```

（`replaceBlock` 会把光标放到新块内容的末尾，对 callout 而言正好落在空的内容段里，可直接开始写。）

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/slash-items.test.ts`
Expected: PASS（既有用例 + 新增 3 个）

- [ ] **Step 6: 全量回归 + 手动验证 + 提交**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: 全绿

手动验证：段落开头打 `/` → 输入 `jg` 或 `警告` → 回车，确认插入的是「警告」样式的提示块，且光标在内容段可直接打字。

```bash
git add src/renderer/src/editor/slashItems.ts src/renderer/src/editor/slashMenu.ts tests/slash-items.test.ts
git commit -m "feat: 斜杠面板新增提示块组（5 种 callout）"
```

---

## Task 6: TOC 占位符判定与目录树（纯函数）

**Files:**

- Create: `src/shared/toc.ts`
- Create: `src/renderer/src/editor/tocHeadings.ts`
- Test: `tests/toc-headings.test.ts`

**Interfaces:**

- Consumes: 无
- Produces: `TOC_MARKER`、`isTocParagraph(text): boolean`、`TocEntry`、`TocTreeNode<T>`、`buildTocTree<T>(entries)`、`HeadingEntry`、`collectHeadings(doc)`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/toc-headings.test.ts
import { describe, expect, it } from 'vitest'
import { TOC_MARKER, buildTocTree, isTocParagraph } from '../src/shared/toc'
import { collectHeadings } from '../src/renderer/src/editor/tocHeadings'

describe('isTocParagraph', () => {
  it('只认整段恰为 [TOC]', () => {
    expect(isTocParagraph('[TOC]')).toBe(true)
    expect(isTocParagraph('  [TOC]  ')).toBe(true)
    expect(isTocParagraph('[toc]')).toBe(true)
  })

  it('夹着别的文字不算', () => {
    expect(isTocParagraph('见 [TOC] 一节')).toBe(false)
    expect(isTocParagraph('[TOC] 目录')).toBe(false)
    expect(isTocParagraph('')).toBe(false)
  })

  it('写入用大写常量', () => {
    expect(TOC_MARKER).toBe('[TOC]')
  })
})

describe('buildTocTree', () => {
  it('按层级成树，缺级不留空层', () => {
    const tree = buildTocTree([
      { level: 1, text: 'a' },
      { level: 3, text: 'b' },
      { level: 2, text: 'c' },
      { level: 1, text: 'd' }
    ])
    expect(tree.map((n) => n.text)).toEqual(['a', 'd'])
    expect(tree[0].children.map((n) => n.text)).toEqual(['b', 'c'])
    expect(tree[0].children[0].children).toEqual([])
  })

  it('同层并列', () => {
    const tree = buildTocTree([
      { level: 2, text: 'a' },
      { level: 2, text: 'b' }
    ])
    expect(tree.map((n) => n.text)).toEqual(['a', 'b'])
    expect(tree[0].children).toEqual([])
  })

  it('空输入返回空数组', () => {
    expect(buildTocTree([])).toEqual([])
  })
})

describe('collectHeadings', () => {
  const heading = (level: number, text: string): any => ({
    type: { name: 'heading' },
    attrs: { level },
    textContent: text,
    nodeSize: text.length + 2
  })

  function fakeDoc(nodes: any[]) {
    return {
      descendants(cb: (n: any, pos: number) => boolean | void) {
        let pos = 0
        for (const n of nodes) {
          cb(n, pos)
          pos += n.nodeSize
        }
      }
    } as never
  }

  it('按文档顺序收集标题与层级，忽略非标题', () => {
    const doc = fakeDoc([
      heading(1, '一'),
      { type: { name: 'paragraph' }, attrs: {}, textContent: '正文', nodeSize: 6 },
      heading(3, '二')
    ])
    expect(collectHeadings(doc)).toEqual([
      { level: 1, text: '一' },
      { level: 3, text: '二' }
    ])
  })

  it('文本取 textContent —— 行内标记已被剥掉（Review Focus #2）', () => {
    const doc = fakeDoc([heading(2, '用 code 的标题')])
    expect(collectHeadings(doc)[0].text).toBe('用 code 的标题')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/toc-headings.test.ts`
Expected: FAIL —— 两个模块都不存在

- [ ] **Step 3: 实现**

```ts
// src/shared/toc.ts
/** TOC 占位符的共用规则：编辑器与导出都要用，放 shared 保证两边一致。 */

/** 写入文档时统一用这个写法 */
export const TOC_MARKER = '[TOC]'

/**
 * 整段文本是否为 TOC 占位符（trim 后、大小写不敏感）。
 * 注意：**是否在根层**由调用方判断 —— 引用内 / 列表项内的 `> [TOC]`、`- [TOC]`
 * 不算目录，本函数只看文本。
 */
export function isTocParagraph(text: string): boolean {
  return text.trim().toLowerCase() === TOC_MARKER.toLowerCase()
}

export interface TocEntry {
  level: number
  text: string
}

export type TocTreeNode<T> = T & { children: TocTreeNode<T>[] }

/**
 * 按层级把标题序列组织成树。
 * 只比较层级大小，因此 h1 直接跳到 h3 会直接嵌套，**不会产生空层**。
 */
export function buildTocTree<T extends { level: number }>(entries: readonly T[]): TocTreeNode<T>[] {
  const roots: TocTreeNode<T>[] = []
  const stack: TocTreeNode<T>[] = []
  for (const entry of entries) {
    const node = { ...entry, children: [] } as TocTreeNode<T>
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return roots
}
```

```ts
// src/renderer/src/editor/tocHeadings.ts
export interface HeadingEntry {
  level: number
  text: string
}

/** collectHeadings 只需要文档这几个能力，便于用伪造对象单测 */
export interface HeadingDocLike {
  descendants(cb: (node: HeadingNodeLike, pos: number) => boolean | void): void
}
export interface HeadingNodeLike {
  type: { name: string }
  attrs: Record<string, unknown>
  textContent: string
}

/**
 * 文档里所有标题，按文档顺序。
 * 口径与侧栏大纲一致：**包含嵌在引用里的标题**（如 `> # 标题`）。
 */
export function collectHeadings(doc: HeadingDocLike): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  doc.descendants((node) => {
    if (node.type.name !== 'heading') return true
    const level = Number(node.attrs.level ?? 1)
    headings.push({ level, text: node.textContent })
    return false
  })
  return headings
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/toc-headings.test.ts`
Expected: PASS（8 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/shared/toc.ts src/renderer/src/editor/tocHeadings.ts tests/toc-headings.test.ts
git commit -m "feat: TOC 占位符判定与目录树构建（纯函数）"
```

---

## Task 7: 导出侧给标题生成锚点 id

**Files:**

- Create: `src/main/modules/export/headingIds.ts`
- Test: `tests/heading-ids.test.ts`

**Interfaces:**

- Consumes: `HastNode`（Task 2 已补 `value`）
- Produces: `hastText(node): string`、`slugifyHeading(text): string`、`addHeadingIds(tree): void`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/heading-ids.test.ts
import { describe, expect, it } from 'vitest'
import { addHeadingIds, hastText, slugifyHeading } from '../src/main/modules/export/headingIds'
import type { HastNode } from '../src/main/modules/export/ensureCodeClass'

const h = (tagName: string, ...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName,
  children
})
const text = (value: string): HastNode => ({ type: 'text', value })
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

describe('hastText', () => {
  it('递归拼接元素与文本', () => {
    expect(hastText(h('h2', text('用 '), h('code', text('code')), text(' 的标题')))).toBe(
      '用 code 的标题'
    )
  })

  it('带行内标记的标题取到纯文本，与编辑侧口径一致（Review Focus #2）', () => {
    // 编辑侧 collectHeadings 读 ProseMirror 的 textContent，同样不含标记；
    // 两边都得到 '用 code 的标题'，目录文本与 slug 才不会分叉
    const heading = h('h2', text('用 '), h('code', text('code')), text(' 的标题'))
    expect(hastText(heading)).toBe('用 code 的标题')
    expect(slugifyHeading(hastText(heading))).toBe('用-code-的标题')
  })
})

describe('slugifyHeading', () => {
  it('保留中文与字母数字，去标点，空白转连字符', () => {
    expect(slugifyHeading('第一章 概述')).toBe('第一章-概述')
    expect(slugifyHeading('Hello World!')).toBe('hello-world')
    expect(slugifyHeading('a/b:c')).toBe('a-b-c')
  })

  it('折叠连续连字符并去掉首尾连字符', () => {
    expect(slugifyHeading('a  --  b')).toBe('a-b')
    expect(slugifyHeading(' 空格 ')).toBe('空格')
  })

  it('只有 emoji / 符号时回落 section（Review Focus #3）', () => {
    expect(slugifyHeading('!!!')).toBe('section')
    expect(slugifyHeading('😀')).toBe('section')
    expect(slugifyHeading('')).toBe('section')
  })
})

describe('addHeadingIds', () => {
  it('给 h1–h6 加 id，其余元素不动', () => {
    const p: HastNode = { type: 'element', tagName: 'p', children: [text('x')] }
    const tree = root(h('h1', text('标题')), p)
    addHeadingIds(tree)
    expect(tree.children![0].properties?.id).toBe('标题')
    expect(p.properties).toBeUndefined()
  })

  it('重名追加 -1 / -2，第一个不加后缀', () => {
    const tree = root(h('h2', text('同名')), h('h2', text('同名')), h('h2', text('同名')))
    addHeadingIds(tree)
    expect(tree.children!.map((c) => c.properties?.id)).toEqual(['同名', '同名-1', '同名-2'])
  })

  it('嵌套在引用里的标题也加 id', () => {
    const tree = root(h('blockquote', h('h3', text('引用里的标题'))))
    addHeadingIds(tree)
    expect(tree.children![0].children![0].properties?.id).toBe('引用里的标题')
  })

  it('只为 h1–h6 加 id，h7 不管', () => {
    const tree = root(h('h7', text('x')))
    addHeadingIds(tree)
    expect(tree.children![0].properties?.id).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/heading-ids.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/main/modules/export/headingIds.ts
import type { HastNode } from './ensureCodeClass'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** 元素的纯文本（递归拼接 h1–h6 里的行内标记，如 <code>） */
export function hastText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

/**
 * 标题文本 → 锚点 id：保留中文与字母数字，其余转 `-`，折叠连续 `-`，去首尾 `-`，
 * 小写化；结果为空（只有 emoji / 符号）时回落 `section`。
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'section'
}

/**
 * 给所有 h1–h6 加 id（同名的追加 `-1`/`-2`）。
 * 只写 id 属性，不改动层级、文本或其它属性。
 */
export function addHeadingIds(node: HastNode | undefined): void {
  if (!node?.children) return

  const used = new Set<string>()
  const assign = (el: HastNode): void => {
    const base = slugifyHeading(hastText(el))
    let id = base
    let n = 0
    while (used.has(id)) id = `${base}-${++n}`
    used.add(id)
    el.properties = { ...el.properties, id }
  }

  // 先按文档顺序扫一遍所有标题（含嵌套在引用里的）
  const headings: HastNode[] = []
  const scan = (n: HastNode): void => {
    if (n.type === 'element' && n.tagName && HEADING_TAGS.has(n.tagName)) headings.push(n)
    for (const child of n.children ?? []) scan(child)
  }
  scan(node)

  for (const el of headings) assign(el)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/heading-ids.test.ts`
Expected: PASS（9 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/modules/export/headingIds.ts tests/heading-ids.test.ts
git commit -m "feat: 导出侧给标题生成锚点 id（TOC 链接的前提）"
```

---

## Task 8: 导出侧把 `[TOC]` 换成嵌套目录

**Files:**

- Create: `src/main/modules/export/tocBlocks.ts`
- Test: `tests/toc-blocks.test.ts`

**Interfaces:**

- Consumes: `isTocParagraph`、`buildTocTree`（Task 6）；`hastText`（Task 7）
- Produces: `collectHastHeadings(tree): TocHtmlEntry[]`、`replaceTocPlaceholder(tree, entries): number`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/toc-blocks.test.ts
import { describe, expect, it } from 'vitest'
import { collectHastHeadings, replaceTocPlaceholder } from '../src/main/modules/export/tocBlocks'
import { addHeadingIds } from '../src/main/modules/export/headingIds'
import type { HastNode } from '../src/main/modules/export/ensureCodeClass'

const text = (value: string): HastNode => ({ type: 'text', value })
const el = (tagName: string, ...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName,
  children
})
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

/** 收集出来的第一个 nav 里的链接文本 */
function firstNavLinks(tree: HastNode): string[] {
  const nav = tree.children!.find((c) => c.tagName === 'nav')!
  const links: string[] = []
  const walk = (n: HastNode): void => {
    if (n.tagName === 'a') links.push(hastTextOf(n))
    for (const c of n.children ?? []) walk(c)
  }
  walk(nav)
  return links
}
const hastTextOf = (n: HastNode): string =>
  n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(hastTextOf).join('')

describe('collectHastHeadings', () => {
  it('按文档顺序收集 h1–h6，带 id 与文本', () => {
    const tree = root(el('h1', text('一')), el('p', text('正文')), el('h3', text('二')))
    addHeadingIds(tree)
    expect(collectHastHeadings(tree)).toEqual([
      { level: 1, text: '一', id: '一' },
      { level: 3, text: '二', id: '二' }
    ])
  })
})

describe('replaceTocPlaceholder', () => {
  it('把根层 [TOC] 段落换成 nav 嵌套列表', () => {
    const tree = root(
      el('p', text('[TOC]')),
      el('h1', text('一')),
      el('h2', text('二')),
      el('h3', text('三'))
    )
    addHeadingIds(tree)
    const entries = collectHastHeadings(tree)
    expect(replaceTocPlaceholder(tree, entries)).toBe(1)

    const nav = tree.children![0]
    expect(nav.tagName).toBe('nav')
    expect(nav.properties?.className).toEqual(['toc'])
    expect(firstNavLinks(tree)).toEqual(['一', '二', '三'])
    // h3 嵌在 h2 的 li 里
    const ul = nav.children![0]
    const firstLi = ul.children![0]
    expect(firstLi.children!.some((c) => c.tagName === 'ul')).toBe(true)
  })

  it('非根层的 [TOC] 不转换（Review Focus #1）', () => {
    const tree = root(el('blockquote', el('p', text('[TOC]'))), el('h1', text('一')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(0)
    expect(tree.children![0].tagName).toBe('blockquote')
  })

  it('段落里夹着别的文字不转换', () => {
    const tree = root(el('p', text('见 [TOC] 一节')), el('h1', text('一')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(0)
  })

  it('无标题时 nav 内为空', () => {
    const tree = root(el('p', text('[TOC]')))
    addHeadingIds(tree)
    expect(replaceTocPlaceholder(tree, collectHastHeadings(tree))).toBe(1)
    const nav = tree.children![0]
    expect(nav.tagName).toBe('nav')
    expect(nav.children).toEqual([])
  })

  it('链接指向标题 id', () => {
    const tree = root(el('p', text('[TOC]')), el('h2', text('同名')), el('h2', text('同名')))
    addHeadingIds(tree)
    replaceTocPlaceholder(tree, collectHastHeadings(tree))
    const nav = tree.children![0]
    const hrefs: string[] = []
    const walk = (n: HastNode): void => {
      if (n.tagName === 'a') hrefs.push(String(n.properties?.href))
      for (const c of n.children ?? []) walk(c)
    }
    walk(nav)
    expect(hrefs).toEqual(['#同名', '#同名-1'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/toc-blocks.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现**

```ts
// src/main/modules/export/tocBlocks.ts
import { buildTocTree, isTocParagraph } from '@shared/toc'
import { hastText } from './headingIds'
import type { HastNode } from './ensureCodeClass'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

export interface TocHtmlEntry {
  level: number
  text: string
  id: string
}

/** 按文档顺序收集 h1–h6（含嵌在引用里的），要求已经跑过 addHeadingIds */
export function collectHastHeadings(node: HastNode | undefined): TocHtmlEntry[] {
  const entries: TocHtmlEntry[] = []
  const walk = (n: HastNode): void => {
    if (n.type === 'element' && n.tagName && HEADING_TAGS.has(n.tagName)) {
      entries.push({
        level: Number(n.tagName.slice(1)),
        text: hastText(n),
        id: String(n.properties?.id ?? '')
      })
    }
    for (const child of n.children ?? []) walk(child)
  }
  walk(node ?? { type: 'root' })
  return entries
}

function anchor(entry: TocHtmlEntry): HastNode {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href: `#${entry.id}` },
    children: [{ type: 'text', value: entry.text }]
  }
}

function listFrom(nodes: ReturnType<typeof buildTocTree<TocHtmlEntry>>): HastNode {
  return {
    type: 'element',
    tagName: 'ul',
    children: nodes.map((n) => ({
      type: 'element' as const,
      tagName: 'li',
      children: n.children.length > 0 ? [anchor(n), listFrom(n.children)] : [anchor(n)]
    }))
  }
}

/**
 * 把**根层**文本恰为 `[TOC]` 的 `<p>` 换成 `<nav class="toc">` 嵌套列表。
 * 返回替换的个数。非根层（引用内 / 列表项内）的 `[TOC]` 保持普通文本。
 */
export function replaceTocPlaceholder(tree: HastNode, entries: readonly TocHtmlEntry[]): number {
  if (!tree.children) return 0

  const nav: HastNode = {
    type: 'element',
    tagName: 'nav',
    properties: { className: ['toc'] },
    children: entries.length > 0 ? [listFrom(buildTocTree(entries))] : []
  }

  let replaced = 0
  tree.children = tree.children.map((child) => {
    if (child.type !== 'element' || child.tagName !== 'p') return child
    if (!isTocParagraph(hastText(child))) return child
    replaced++
    return nav
  })
  return replaced
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/toc-blocks.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/modules/export/tocBlocks.ts tests/toc-blocks.test.ts
git commit -m "feat: 导出侧把 [TOC] 占位符换成嵌套目录"
```

---

## Task 9: 把 TOC 挂进导出管线 + 导出样式

**Files:**

- Modify: `src/main/modules/export/render.ts`
- Modify: `src/main/modules/export/export.css`（末尾追加）
- Test: `tests/toc-pipeline.test.ts`

**Interfaces:**

- Consumes: `addHeadingIds`（Task 7）、`collectHastHeadings` / `replaceTocPlaceholder`（Task 8）
- Produces: `renderMarkdownToHtml` 的输出含 `<nav class="toc">` 且标题带 `id`

- [ ] **Step 1: 写失败的集成测试**

```ts
// tests/toc-pipeline.test.ts
import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '../src/main/modules/export/render'

describe('导出管线的 TOC', () => {
  it('[TOC] 变成 nav，标题带 id，链接指过去', async () => {
    const html = await renderMarkdownToHtml('[TOC]\n\n# 第一章\n\n## 小节\n')
    expect(html).toContain('<nav class="toc">')
    expect(html).toContain('id="第一章"')
    expect(html).toContain('id="小节"')
    expect(html).toContain('href="#第一章"')
    expect(html).toContain('href="#小节"')
    expect(html).not.toContain('[TOC]')
  })

  it('重名标题的链接与 id 一致', async () => {
    const html = await renderMarkdownToHtml('[TOC]\n\n## 同名\n\n## 同名\n')
    expect(html).toContain('id="同名"')
    expect(html).toContain('id="同名-1"')
    expect(html).toContain('href="#同名-1"')
  })

  it('无 [TOC] 的文档：标题仍会带 id，但没有 nav', async () => {
    const html = await renderMarkdownToHtml('# 只有标题\n')
    expect(html).toContain('id="只有标题"')
    expect(html).not.toContain('<nav')
  })

  it('引用里的 [TOC] 不变目录（Review Focus #1）', async () => {
    const html = await renderMarkdownToHtml('> [TOC]\n')
    expect(html).not.toContain('<nav class="toc">')
    expect(html).toContain('[TOC]')
  })

  it('无标题时目录为空但不报错', async () => {
    const html = await renderMarkdownToHtml('[TOC]\n\n正文\n')
    expect(html).toContain('<nav class="toc"></nav>')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/toc-pipeline.test.ts`
Expected: FAIL —— 没有 `nav`、标题也没有 `id`

- [ ] **Step 3: 挂上两个插件**

`src/main/modules/export/render.ts`：加 import 与两个包装函数，**顺序必须是「先加 id、再替换占位符」**。

```ts
// import 区
import { addHeadingIds } from './headingIds'
import { collectHastHeadings, replaceTocPlaceholder } from './tocBlocks'

// 包装函数
/**
 * 给标题加锚点 id。必须在 TOC 替换之前跑 —— 目录链接要用到这些 id。
 * 注意：这会让**所有**导出产物的标题带上 id（spec §5.3 已记录的唯一既有产物变化）。
 */
function rehypeHeadingIds() {
  return (tree: HastNode): void => addHeadingIds(tree)
}

/** 把根层 `[TOC]` 段落换成 nav.toc 嵌套列表 */
function rehypeToc() {
  return (tree: HastNode): void => {
    replaceTocPlaceholder(tree, collectHastHeadings(tree))
  }
}

// 管线（callout 之后；两者都只需在 stringify 之前）
  .use(rehypeEnsureHljsClass)
  .use(rehypeCallouts)
  .use(rehypeHeadingIds)
  .use(rehypeToc)
  .use(rehypeKatex)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/toc-pipeline.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 加导出样式**

追加到 `src/main/modules/export/export.css` 末尾：

```css
/* 文档内目录 */
.toc {
  margin: 1.25em 0;
  padding: 0.75em 1em;
  border: 1px solid var(--ms-border, #e4e7eb);
  border-radius: 6px;
  background: var(--ms-panel-bg, #f6f8fa);
}
.toc ul {
  margin: 0;
  padding-left: 1.25em;
  list-style: none;
}
.toc > ul {
  padding-left: 0;
}
.toc li {
  margin: 0.25em 0;
}
.toc a {
  color: var(--ms-text, #24292f);
  text-decoration: none;
}
.toc a:hover {
  color: var(--ms-accent, #0969da);
  text-decoration: underline;
}
```

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿（特别是既有导出测试：标题只多了 `id`，其它断言不受影响）

```bash
git add src/main/modules/export/render.ts src/main/modules/export/export.css tests/toc-pipeline.test.ts
git commit -m "feat: 导出管线挂上标题锚点与 TOC 替换"
```

---

## Task 10: 编辑器里的 TOC 渲染

**Files:**

- Create: `src/renderer/src/editor/toc.ts`
- Modify: `src/renderer/src/editor/milkdownEditor.ts`（`.use(...)` 一行）
- Modify: `src/renderer/src/styles/theme.css`（末尾追加）
- Test: `tests/toc-decorations.test.ts`

**Interfaces:**

- Consumes: `isTocParagraph`（Task 6）、`collectHeadings` / `HeadingEntry`（Task 6）
- Produces: `TocBlockLike`、`TocRange`、`collectTocTargets(blocks): TocRange[]`（纯函数）、`tocPlugin`（Milkdown 插件）

- [ ] **Step 1: 写失败的测试**

```ts
// tests/toc-decorations.test.ts
import { describe, expect, it } from 'vitest'
import { collectTocTargets, type TocBlockLike } from '../src/renderer/src/editor/toc'

const para = (text: string): TocBlockLike => ({
  type: { name: 'paragraph' },
  textContent: text,
  nodeSize: text.length + 2
})
const code = (text: string): TocBlockLike => ({
  type: { name: 'code_block' },
  textContent: text,
  nodeSize: text.length + 2
})

describe('collectTocTargets', () => {
  it('收集根层 [TOC] 段落的序号、位置与长度', () => {
    const blocks = [para('正文'), para('[TOC]'), para('后面')]
    // '正文' nodeSize = 4 → 第二块 pos = 4；'[TOC]' nodeSize = 7 → to = 11
    expect(collectTocTargets(blocks)).toEqual([{ index: 1, pos: 4, to: 11 }])
  })

  it('大小写与前后空白容错', () => {
    expect(collectTocTargets([para(' [toc] ')])).toEqual([{ index: 0, pos: 0, to: 9 }])
  })

  it('夹着别的文字不算', () => {
    expect(collectTocTargets([para('见 [TOC] 一节')])).toEqual([])
  })

  it('非段落不算（如代码块里出现 [TOC]）', () => {
    expect(collectTocTargets([code('[TOC]')])).toEqual([])
  })

  it('多个 [TOC] 都收集', () => {
    const blocks = [para('[TOC]'), para('x'), para('[TOC]')]
    expect(collectTocTargets(blocks).map((t) => t.index)).toEqual([0, 2])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/toc-decorations.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现插件**

```ts
// src/renderer/src/editor/toc.ts
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { buildTocTree, isTocParagraph } from '@shared/toc'
import { collectHeadings, type HeadingEntry } from './tocHeadings'

/** collectTocTargets 只需要块级节点的这几项，便于用普通对象单测 */
export interface TocBlockLike {
  type: { name: string }
  textContent: string
  nodeSize: number
}

export interface TocRange {
  /** 该块在顶层块数组里的下标 */
  index: number
  pos: number
  to: number
}

/**
 * 从**顶层块**里挑出文本恰为 [TOC] 的段落。
 *
 * 只接受顶层块数组，所以引用内 / 列表项内的 `[TOC]` 天然被排除（Review Focus #1）——
 * 调用方用 ProseMirror 的 `doc.forEach` 取顶层子节点，它只给顶层块。
 */
export function collectTocTargets(blocks: readonly TocBlockLike[]): TocRange[] {
  const targets: TocRange[] = []
  let pos = 0
  blocks.forEach((block, index) => {
    if (block.type.name === 'paragraph' && isTocParagraph(block.textContent)) {
      targets.push({ index, pos, to: pos + block.nodeSize })
    }
    pos += block.nodeSize
  })
  return targets
}

/** 取真实 doc 的顶层子节点（ProseMirror 的 forEach 只给顶层，正合要求） */
function topLevelBlocks(doc: PMNode): TocBlockLike[] {
  const blocks: TocBlockLike[] = []
  doc.forEach((node) => {
    blocks.push(node)
  })
  return blocks
}

interface TocState {
  deco: DecorationSet
  key: string
}

function buildState(
  doc: PMNode,
  selection: { from: number; to: number },
  getView: () => EditorView | null
): TocState {
  const targets = collectTocTargets(topLevelBlocks(doc))
  const headings = collectHeadings(doc)
  const decos: Decoration[] = []
  const parts: string[] = []

  for (const target of targets) {
    const editing = selection.from >= target.pos && selection.to <= target.to
    parts.push(`${target.pos}:${editing ? 1 : 0}`)

    const classes = ['ms-toc']
    if (editing) classes.push('is-editing')
    decos.push(Decoration.node(target.pos, target.to, { class: classes.join(' ') }))

    if (!editing) {
      decos.push(
        Decoration.widget(target.pos, () => buildTocDom(headings, getView), {
          side: -1,
          key: `ms-toc-widget-${target.pos}-${signature(headings)}`
        })
      )
    }
  }

  return {
    deco: DecorationSet.create(doc, decos),
    key: parts.join('|') + '#' + signature(headings)
  }
}

/** 标题序列签名：变了才需要重建 widget DOM */
function signature(headings: readonly HeadingEntry[]): string {
  return headings.map((h) => `${h.level}:${h.text}`).join('|')
}

/** 目录 DOM；点击条目滚动到第 N 个标题（与 scrollToHeading 同一套做法） */
function buildTocDom(
  headings: readonly HeadingEntry[],
  getView: () => EditorView | null
): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'ms-toc-list'
  nav.setAttribute('contenteditable', 'false')

  if (headings.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'ms-toc-empty'
    empty.textContent = '暂无标题'
    nav.appendChild(empty)
    return nav
  }

  // 扁平顺序 = 文档顺序，正好对应 querySelectorAll('h1..h6') 的下标
  const indexOf = new Map<HeadingEntry, number>()
  headings.forEach((h, i) => indexOf.set(h, i))

  const render = (nodes: ReturnType<typeof buildTocTree<HeadingEntry>>): HTMLUListElement => {
    const ul = document.createElement('ul')
    for (const node of nodes) {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.href = '#'
      a.textContent = node.text
      a.addEventListener('mousedown', (e) => e.preventDefault())
      a.addEventListener('click', (e) => {
        e.preventDefault()
        const index = indexOf.get(node) ?? -1
        const view = getView()
        if (index < 0 || !view) return
        view.dom
          .querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')
          [index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      li.appendChild(a)
      if (node.children.length > 0) li.appendChild(render(node.children))
      ul.appendChild(li)
    }
    return ul
  }

  nav.appendChild(render(buildTocTree(headings)))
  return nav
}

export const tocPlugin = $prose(() => {
  const key = new PluginKey<TocState>('MS_TOC')
  // init 时还没有 view；widget 的点击回调在**点击那一刻**才取它，
  // 所以传 getter 而不是按值捕获 —— 否则目录永远点不动
  let view: EditorView | null = null
  const getView = () => view

  return new Plugin({
    key,
    state: {
      init: (_config, state) => buildState(state.doc, state.selection, getView),
      apply: (tr, prev, _old, next) => {
        if (!tr.docChanged && !tr.selectionSet) return prev
        const built = buildState(next.doc, next.selection, getView)
        // 标题与编辑态都没变就复用旧装饰集，避免每次按键都重建 widget DOM
        return built.key === prev.key ? prev : built
      }
    },
    view: (v) => {
      view = v
      return {
        destroy: () => {
          view = null
        }
      }
    },
    props: {
      decorations: (state) => key.getState(state)?.deco ?? null
    }
  })
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/toc-decorations.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 注册进编辑器**

`src/renderer/src/editor/milkdownEditor.ts`：

```ts
import { tocPlugin } from './toc'
// ...
    .use(calloutPlugin)
    .use(tocPlugin)
    .use(mermaidPlugins)
```

- [ ] **Step 6: 加编辑器样式**

追加到 `src/renderer/src/styles/theme.css` 末尾：

```css
/* 文档内目录（[TOC] 段落 + widget 渲染的列表） */
.milkdown .ms-toc:not(.is-editing) {
  display: none; /* 渲染层：原文让位给 widget */
}
.milkdown .ms-toc-list {
  margin: 1em 0;
  padding: 0.75em 1em;
  border: 1px solid var(--ms-border);
  border-radius: 6px;
  background: var(--ms-panel-bg);
  user-select: none;
}
.milkdown .ms-toc-list ul {
  margin: 0;
  padding-left: 1.25em;
  list-style: none;
}
.milkdown .ms-toc-list > ul {
  padding-left: 0;
}
.milkdown .ms-toc-list li {
  margin: 0.25em 0;
}
.milkdown .ms-toc-list a {
  color: var(--ms-text);
  text-decoration: none;
  cursor: pointer;
}
.milkdown .ms-toc-list a:hover {
  color: var(--ms-accent);
  text-decoration: underline;
}
.milkdown .ms-toc-empty {
  color: var(--ms-text-secondary);
  font-style: italic;
}
```

- [ ] **Step 7: 全量回归 + 在真实 app 里验证**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: 全绿

手动验证（`npm run dev`，或用 Electron 驱动夹具）：

1. 新建文档，输入 `# 第一章`、`## 小节`、`# 第二章`，再在开头加一段 `[TOC]` → 应该显示成带层级缩进的目录列表，`[TOC]` 原文不可见。
2. 点目录里的「小节」→ 视图滚动到该标题。
3. 新增一个 `## 新小节` → 目录自动多出一项。
4. 光标点进 `[TOC]` 那一段 → 列表消失、露出 `[TOC]`；移开光标 → 恢复成列表。
5. **回归**：确认普通段落的外观与行为没变（TOC 用的是装饰，段落 DOM 不应有任何变化）。
6. 明暗主题下各看一眼。

- [ ] **Step 8: 提交**

```bash
git add src/renderer/src/editor/toc.ts src/renderer/src/editor/milkdownEditor.ts src/renderer/src/styles/theme.css tests/toc-decorations.test.ts
git commit -m "feat: 编辑器里把 [TOC] 渲染成可点击的目录"
```

---

## Task 11: 斜杠面板加「目录」项

**Files:**

- Modify: `src/renderer/src/editor/slashItems.ts`
- Modify: `src/renderer/src/editor/slashMenu.ts`
- Test: `tests/slash-items.test.ts`（追加）

**Interfaces:**

- Consumes: `TOC_MARKER`（Task 6）
- Produces: 面板里 `id` 为 `toc` 的一项

- [ ] **Step 1: 写失败的测试**

追加到 `tests/slash-items.test.ts` 末尾：

```ts
describe('目录面板项', () => {
  it('有一项 [TOC]，归在插入组', () => {
    const item = slashItems.find((i) => i.id === 'toc')
    expect(item, 'toc 项应存在').toBeDefined()
    expect(item!.label).toBe('目录')
    expect(item!.group).toBe('insert')
  })

  it('别名 ml / toc 精确命中', () => {
    const ids = (q: string) => filterSlashItems(slashItems, q).map((i) => i.id)
    expect(ids('ml')).toEqual(['toc'])
    expect(ids('toc')).toEqual(['toc'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/slash-items.test.ts`
Expected: FAIL —— `toc` 项不存在

- [ ] **Step 3: 加条目**

在 `src/renderer/src/editor/slashItems.ts` 的 `slashItems` 数组末尾（`image` 项之后）追加：

```ts
  {
    id: 'toc',
    group: 'insert',
    icon: '☰',
    label: '目录',
    tooltip: '插入文档目录（[TOC]）',
    // 刻意不放 'contents'：它内含 'ts'，会让查询 ts 同时命中「提示」，产生歧义
    keywords: ['toc', '目录', 'ml']
  }
```

- [ ] **Step 4: 接上动作**

`src/renderer/src/editor/slashMenu.ts`：

```ts
// import 区
import { TOC_MARKER } from '@shared/toc'
```

在 `actions` 里加一项（放在 `image:` 之后）：

```ts
// 目录：插一个内容为 [TOC] 的段落 + 一个空段落，光标落在空段落
toc: () => {
  if (!view) return
  const { state } = view
  const { $from } = state.selection
  const { schema } = state
  const tocPara = schema.nodes.paragraph.create(null, schema.text(TOC_MARKER))
  const after = schema.nodes.paragraph.create()
  const start = $from.before($from.depth)
  const end = $from.after($from.depth)
  const tr = state.tr.replaceWith(start, end, [tocPara, after])
  // tocPara.nodeSize 跳过整个段落，+1 进入空段落内部
  tr.setSelection(TextSelection.create(tr.doc, start + tocPara.nodeSize + 1))
  view.dispatch(tr)
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/slash-items.test.ts`
Expected: PASS

- [ ] **Step 6: 全量回归 + 手动验证 + 提交**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: 全绿

手动验证：段落开头打 `/` → 输入 `ml` 或 `目录` → 回车，确认插入目录且光标落在目录下方的空段落。

```bash
git add src/renderer/src/editor/slashItems.ts src/renderer/src/editor/slashMenu.ts tests/slash-items.test.ts
git commit -m "feat: 斜杠面板新增目录项"
```

---

## 完成标准

对照 spec §11 的 9 条验收标准逐条核对，特别是：

1. `/` → 「提示块」组 5 项都能插入对应类型的提示块，渲染出中文标题与配色。
2. 光标进入提示块 → 标题行消失、露出 `[!TYPE]`；改类型后样式立刻跟着变。
3. 普通引用块外观与行为完全不变。
4. 导出的 HTML 里提示块是 `<div class="callout callout-<slug>">` + `<p class="callout-title">`。
5. `/` →「目录」插入 `[TOC]`；标题增删后目录自动更新；点击条目可跳转。
6. 导出的 HTML 里 `[TOC]` 是 `<nav class="toc">`，链接指向标题 `id`。
7. 引用内 / 列表项内的 `[TOC]` 保持普通文本。
8. `npx vitest run`、`npm run typecheck`、`npm run lint`、`npm run build` 全绿。
