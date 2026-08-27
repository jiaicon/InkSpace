# Markdown Studio —— 子项目 A：编辑器引擎 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个隔离在稳定接口之后、可被文件层/知识库复用的 Markdown 编辑器引擎：WYSIWYG（Milkdown）+ 源码模式（CodeMirror 6）双引擎，Typora 式单一表面，支持 GFM + 数学 + Mermaid + 代码块。

**Architecture:** 所有逻辑集中在 renderer 的 `src/renderer/src/editor/`。核心是一个纯状态机 `createEditorController`（管理 markdown / 模式 / dirty 基线，node 可单测），两个 DOM 引擎适配器（Milkdown、CodeMirror）只负责「渲染 + 把用户编辑回调给 controller」，最后由 `Editor` React 组件接线并通过 `forwardRef` 暴露 `EditorHandle`。Milkdown/CodeMirror 类型不泄漏到模块外。

**Tech Stack:** React 18、TypeScript 5.5、Milkdown v7（`@milkdown/kit` + `@milkdown/plugin-math` + `@milkdown/plugin-diagram`）、CodeMirror 6、remark/remark-gfm、KaTeX、Mermaid、Vitest 2。

**Spec:** [2026-08-27-markdown-editor-engine-design.md](../specs/2026-08-27-markdown-editor-engine-design.md)

## Global Constraints

- 包管理器 pnpm；新增运行时依赖一律放 `dependencies`。
- 引擎隔离：Milkdown / CodeMirror / remark 只允许在 `src/renderer/src/editor/` 内 import，不得外泄其类型；对外仅通过 `editor/index.ts` 暴露 `Editor` 与 `editor/types.ts`。
- Markdown 字符串是唯一跨层数据；`onChange` 仅在用户编辑时触发，`initialMarkdown` 首次加载与外部 `setMarkdown` 均不触发。
- 代码风格沿用现有 renderer：单引号、TS strict、`@renderer` / `@shared` alias。
- 中文错误文案。
- 测试：Vitest 环境为 node（`tests/**/*.test.ts`），纯逻辑（controller / outline）走单测；DOM 相关（Milkdown / CodeMirror / Editor 组件）用 `pnpm typecheck:web` + `pnpm dev` 手动验证。

---

## 文件结构总览

```
src/renderer/src/editor/
├── types.ts            # EditorMode / OutlineNode / EditorProps / EditorHandle（对外契约）
├── controller.ts       # createEditorController：markdown/模式/dirty 纯状态机（可单测）
├── outline.ts          # parseOutline / buildAnchorId：标题→大纲（可单测）
├── milkdownEditor.ts   # Milkdown WYSIWYG 适配器（DOM）
├── codemirrorEditor.ts # CodeMirror 源码适配器（DOM）
├── Editor.tsx          # React 组件：接线 controller + 双引擎 + 模式切换 + 错误兜底
└── index.ts            # 对外导出
tests/
├── editor-controller.test.ts
└── outline.test.ts
```

---

### Task 1: 编辑器类型与控制器（纯状态机）

**Files:**
- Create: `src/renderer/src/editor/types.ts`
- Create: `src/renderer/src/editor/controller.ts`
- Test: `tests/editor-controller.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `type EditorMode = 'wysiwyg' | 'source'`
  - `interface OutlineNode { id: string; level: number; text: string }`
  - `interface EditorProps { initialMarkdown: string; onChange: (md: string) => void; onChangeDirty: (dirty: boolean) => void; onModeChange?: (mode: EditorMode) => void; onOutlineChange?: (outline: OutlineNode[]) => void }`
  - `interface EditorHandle { getMarkdown(): string; setMarkdown(md: string): void; markSaved(): void; getMode(): EditorMode; setMode(mode: EditorMode): void; focus(): void }`
  - `interface EditorController { getMarkdown(): string; setMarkdown(md: string): void; markSaved(): void; getMode(): EditorMode; setMode(mode: EditorMode): void; isDirty(): boolean; applyEdit(md: string): void }`
  - `function createEditorController(initialMarkdown: string, hooks: { onChange: (md: string) => void; onChangeDirty: (dirty: boolean) => void; onModeChange: (mode: EditorMode) => void }): EditorController`

- [ ] **Step 1: 写失败测试 `tests/editor-controller.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createEditorController } from '../src/renderer/src/editor/controller'

