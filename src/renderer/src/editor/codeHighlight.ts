import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import { collectCodeBlockRanges, collectDocumentHighlights } from './highlightTokens'

const highlightKey = new PluginKey<DecorationSet>('MS_CODE_HIGHLIGHT')

/** 给代码块加 hljs 类 + 按语言生成 token 装饰 */
function buildDecorations(doc: Node): DecorationSet {
  const decorations = [
    // hljs 挂在 <pre> 上，让所选代码主题的 .hljs { background, color } 接管代码块配色
    ...collectCodeBlockRanges(doc).map((range) =>
      Decoration.node(range.from, range.to, { class: 'hljs' })
    ),
    ...collectDocumentHighlights(doc).map((token) =>
      Decoration.inline(token.from, token.to, { class: token.classes.join(' ') })
    )
  ]
  return DecorationSet.create(doc, decorations)
}

/**
 * 代码块语法高亮：把 lowlight 产出的 token 转成 ProseMirror 内联装饰。
 * 每次文档变化整篇重建——代码块数量通常有限，先保证正确与简单；
 * 若将来在大文档上出现卡顿，再改为只重建发生变化的代码块。
 */
export const codeHighlight = $prose(() => {
  return new Plugin({
    key: highlightKey,
    state: {
      init: (_config, state) => buildDecorations(state.doc),
      apply: (tr, value) => (tr.docChanged ? buildDecorations(tr.doc) : value)
    },
    props: {
      decorations: (state) => highlightKey.getState(state)
    }
  })
})
