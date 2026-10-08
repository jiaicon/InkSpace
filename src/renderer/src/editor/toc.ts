import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { buildTocTree, flattenTocTree, isTocParagraph, type TocTreeNode } from '@shared/toc'
import { collectHeadings, type HeadingEntry } from './tocHeadings'
import { isBlockBeingEdited, trackEditorFocus } from './blockEditing'

/** collectTocTargets 只需要块级节点的这几项，便于用普通对象单测 */
export interface TocBlockLike {
  type: { name: string }
  textContent: string
  nodeSize: number
}

export interface TocRange {
  /** 段落起始位置 */
  pos: number
  /** 段落结束位置 */
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
  for (const block of blocks) {
    if (block.type.name === 'paragraph' && isTocParagraph(block.textContent)) {
      targets.push({ pos, to: pos + block.nodeSize })
    }
    pos += block.nodeSize
  }
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

  // 目录条目的下标必须对上 querySelectorAll('h1..h6') 的下标。
  // 不能拿 collectHeadings 的原对象建表 —— buildTocTree 会为每个条目新建对象，
  // 查副本必然落空；下标要从**树的先序展平**里取（先序即文档顺序）。
  const tree = buildTocTree(headings)
  const indexOf = new Map(flattenTocTree(tree).map((n, i) => [n, i]))

  const render = (nodes: TocTreeNode<HeadingEntry>[]): HTMLUListElement => {
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

  nav.appendChild(render(tree))
  return nav
}

interface TocState {
  deco: DecorationSet
  key: string
  focused: boolean
}

function buildState(
  doc: PMNode,
  selection: { from: number; to: number },
  getView: () => EditorView | null,
  focused: boolean
): TocState {
  const targets = collectTocTargets(topLevelBlocks(doc))
  const headings = collectHeadings(doc)
  const decos: Decoration[] = []
  const parts: string[] = []

  for (const target of targets) {
    const editing = isBlockBeingEdited(focused, selection, target.pos, target.to)
    parts.push(`${target.pos}:${editing ? 1 : 0}`)

    const classes = ['ms-toc']
    if (editing) classes.push('is-editing')
    decos.push(Decoration.node(target.pos, target.to, { class: classes.join(' ') }))

    if (!editing) {
      // widget 是段落的前一个兄弟节点：CSS 把段落 display:none 后，正好由它顶替
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
    key: `${focused ? 'f' : 'b'}|${parts.join('|')}#${signature(headings)}`,
    focused
  }
}

export const tocPlugin = $prose(() => {
  const key = new PluginKey<TocState>('MS_TOC')
  const focusMeta = 'MS_TOC_FOCUS'
  // init 时还没有 view；widget 的点击回调在**点击那一刻**才取它，
  // 所以传 getter 而不是按值捕获 —— 否则目录永远点不动
  let view: EditorView | null = null
  const getView = () => view

  return new Plugin({
    key,
    state: {
      init: (_config, state) => buildState(state.doc, state.selection, getView, false),
      apply: (tr, prev, _old, next) => {
        const meta = tr.getMeta(focusMeta) as boolean | undefined
        const focused = meta === undefined ? prev.focused : meta
        if (!tr.docChanged && !tr.selectionSet && meta === undefined) return prev
        const built = buildState(next.doc, next.selection, getView, focused)
        // 焦点、标题、编辑态都没变就复用旧装饰集，避免每次按键都重建 widget DOM
        return built.key === prev.key ? prev : built
      }
    },
    view: (v) => {
      view = v
      const untrack = trackEditorFocus(v, focusMeta)
      return {
        destroy: () => {
          untrack()
          view = null
        }
      }
    },
    props: {
      decorations: (state) => key.getState(state)?.deco ?? null
    }
  })
})
