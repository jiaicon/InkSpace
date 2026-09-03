import { commandsCtx } from '@milkdown/kit/core'
import {
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  insertHrCommand
} from '@milkdown/kit/preset/commonmark'
import { insertTableCommand } from '@milkdown/kit/preset/gfm'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Ctx } from '@milkdown/kit/ctx'
import { wrapInTaskListCommand } from './taskList'

interface SlashItem {
  icon: string
  label: string
  keywords: string[]
  run: () => void
}

function createItems(ctx: Ctx): SlashItem[] {
  const manager = () => ctx.get(commandsCtx)
  const heading = (level: number) => () => manager().call(wrapInHeadingCommand.key, level)
  return [
    { icon: 'H1', label: '一级标题', keywords: ['h1', 'heading 1'], run: heading(1) },
    { icon: 'H2', label: '二级标题', keywords: ['h2', 'heading 2'], run: heading(2) },
    { icon: 'H3', label: '三级标题', keywords: ['h3', 'heading 3'], run: heading(3) },
    { icon: 'H4', label: '四级标题', keywords: ['h4', 'heading 4'], run: heading(4) },
    { icon: 'H5', label: '五级标题', keywords: ['h5', 'heading 5'], run: heading(5) },
    { icon: 'H6', label: '六级标题', keywords: ['h6', 'heading 6'], run: heading(6) },
    {
      icon: '•',
      label: '无序列表',
      keywords: ['list', 'bullet'],
      run: () => manager().call(wrapInBulletListCommand.key)
    },
    {
      icon: '1.',
      label: '有序列表',
      keywords: ['ordered list', 'number'],
      run: () => manager().call(wrapInOrderedListCommand.key)
    },
    {
      icon: '☑',
      label: '任务列表',
      keywords: ['task', 'todo', 'checkbox'],
      run: () => manager().call(wrapInTaskListCommand.key)
    },
    {
      icon: '❝',
      label: '引用',
      keywords: ['quote', 'blockquote'],
      run: () => manager().call(wrapInBlockquoteCommand.key)
    },
    {
      icon: '</>',
      label: '代码块',
      keywords: ['code', 'codeblock'],
      run: () => manager().call(createCodeBlockCommand.key)
    },
    {
      icon: '⊞',
      label: '表格',
      keywords: ['table', 'grid'],
      run: () => manager().call(insertTableCommand.key, { row: 3, col: 3 })
    },
    {
      icon: '—',
      label: '分割线',
      keywords: ['hr', 'divider', 'rule'],
      run: () => manager().call(insertHrCommand.key)
    }
  ]
}

/**
 * 斜杠菜单：在段落开头输入 `/` 呼出块级菜单。
 * 支持标题 1-6、无序/有序列表、引用、代码块、分割线。
 * 输入 `/` 后继续打字即可按名称过滤，↑↓ 选择，Enter 确认，Esc 关闭。
 */
