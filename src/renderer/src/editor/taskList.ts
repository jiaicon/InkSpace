import { $command } from '@milkdown/kit/utils'
import { findWrapping } from '@milkdown/kit/prose/transform'

/**
 * 将当前块包裹为任务列表项（默认未完成，checked=false）。
 * GFM 预设只导出了输入规则（`- [ ] `）而未导出命令，这里基于 findWrapping 自建：
 * 先按无序列表找包裹方案，再为每个 list_item 注入 checked 属性。
 */
export const wrapInTaskListCommand = $command('WrapInTaskList', () => () => (state, dispatch) => {
  const { $from, $to } = state.selection
  const range = $from.blockRange($to)
  if (!range) return false

  const { bullet_list: bulletList, list_item: listItem } = state.schema.nodes
  if (!bulletList || !listItem) return false

  const wrapping = findWrapping(range, bulletList)
  if (!wrapping) return false

  const taskWrapping = wrapping.map((w) =>
    w.type === listItem
      ? { type: w.type, attrs: { label: '•', listType: 'bullet', spread: true, checked: false } }
      : w
  )

  try {
    dispatch?.(state.tr.wrap(range, taskWrapping).scrollIntoView())
  } catch {
    return false
  }
  return true
})