function makeHooks() {
  return { onChange: vi.fn(), onChangeDirty: vi.fn(), onModeChange: vi.fn() }
}

describe('createEditorController', () => {
  it('starts clean and not dirty', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    expect(c.getMarkdown()).toBe('# hi')
    expect(c.isDirty()).toBe(false)
  })

  it('marks dirty and fires onChange on edit', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# hello')
    expect(c.getMarkdown()).toBe('# hello')
    expect(c.isDirty()).toBe(true)
    expect(hooks.onChange).toHaveBeenCalledWith('# hello')
    expect(hooks.onChangeDirty).toHaveBeenCalledWith(true)
  })

  it('does not fire onChange for a no-op edit (initial re-serialize)', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# hi')
    expect(hooks.onChange).not.toHaveBeenCalled()
    expect(hooks.onChangeDirty).not.toHaveBeenCalled()
  })

  it('fires onChangeDirty(false) only on transition back to clean', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# hello')
    c.applyEdit('# hello again')
    expect(hooks.onChangeDirty).toHaveBeenCalledTimes(1)
    c.markSaved()
    expect(c.isDirty()).toBe(false)
    expect(hooks.onChangeDirty).toHaveBeenLastCalledWith(false)
  })

  it('setMarkdown resets baseline and does not fire onChange', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# changed')
    expect(c.isDirty()).toBe(true)
    c.setMarkdown('# other')
    expect(c.getMarkdown()).toBe('# other')
    expect(c.isDirty()).toBe(false)
    expect(hooks.onChange).not.toHaveBeenCalled()
    expect(hooks.onChangeDirty).toHaveBeenLastCalledWith(false)
  })

  it('switches mode and notifies', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.setMode('source')
    expect(c.getMode()).toBe('source')
    expect(hooks.onModeChange).toHaveBeenCalledWith('source')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/editor-controller.test.ts`
Expected: FAIL（`../src/renderer/src/editor/controller` 模块不存在）。

- [ ] **Step 3: 写 `src/renderer/src/editor/types.ts`**

```ts
export type EditorMode = 'wysiwyg' | 'source'

export interface OutlineNode {
  id: string
  level: number
  text: string
}

export interface EditorProps {
  initialMarkdown: string
  onChange: (md: string) => void
  onChangeDirty: (dirty: boolean) => void
  onModeChange?: (mode: EditorMode) => void
  onOutlineChange?: (outline: OutlineNode[]) => void
}

export interface EditorHandle {
  getMarkdown(): string
  setMarkdown(md: string): void
  markSaved(): void
  getMode(): EditorMode
  setMode(mode: EditorMode): void
  focus(): void
}
```

- [ ] **Step 4: 写 `src/renderer/src/editor/controller.ts`**

```ts
import type { EditorMode } from './types'

export interface EditorController {
  getMarkdown(): string
  setMarkdown(md: string): void
  markSaved(): void
  getMode(): EditorMode
  setMode(mode: EditorMode): void
  isDirty(): boolean
  applyEdit(md: string): void
}

export interface EditorControllerHooks {
  onChange: (md: string) => void
  onChangeDirty: (dirty: boolean) => void
  onModeChange: (mode: EditorMode) => void
}

export function createEditorController(
  initialMarkdown: string,
  hooks: EditorControllerHooks
): EditorController {
  let markdown = initialMarkdown
  let baseline = initialMarkdown
  let mode: EditorMode = 'wysiwyg'
  let dirty = false

  function setDirty(next: boolean): void {
    if (next !== dirty) {
      dirty = next
      hooks.onChangeDirty(dirty)
    }
  }

  return {
    getMarkdown: () => markdown,
    setMarkdown: (md) => {
      markdown = md
      baseline = md
      setDirty(false)
    },
    markSaved: () => {
      baseline = markdown
      setDirty(false)
    },
    getMode: () => mode,
    setMode: (m) => {
      if (m !== mode) {
        mode = m
        hooks.onModeChange(m)
      }
    },
    isDirty: () => dirty,
    applyEdit: (md) => {
      if (md === markdown) return
      markdown = md
      setDirty(md !== baseline)
      hooks.onChange(md)
    }
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/editor-controller.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/editor/types.ts src/renderer/src/editor/controller.ts tests/editor-controller.test.ts
git commit -m "feat(editor): editor controller state machine and types"
```

---

### Task 2: 大纲解析（纯函数）

**Files:**
- Create: `src/renderer/src/editor/outline.ts`
- Test: `tests/outline.test.ts`

**Interfaces:**
- Consumes: `OutlineNode`（Task 1）。
- Produces:
  - `function buildAnchorId(index: number): string`（返回 `h-${index}`）
  - `function parseOutline(markdown: string): OutlineNode[]`

- [ ] **Step 1: 安装依赖**

Run: `pnpm add remark remark-gfm mdast-util-to-string unist-util-visit`

- [ ] **Step 2: 写失败测试 `tests/outline.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parseOutline } from '../src/renderer/src/editor/outline'

describe('parseOutline', () => {
  it('extracts headings with levels and positional ids', () => {
    const md = '# 标题一\n\n正文\n\n## 二级\n\n### 三级\n\n# 标题二\n'
    expect(parseOutline(md)).toEqual([
      { id: 'h-0', level: 1, text: '标题一' },
      { id: 'h-1', level: 2, text: '二级' },
      { id: 'h-2', level: 3, text: '三级' },
      { id: 'h-3', level: 1, text: '标题二' }
    ])
  })

  it('ignores headings inside fenced code blocks', () => {
    const md = '# real\n\n```md\n# not a heading\n```\n'
    expect(parseOutline(md)).toEqual([{ id: 'h-0', level: 1, text: 'real' }])
  })

  it('returns empty for no headings', () => {
    expect(parseOutline('just text')).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run tests/outline.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 写 `src/renderer/src/editor/outline.ts`**

```ts
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Heading } from 'mdast'
import type { OutlineNode } from './types'

export function buildAnchorId(index: number): string {
  return `h-${index}`
}

export function parseOutline(markdown: string): OutlineNode[] {
  const tree = remark().use(remarkGfm).parse(markdown)
  const outline: OutlineNode[] = []
  visit(tree, 'heading', (node) => {
    const heading = node as Heading
    const text = toString(heading)
    if (text.trim()) {
      outline.push({ id: buildAnchorId(outline.length), level: heading.depth, text })
    }
  })
  return outline
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/outline.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/editor/outline.ts tests/outline.test.ts package.json pnpm-lock.yaml
git commit -m "feat(editor): heading outline parser"
```

---

### Task 3: Milkdown WYSIWYG 引擎适配器

**Files:**
- Create: `src/renderer/src/editor/milkdownEditor.ts`

**Interfaces:**
- Consumes: 无（引擎适配器只回调 `onEdit`）。
- Produces:
  - `interface MarkdownEditorAdapter { setContent(md: string): void; focus(): void; destroy(): void }`
  - `function createMilkdownEditor(root: HTMLElement, initialMarkdown: string, onEdit: (md: string) => void): Promise<MarkdownEditorAdapter>`

- [ ] **Step 1: 安装依赖**

Run: `pnpm add @milkdown/kit`

- [ ] **Step 2: 写 `src/renderer/src/editor/milkdownEditor.ts`**

```ts
import { Editor, editorViewCtx, rootCtx, defaultValueCtx } from '@milkdown/kit'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { replaceAll } from '@milkdown/kit/utils'

export interface MarkdownEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
}

export async function createMilkdownEditor(
  root: HTMLElement,
  initialMarkdown: string,
  onEdit: (md: string) => void
): Promise<MarkdownEditorAdapter> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, initialMarkdown)
      ctx.set(listenerCtx, {
        markdownUpdated: (_ctx, markdown) => onEdit(markdown)
      })
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(clipboard)
    .use(trailing)
    .create()

  return {
    setContent: (md) => editor.action(replaceAll(md)),
    focus: () => editor.action((ctx) => ctx.get(editorViewCtx).focus()),
    destroy: () => editor.destroy()
  }
}
```

> 说明：`@milkdown/kit` 的子路径导出（`/preset/commonmark`、`/plugin/history` 等）为 v7 官方写法。
> 若 `pnpm typecheck:web` 提示子路径未导出，改为从 `@milkdown/kit` 顶层一次性导入（`import { Editor, commonmark, gfm, history, listener, listenerCtx, clipboard, trailing, replaceAll, editorViewCtx, rootCtx, defaultValueCtx } from '@milkdown/kit'`），以实际类型为准。

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck:web`
Expected: 无错误（若子路径导出报错，按 Step 2 说明改为顶层导入）。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/src/editor/milkdownEditor.ts package.json pnpm-lock.yaml
git commit -m "feat(editor): milkdown wysiwyg adapter"
```

---

### Task 4: CodeMirror 源码引擎适配器

**Files:**
- Create: `src/renderer/src/editor/codemirrorEditor.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `interface SourceEditorAdapter { setContent(md: string): void; focus(): void; destroy(): void }`
  - `function createCodeMirrorEditor(parent: HTMLElement, initialMarkdown: string, onEdit: (md: string) => void): SourceEditorAdapter`

- [ ] **Step 1: 安装依赖**

Run: `pnpm add @codemirror/state @codemirror/view @codemirror/language @codemirror/commands @codemirror/lang-markdown @lezer/highlight`

- [ ] **Step 2: 写 `src/renderer/src/editor/codemirrorEditor.ts`**

```ts
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export interface SourceEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
}

export function createCodeMirrorEditor(
  parent: HTMLElement,
  initialMarkdown: string,
  onEdit: (md: string) => void
): SourceEditorAdapter {
  let suppress = false

  const state = EditorState.create({
    doc: initialMarkdown,
    extensions: [
      lineNumbers(),
      history(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppress) {
          onEdit(update.state.doc.toString())
        }
      })
    ]
  })

  const view = new EditorView({ state, parent })

  return {
    setContent: (md) => {
      suppress = true
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: md } })
      suppress = false
    },
    focus: () => view.focus(),
    destroy: () => view.destroy()
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck:web`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/src/editor/codemirrorEditor.ts package.json pnpm-lock.yaml
git commit -m "feat(editor): codemirror source adapter"
```

---

### Task 5: Editor 组件接线（模式切换 + 错误兜底 + ref）

**Files:**
- Create: `src/renderer/src/editor/Editor.tsx`
- Create: `src/renderer/src/editor/index.ts`

**Interfaces:**
- Consumes: `EditorHandle` / `EditorProps`（Task 1）、`createEditorController`（Task 1）、`createMilkdownEditor`（Task 3）、`createCodeMirrorEditor`（Task 4）、`parseOutline`（Task 2）。
- Produces: `export const Editor`（forwardRef 组件，暴露 `EditorHandle`）、`src/renderer/src/editor/index.ts` 对外导出。

- [ ] **Step 1: 写 `src/renderer/src/editor/Editor.tsx`**

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createEditorController } from './controller'
import { createMilkdownEditor, type MarkdownEditorAdapter } from './milkdownEditor'
import { createCodeMirrorEditor, type SourceEditorAdapter } from './codemirrorEditor'
import { parseOutline } from './outline'
import type { EditorHandle, EditorMode, EditorProps } from './types'

type Adapter = MarkdownEditorAdapter | SourceEditorAdapter

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const { initialMarkdown, onChange, onChangeDirty, onModeChange, onOutlineChange } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<Adapter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setMode] = useState<EditorMode>('wysiwyg')

  const controllerRef = useRef<ReturnType<typeof createEditorController> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createEditorController(initialMarkdown, { onChange, onChangeDirty, onModeChange })
  }

  function emitOutline(): void {
    if (onOutlineChange) onOutlineChange(parseOutline(controllerRef.current!.getMarkdown()))
  }

  async function mount(mode: EditorMode): Promise<void> {
    const root = containerRef.current!
    root.innerHTML = ''
    adapterRef.current?.destroy()
    const controller = controllerRef.current!
    const md = controller.getMarkdown()
    adapterRef.current =
      mode === 'wysiwyg'
        ? await createMilkdownEditor(root, md, (next) => {
            controller.applyEdit(next)
            emitOutline()
          })
        : createCodeMirrorEditor(root, md, (next) => {
            controller.applyEdit(next)
            emitOutline()
          })
  }

  function switchMode(mode: EditorMode): void {
    const controller = controllerRef.current!
    if (controller.getMode() === mode) return
    controller.setMode(mode)
    setMode(mode)
    mount(mode).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  useImperativeHandle(ref, () => ({
    getMarkdown: () => controllerRef.current!.getMarkdown(),
    setMarkdown: (md) => {
      controllerRef.current!.setMarkdown(md)
      adapterRef.current?.setContent(md)
    },
    markSaved: () => controllerRef.current!.markSaved(),
    getMode: () => controllerRef.current!.getMode(),
    setMode: switchMode,
    focus: () => adapterRef.current?.focus()
  }))

  useEffect(() => {
    mount('wysiwyg').then(emitOutline).catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p>编辑器初始化失败：{error}</p>
        <button
          onClick={() => {
            setError(null)
            mount(controllerRef.current!.getMode()).catch((e) =>
              setError(e instanceof Error ? e.message : String(e))
            )
          }}
        >
          重试
        </button>
      </div>
    )
  }

  return <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }} />
})
```

- [ ] **Step 2: 写 `src/renderer/src/editor/index.ts`**

```ts
export { Editor } from './Editor'
export type { EditorHandle, EditorMode, EditorProps, OutlineNode } from './types'
```

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck:web`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/src/editor/Editor.tsx src/renderer/src/editor/index.ts
git commit -m "feat(editor): editor component wiring dual engines"
```

---

### Task 6: 增强插件——数学(KaTeX)、Mermaid、代码块渲染

**Files:**
- Modify: `src/renderer/src/editor/milkdownEditor.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `createMilkdownEditor` 增加 `.use(math)` / `.use(diagram)` / `.use(codeBlock)`，其余签名不变。