export const slashMenu = $prose((ctx) => {
  const items = createItems(ctx)

  const menu = document.createElement('div')
  menu.className = 'ms-slash-menu'
  menu.setAttribute('data-show', 'false')

  let view: EditorView | null = null
  let open = false
  let slashPos = -1
  let activeIndex = 0
  let filtered: SlashItem[] = items

  const render = () => {
    menu.textContent = ''
    filtered.forEach((item, i) => {
      const row = document.createElement('div')
      row.className = 'ms-slash-item' + (i === activeIndex ? ' is-active' : '')
      const icon = document.createElement('span')
      icon.className = 'ms-slash-icon'
      icon.textContent = item.icon
      const label = document.createElement('span')
      label.className = 'ms-slash-label'
      label.textContent = item.label
      row.appendChild(icon)
      row.appendChild(label)
      row.addEventListener('mousedown', (e) => e.preventDefault())
      row.addEventListener('click', () => selectItem(i))
      menu.appendChild(row)
    })
    menu.setAttribute('data-show', filtered.length > 0 && open ? 'true' : 'false')
    // 选中项变化时滚入可见区域（键盘 ↑↓ 也能跟随滚动）
    menu.querySelector<HTMLElement>('.ms-slash-item.is-active')?.scrollIntoView({ block: 'nearest' })
  }

  const updateQuery = () => {
    if (!view || slashPos < 0) return
    const text = view.state.doc.textBetween(slashPos, view.state.selection.from, '\n')
    const query = text.slice(1).trim().toLowerCase()
    filtered = items.filter(
      (it) =>
        query === '' ||
        it.label.toLowerCase().includes(query) ||
        it.keywords.some((k) => k.toLowerCase().includes(query))
    )
    if (activeIndex >= filtered.length) activeIndex = 0
    render()
  }

  const close = () => {
    if (!open) return
    open = false
    slashPos = -1
    activeIndex = 0
    filtered = items
    menu.setAttribute('data-show', 'false')
  }

  // 编辑器/文档滚动时关闭，避免菜单停留在过期的坐标上；
  // 菜单自身滚动（拖滚动条 / 滚轮）不关闭，否则菜单无法滚动
  const onScroll = (e: Event) => {
    if (e.target instanceof Node && (e.target === menu || menu.contains(e.target))) return
    close()
  }
  window.addEventListener('scroll', onScroll, true)

  const selectItem = (index: number) => {
    const item = filtered[index]
    if (!view || !item) return
    const state = view.state
    const from = Math.min(slashPos, state.selection.from)
    const to = Math.max(slashPos, state.selection.from)
    close()
    // 先删除 `/query` 文本，再执行目标块命令（命令基于当前光标所在块）
    if (to > from) view.dispatch(state.tr.delete(from, to))
    item.run()
    view.focus()
  }

  const openAt = (pos: number) => {
    if (!view) return
    open = true
    slashPos = pos
    activeIndex = 0
    updateQuery()
    if (!menu.parentElement) document.body.appendChild(menu)
    const coords = view.coordsAtPos(pos)
    menu.style.left = `${coords.left}px`
    menu.style.top = `${coords.bottom + 6}px`
    // 视口自适应：底部放不下则翻转到光标上方，避免菜单超出屏幕、底部项无法滚动到
    const rect = menu.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 4) {
      menu.style.top = `${Math.max(8, coords.top - rect.height - 6)}px`
    }
  }

  // 光标是否在段落起始（`/` 只有在此处才呼出菜单）
  const isAtParagraphStart = (v: EditorView, pos: number) => {
    const $from = v.state.doc.resolve(pos)
    return $from.parent.type.name === 'paragraph' && $from.parentOffset === 0
  }

  return new Plugin({
    key: new PluginKey('MS_SLASH_MENU'),
    props: {
      handleKeyDown: (v, event) => {
        if (open) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            activeIndex = Math.min(activeIndex + 1, filtered.length - 1)
            render()
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            activeIndex = Math.max(activeIndex - 1, 0)
            render()
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            selectItem(activeIndex)
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
            return true
          }
          if (event.key === 'Backspace' && v.state.selection.from <= slashPos + 1) {
            close()
            return false
          }
        }
        // 段落开头输入 `/` 呼出菜单（不拦截，让 `/` 正常插入）
        if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const { selection } = v.state
          if (selection.empty && isAtParagraphStart(v, selection.from)) {
            openAt(selection.from)
          }
        }
        return false
      }
    },
    view: (v) => {
      view = v
      return {
        update: (v) => {
          if (!open) return
          const { selection } = v.state
          if (!selection.empty || selection.from < slashPos) {
            close()
            return
          }
          // `/` 被删除（退格）则关闭
          if (v.state.doc.textBetween(slashPos, slashPos + 1, '\n') !== '/') {
            close()
            return
          }
          const $slash = v.state.doc.resolve(slashPos)
          const $caret = v.state.doc.resolve(selection.from)
          if ($slash.parent !== $caret.parent) {
            close()
            return
          }
          updateQuery()
        },
        destroy: () => {
          window.removeEventListener('scroll', onScroll, true)
          menu.remove()
        }
      }
    }
  })
})
