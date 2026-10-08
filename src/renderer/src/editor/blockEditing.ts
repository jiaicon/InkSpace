import type { EditorView } from '@milkdown/kit/prose/view'

/**
 * 「正在编辑某个块」的判定：**编辑器真的持有焦点**，且选区完全落在该块内。
 *
 * 为什么必须有「焦点」这一条：ProseMirror 打开文档时选区默认落在第一个块里。
 * 只看选区的话，首块是 callout / TOC 的文档一打开就会显示源码层
 * （用户看到 `[!NOTE]` / `[TOC]` 原文而不是渲染结果），而他其实根本没在编辑。
 */
export function isBlockBeingEdited(
  focused: boolean,
  selection: { from: number; to: number },
  pos: number,
  to: number
): boolean {
  return focused && selection.from >= pos && selection.to <= to
}

/**
 * 监听编辑器根节点的 focus / blur，把焦点状态用 meta 事务推进插件状态。
 * 返回解绑函数（在插件 view 的 destroy 里调用）。
 */
export function trackEditorFocus(view: EditorView, metaKey: string): () => void {
  const onFocus = (): void => {
    view.dispatch(view.state.tr.setMeta(metaKey, true))
  }
  const onBlur = (): void => {
    view.dispatch(view.state.tr.setMeta(metaKey, false))
  }
  view.dom.addEventListener('focus', onFocus, true)
  view.dom.addEventListener('blur', onBlur, true)
  return () => {
    view.dom.removeEventListener('focus', onFocus, true)
    view.dom.removeEventListener('blur', onBlur, true)
  }
}