- [ ] **Step 1: 安装依赖**

Run: `pnpm add katex remark-math mermaid`

- [ ] **Step 2: 在 `milkdownEditor.ts` 引入并启用插件**

在文件顶部新增：

```ts
import { math } from '@milkdown/kit/plugin/math'
import { diagram } from '@milkdown/kit/plugin/diagram'
import { codeBlock } from '@milkdown/kit/plugin/code-block'
import 'katex/dist/katex.min.css'
```

在 `.create()` 前、`.use(trailing)` 之后追加：

```ts
    .use(math)
    .use(diagram)
    .use(codeBlock)
```

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck:web`
Expected: 无错误（若 `@milkdown/kit/plugin/math` 等子路径不存在，改用独立包 `@milkdown/plugin-math` / `@milkdown/plugin-diagram` / `@milkdown/plugin-code-block` 并 `pnpm add` 之，以 typecheck 报错为准微调）。

- [ ] **Step 4: 验证渲染**

Run: `pnpm dev`
Expected: 编辑器可渲染数学公式（`$x^2$`）、Mermaid 图（` ```mermaid ` 围栏）与代码块（带语言标注、等宽字体）；无控制台报错。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/editor/milkdownEditor.ts package.json pnpm-lock.yaml
git commit -m "feat(editor): math, mermaid and code-block rendering"
```

---

### Task 7: 挂载到 App 并验收

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `Editor` / `EditorHandle` / `EditorProps`（Task 5）。

- [ ] **Step 1: 重写 `src/renderer/src/App.tsx` 为最小编辑器挂载**

```tsx
import { useRef, useState } from 'react'
import { ConfigProvider, Layout, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Editor } from './editor'
import type { EditorHandle } from './editor'

