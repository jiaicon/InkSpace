import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

/**
 * 点击任务列表项的复选框切换「完成 / 未完成」状态。
 * 复选框由 CSS `::before` 绘制（非真实 DOM，无独立点击目标），点击事件 target 落在 li 上，
 * 这里用「点击横坐标是否落在 li 左侧 padding 区」判断是否点到了复选框，再按需翻转 checked。
 */
export const taskListToggle = $prose(() => {
  // 从 li 元素定位对应的 list_item 节点及其文档位置
  const findTaskItem = (view: EditorView, li: HTMLElement) => {
    const base = view.posAtDOM(li, 0)
    for (const candidate of [base, base - 1]) {
      if (candidate < 0) continue
      const $pos = view.state.doc.resolve(candidate)
      for (let depth = $pos.depth; depth > 0; depth--) {
        const node = $pos.node(depth)
        if (node.type.name === 'list_item' && node.attrs.checked != null) {
          return { node, pos: $pos.before(depth) }
        }
      }
    }
    return null
  }

  return new Plugin({
    key: new PluginKey('MS_TASK_LIST_TOGGLE'),
    props: {
      handleClick: (view, _pos, event) => {
        const target = event.target as HTMLElement | null
        if (!target || typeof target.closest !== 'function') return false
        const li = target.closest<HTMLElement>('li[data-item-type="task"]')
        if (!li) return false

        // 只有点击落在复选框区域（li 左侧 padding 区）才算，点到文字/右侧不算
        const rect = li.getBoundingClientRect()
        const padLeft = parseFloat(getComputedStyle(li).paddingLeft) || 0
        if (event.clientX > rect.left + padLeft) return false

        const found = findTaskItem(view, li)
        if (!found) return false

        const { node, pos } = found
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, null, {
            ...node.attrs,
            checked: !node.attrs.checked
          })
        )
        view.focus()
        return true
      }
    }
  })
})
