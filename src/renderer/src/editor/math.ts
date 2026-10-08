import { $inputRule, $nodeSchema, $prose, $remark, $view } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorState } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { ViewMutationRecord } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import katex from 'katex'
import remarkMath from 'remark-math'

/**
 * 数学公式（KaTeX）。
 *
 * 设计要点：
 * - **markdown 里保持 `$...$` / `$$...$$` 原文**（remark-math 解析成 inlineMath / math 节点），
 *   另存、往返都不丢。
 * - **节点不做成 atom**：LaTeX 源码就是节点的文本内容（与行内代码同理），光标可以进去改；
 *   光标在公式内时显示源码、离开后渲染成公式。
 * - `throwOnError: false` + `strict: false`：写错的公式以红色原文显示而不是抛错打断输入。
 */

const INLINE = 'math_inline'
const BLOCK = 'math_block'

const KATEX_OPTIONS = { throwOnError: false, strict: false } as const

/** 用 remark-math 解析数学语法（markdown → 节点这一侧） */
export const remarkMathPlugin = $remark('remarkMath', () => remarkMath)

/**
 * node view：渲染层与源码层同时存在，显示哪层由 `.is-editing` 控制。
 * contentDOM 指向源码层，ProseMirror 把节点文本放在那里。
 */
function createMathView(kind: 'inline' | 'block') {
  return (initialNode: PMNode) => {
    const dom = document.createElement(kind === 'inline' ? 'span' : 'div')
    dom.className = `ms-math ms-math-${kind}`

    const rendered = document.createElement('span')
    rendered.className = 'ms-math-render'
    rendered.setAttribute('contenteditable', 'false')

    const source = document.createElement(kind === 'inline' ? 'span' : 'pre')
    source.className = 'ms-math-src'

    dom.append(rendered, source)

    const draw = (latex: string): void => {
      try {
        katex.render(latex, rendered, { ...KATEX_OPTIONS, displayMode: kind === 'block' })
      } catch {
        // 兜底：KaTeX 自身出错时至少把原文显示出来
        rendered.textContent = latex
      }
    }
    draw(initialNode.textContent)

    let node = initialNode
    return {
      dom,
      contentDOM: source,
      update: (next: PMNode) => {
        if (next.type !== node.type) return false
        if (next.textContent !== node.textContent) draw(next.textContent)
        node = next
        return true
      },
      // 渲染层的变化不是文档编辑，只有源码层（contentDOM）里的才算
      ignoreMutation: (mutation: ViewMutationRecord) => !source.contains(mutation.target)
    }
  }
}

export const mathInlineSchema = $nodeSchema(INLINE, () => ({
  group: 'inline',
  inline: true,
  content: 'text*',
  marks: '',
  parseDOM: [{ tag: `span[data-type="${INLINE}"]` }],
  toDOM: () => ['span', { 'data-type': INLINE }, 0],
  parseMarkdown: {
    match: ({ type }) => type === 'inlineMath',
    runner: (state, node, type) => {
      state
        .openNode(type)
        .addText(String(node.value ?? ''))
        .closeNode()
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === INLINE,
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.textContent)
    }
  }
}))

export const mathBlockSchema = $nodeSchema(BLOCK, () => ({
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  parseDOM: [{ tag: `div[data-type="${BLOCK}"]`, preserveWhitespace: 'full' }],
  toDOM: () => ['div', { 'data-type': BLOCK }, ['pre', { class: 'ms-math-src' }, 0]],
  parseMarkdown: {
    match: ({ type }) => type === 'math',
    runner: (state, node, type) => {
      state
        .openNode(type)
        .addText(String(node.value ?? ''))
        .closeNode()
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === BLOCK,
    runner: (state, node) => {
      state.addNode('math', undefined, node.textContent)
    }
  }
}))

export const mathInlineView = $view(mathInlineSchema.node, () => createMathView('inline'))
export const mathBlockView = $view(mathBlockSchema.node, () => createMathView('block'))

/** 输入 `$...$` 后自动转成行内公式 */
export const mathInlineInputRule = $inputRule(
  (ctx) =>
    new InputRule(/\$([^$\n]+)\$$/, (state, match, start, end) => {
      const latex = match[1] ?? ''
      if (!latex) return null
      const node = mathInlineSchema.type(ctx).create(null, state.schema.text(latex))
      return state.tr.replaceRangeWith(start, end, node)
    })
)

/** 空行上输入 `$$` + 空格，转成块级公式 */
export const mathBlockInputRule = $inputRule(
  (ctx) =>
    new InputRule(/^\$\$\s$/, (state, _match, start, end) => {
      const type = mathBlockSchema.type(ctx)
      const $pos = state.doc.resolve(start)
      const canReplace = $pos.node(-1).canReplaceWith($pos.index(-1), $pos.indexAfter(-1), type)
      if (!canReplace) return null
      return state.tr.delete(start, end).setBlockType(start, start, type)
    })
)

/**
 * 光标进入公式节点时给它打上 `.is-editing`，样式据此在「渲染」与「源码」之间切换。
 * 判定用包含关系：选区完全落在节点内才算进入，光标贴在公式外侧不算。
 */
export const mathEditing = $prose(() => {
  const key = new PluginKey<DecorationSet>('MS_MATH_EDITING')

  const build = (state: EditorState): DecorationSet => {
    const decorations: Decoration[] = []
    state.doc.descendants((node, pos) => {
      if (node.type.name !== INLINE && node.type.name !== BLOCK) return true
      const to = pos + node.nodeSize
      if (state.selection.from >= pos && state.selection.to <= to) {
        decorations.push(Decoration.node(pos, to, { class: 'is-editing' }))
      }
      return false
    })
    return DecorationSet.create(state.doc, decorations)
  }

  return new Plugin({
    key,
    state: {
      init: (_config, state) => build(state),
      apply: (tr, value, _oldState, newState) =>
        tr.docChanged || tr.selectionSet ? build(newState) : value
    },
    props: {
      decorations: (state) => key.getState(state)
    }
  })
})

/** 一次性注册进编辑器 */
export const mathPlugins = [
  remarkMathPlugin,
  mathInlineSchema,
  mathBlockSchema,
  mathInlineView,
  mathBlockView,
  mathInlineInputRule,
  mathBlockInputRule,
  mathEditing
].flat()
