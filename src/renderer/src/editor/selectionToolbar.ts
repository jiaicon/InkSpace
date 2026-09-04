import { commandsCtx } from '@milkdown/kit/core'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand
} from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Ctx } from '@milkdown/kit/ctx'

interface ToolbarButton {
  title: string
  label: string
  cls: string
  run: () => void
  /** 打开宿主弹窗的按钮（如链接）执行后不把焦点抢回编辑器 */
  noRefocus?: boolean
}

export interface SelectionToolbarOptions {
  /** 点击「链接」按钮时回调（由宿主打开链接对话框） */
  onRequestLink?: () => void
}

function createButtons(ctx: Ctx, onRequestLink?: () => void): ToolbarButton[] {
  const manager = () => ctx.get(commandsCtx)
  return [
    {
      title: '加粗',
      label: 'B',
      cls: 'is-bold',
      run: () => manager().call(toggleStrongCommand.key)
    },
    {
      title: '斜体',
      label: 'I',
      cls: 'is-italic',
      run: () => manager().call(toggleEmphasisCommand.key)
    },
    {
      title: '删除线',
      label: 'S',
      cls: 'is-strike',
      run: () => manager().call(toggleStrikethroughCommand.key)
    },
    {
      title: '行内代码',
      label: '</>',
      cls: 'is-code',
      run: () => manager().call(toggleInlineCodeCommand.key)
    },
    { title: '链接', label: '🔗', cls: 'is-link', noRefocus: true, run: () => onRequestLink?.() }
  ]
}

/**
 * 选中工具条：选中文本时浮出，提供加粗/斜体/删除线/行内代码/链接。
 * 点击按钮用 mousedown.preventDefault 保持编辑器选区，再执行 toggle 命令。
 */
export const selectionToolbar = (options: SelectionToolbarOptions = {}) =>
  $prose((ctx) => {
    const bar = document.createElement('div')
    bar.className = 'ms-selection-toolbar'
    bar.setAttribute('data-show', 'false')

    let view: EditorView | null = null

    createButtons(ctx, options.onRequestLink).forEach((b) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `ms-selection-btn ${b.cls}`
      btn.textContent = b.label
      btn.title = b.title
      btn.addEventListener('mousedown', (e) => e.preventDefault())
      btn.addEventListener('click', () => {
        b.run()
        // 链接按钮会打开宿主弹窗，焦点应交给弹窗输入框，不能抢回编辑器，
        // 否则弹窗里的 Enter 会落到编辑器上、把选中文字替换成换行。
        if (!b.noRefocus) view?.focus()
      })
      bar.appendChild(btn)
    })

    const show = (v: EditorView) => {
      const { from } = v.state.selection
      const coords = v.coordsAtPos(from)
      bar.style.left = `${coords.left}px`
      bar.style.top = `${coords.top - 44}px`
      bar.setAttribute('data-show', 'true')
      if (!bar.parentElement) document.body.appendChild(bar)
    }
    const hide = () => bar.setAttribute('data-show', 'false')
    const onScroll = () => hide()
    window.addEventListener('scroll', onScroll, true)

    return new Plugin({
      key: new PluginKey('MS_SELECTION_TOOLBAR'),
      view: (v) => {
        view = v
        return {
          update: (v) => {
            const { selection } = v.state
            const { empty, from, to } = selection
            const isTextSelection = selection instanceof TextSelection
            const hasText = !empty && v.state.doc.textBetween(from, to, '\n').length > 0
            if (hasText && isTextSelection && v.hasFocus()) show(v)
            else hide()
          },
          destroy: () => {
            window.removeEventListener('scroll', onScroll, true)
            bar.remove()
          }
        }
      }
    })
  })
