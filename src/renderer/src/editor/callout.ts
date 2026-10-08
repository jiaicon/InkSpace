import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { calloutMeta, parseCalloutMarker, type CalloutType } from '@shared/callout'
import { isBlockBeingEdited, trackEditorFocus } from './blockEditing'

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
  focused: boolean
}

function buildState(
  doc: PMNode,
  selection: { from: number; to: number },
  focused: boolean
): CalloutState {
  const hits = collectCallouts(doc)
  const decos: Decoration[] = []
  const parts: string[] = []

  for (const hit of hits) {
    const meta = calloutMeta(hit.type)
    // 有焦点且选区落在块内 = 用户正在编辑或选中它，此时露出 [!TYPE] 源码
    const editing = isBlockBeingEdited(focused, selection, hit.pos, hit.to)
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

  return {
    deco: DecorationSet.create(doc, decos),
    key: `${focused ? 'f' : 'b'}|${parts.join('|')}`,
    focused
  }
}

export const calloutPlugin = $prose(() => {
  const key = new PluginKey<CalloutState>('MS_CALLOUT')
  const focusMeta = 'MS_CALLOUT_FOCUS'

  return new Plugin({
    key,
    state: {
      init: (_config, state) => buildState(state.doc, state.selection, false),
      apply: (tr, prev, _old, next) => {
        const meta = tr.getMeta(focusMeta) as boolean | undefined
        const focused = meta === undefined ? prev.focused : meta
        if (!tr.docChanged && !tr.selectionSet && meta === undefined) return prev
        const built = buildState(next.doc, next.selection, focused)
        // 焦点、结构、编辑态都没变就复用旧装饰集，避免每次按键都重建 widget DOM
        return built.key === prev.key ? prev : built
      }
    },
    // 只有焦点变化会通过 meta 事务进来，这里只负责在挂载/卸载时接上与摘掉监听
    view: (v) => ({ destroy: trackEditorFocus(v, focusMeta) }),
    props: {
      decorations: (state) => key.getState(state)?.deco ?? null
    }
  })
})
