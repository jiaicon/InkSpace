import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'

/**
 * 给「光标进入就切换显示」的节点打上 `.is-editing`。
 *
 * 数学公式与 Mermaid 图表都用这套：节点里同时放「渲染层」和「源码层」，
 * 光标在节点内时显示源码、在外时显示渲染结果。
 *
 * @param name 插件名（同页面会有多个，必须唯一）
 * @param matches 判断节点是否属于本插件管辖
 */
export function editingDecoration(name: string, matches: (node: PMNode) => boolean) {
  return $prose(() => {
    const key = new PluginKey<DecorationSet>(name)

    const build = (doc: PMNode, selection: { from: number; to: number }): DecorationSet => {
      const decorations: Decoration[] = []
      doc.descendants((node, pos) => {
        if (!matches(node)) return true
        const to = pos + node.nodeSize
        // 选区完全落在节点内才算「进入」，光标贴在节点外侧不算
        if (selection.from >= pos && selection.to <= to) {
          decorations.push(Decoration.node(pos, to, { class: 'is-editing' }))
        }
        return false
      })
      return DecorationSet.create(doc, decorations)
    }

    return new Plugin({
      key,
      state: {
        init: (_config, state) => build(state.doc, state.selection),
        apply: (tr, value, _oldState, newState) =>
          tr.docChanged || tr.selectionSet ? build(newState.doc, newState.selection) : value
      },
      props: {
        decorations: (state) => key.getState(state)
      }
    })
  })
}