const SAMPLE = '# 我的第一篇文章\n\n这是一段 **Markdown** 内容。\n\n## 第二章\n\n- 列表\n- 列表\n\n```js\nconsole.log(1)\n```\n'

export default function App() {
  const ref = useRef<EditorHandle>(null)
  const [dirty, setDirty] = useState(false)
  const [outline, setOutline] = useState<string[]>([])

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Text strong style={{ color: '#fff' }}>
            Markdown Studio
          </Typography.Text>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            {dirty ? '未保存' : '已保存'}
          </Typography.Text>
          <button
            onClick={() => {
              const h = ref.current
              if (!h) return
              h.setMode(h.getMode() === 'wysiwyg' ? 'source' : 'wysiwyg')
            }}
          >
            切换源码/WYSIWYG
          </button>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            {outline.join(' / ')}
          </Typography.Text>
        </Layout.Header>
        <Layout.Content style={{ height: 'calc(100vh - 64px)', padding: 16 }}>
          <Editor
            ref={ref}
            initialMarkdown={SAMPLE}
            onChange={() => {}}
            onChangeDirty={setDirty}
            onOutlineChange={(o) => setOutline(o.map((n) => n.text))}
          />
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  )
}
```

> 说明：本步骤只用于子项目 A 的端到端验收（临时挂载）。现有 `UserManage`/`user`/`system` 模块暂停渲染但保留文件，其移除在子项目 B（文件层）随正式布局一并处理。

- [ ] **Step 2: 类型检查**

Run: `pnpm typecheck:web`
Expected: 无错误。

- [ ] **Step 3: 运行全量单测**

Run: `pnpm test`
Expected: controller / outline 测试 PASS。

- [ ] **Step 4: 手动验收（对照 spec §10）**

Run: `pnpm dev`

逐条确认：
1. 窗口加载 SAMPLE markdown 并 WYSIWYG 渲染。
2. 输入 `# ` 自动转为标题，退格可还原。
3. 点「切换源码/WYSIWYG」进入源码模式（CodeMirror 高亮），再切回内容一致。
4. 顶栏「未保存/已保存」随编辑切换（dirty 语义）。
5. 顶栏显示大纲标题（`我的第一篇文章 / 第二章`）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat(editor): mount editor in app for acceptance"
```

---

## 验收对照

| 规格要求 | 覆盖任务 |
|---|---|
| `Editor` 边界与稳定接口（getMarkdown/setMarkdown/markSaved/模式切换） | Task 1 / 5 |
| WYSIWYG（Milkdown，GFM） | Task 3 |
| 源码模式（CodeMirror） | Task 4 |
| 模式切换内容一致 | Task 5 / 7 |
| 数学(KaTeX)/Mermaid/代码块渲染 | Task 6 |
| TOC 标题→大纲 | Task 2 / 5 |
| 引擎初始化失败兜底 + 序列化失败兜底 | Task 5（error 态）/ Task 1（applyEdit no-op 兜底） |
| 接口契约单测 + 大纲解析单测 | Task 1 / 2 |
| `pnpm test` 通过 | Task 7 |

> 注：spec §9 的「往返保真测试」因 Milkdown 的 parse→serialize 需 DOM，node 环境无法自动化覆盖；已由 Task 7 Step 4 的源码模式往返（手动）承担。若后续需自动化，可为 `tests/` 单独引入 jsdom 环境再补。
