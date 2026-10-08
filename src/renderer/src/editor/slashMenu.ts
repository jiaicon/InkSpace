import { commandsCtx } from '@milkdown/kit/core'
import {
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  insertHrCommand,
  turnIntoTextCommand,
  liftListItemCommand
} from '@milkdown/kit/preset/commonmark'
import { insertTableCommand } from '@milkdown/kit/preset/gfm'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { CALLOUTS, calloutMarkerText, type CalloutType } from '@shared/callout'
import { TOC_MARKER } from '@shared/toc'
import { wrapInTaskListCommand } from './taskList'
import { mathBlockSchema } from './math'
import { MATH_BLOCK_PLACEHOLDER, MERMAID_BLOCK_TEMPLATE } from './slashContent'
import { canOpenSlashMenu, escapeTarget } from './slashRules'
import {
  filterSlashItems,
  groupSlashItems,
  slashItems,
  type SlashGroup,
  type SlashItemMeta
} from './slashItems'

export interface SlashMenuOptions {
  /** 选中「图片」时回调，由宿主弹出插入图片对话框（与顶栏按钮同一入口） */
  onRequestImage?: () => void
}

interface SlashItem extends SlashItemMeta {
  run: () => void
}

type SlashSection = { group: SlashGroup; label: string; items: SlashItem[] }

/**
 * 斜杠菜单：在段落或标题的开头输入 `/` 呼出块级菜单，按类别横排。
 * 条目定义（名称/分组/别名）在 slashItems.ts，判定规则在 slashRules.ts，
 * 这里只负责动作绑定、过滤与渲染。
 * 输入 `/` 后继续打字即按名称/别名过滤，↑↓ 选择，Enter 确认，Esc 关闭。
 */
export const slashMenu = (options: SlashMenuOptions = {}) =>
  $prose((ctx) => {
    const manager = () => ctx.get(commandsCtx)

    let view: EditorView | null = null

    // 用「整体替换当前块」的方式插入块级节点，并把光标放进块内 —— 插入后可直接编辑
    const replaceBlock = (node: ProseMirrorNode) => {
      if (!view) return
      const { state } = view
      const { $from } = state.selection
      if ($from.depth < 1) return
      const start = $from.before($from.depth)
      const end = $from.after($from.depth)
      const tr = state.tr.replaceWith(start, end, node)
      // 光标落在新块内容末尾（+1 跳过块本身的起始边界）
      const caret = Math.min(start + 1 + node.content.size, tr.doc.content.size)
      tr.setSelection(TextSelection.create(tr.doc, caret))
      view.dispatch(tr)
    }

    /** 光标处从内到外的祖先节点类型（不含 doc 本身） */
    const ancestorTypeNames = () => {
      const names: string[] = []
      if (!view) return names
      const { $from } = view.state.selection
      for (let depth = $from.depth; depth > 0; depth--) names.push($from.node(depth).type.name)
      return names
    }

    /** 某类型祖先所在的 depth；找不到返回 -1 */
    const depthOf = (name: string) => {
      if (!view) return -1
      const { $from } = view.state.selection
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === name) return depth
      }
      return -1
    }

    /**
     * 「正文」：从标题 / 列表 / 引用里退回普通段落。
     * 列表项的段落本身就是 paragraph，直接 setBlockType 是空操作，所以必须先脱出列表。
     */
    const toParagraph = () => {
      if (!view) return
      const target = escapeTarget(ancestorTypeNames())
      if (target === 'list') {
        manager().call(liftListItemCommand.key)
        return
      }
      if (target === 'quote') {
        const { state } = view
        const { $from } = state.selection
        const quoteDepth = depthOf('blockquote')
        if (quoteDepth > 0) {
          // 拆掉引用：把 blockquote 整个换成它的内容
          const quote = $from.node(quoteDepth)
          const start = $from.before(quoteDepth)
          const end = $from.after(quoteDepth)
          const tr = state.tr.replaceWith(start, end, quote.content)
          tr.setSelection(TextSelection.create(tr.doc, Math.min(start + 1, tr.doc.content.size)))
          view.dispatch(tr)
          return
        }
      }
      manager().call(turnIntoTextCommand.key)
    }

    /**
     * 插入提示块：引用块含「标记段 + 空内容段」两段，光标**显式**落在内容段内部。
     * 不能复用 replaceBlock —— 它把光标放在「块内容的末尾」，那是块的边界位置，
     * 实测在引用块上会落到块外（敲字会新起一个段落），而 callout 恰恰需要一个空内容段。
     */
    const insertCallout = (type: CalloutType) => {
      if (!view) return
      const { state } = view
      const { $from } = state.selection
      const { schema } = state
      const marker = schema.nodes.paragraph.create(null, schema.text(calloutMarkerText(type)))
      const body = schema.nodes.paragraph.create()
      const quote = schema.nodes.blockquote.create(null, [marker, body])
      const start = $from.before($from.depth)
      const end = $from.after($from.depth)
      const tr = state.tr.replaceWith(start, end, quote)
      // 跳过 blockquote 起始(+1)与标记段，再 +1 进入内容段内部
      tr.setSelection(TextSelection.create(tr.doc, start + 1 + marker.nodeSize + 1))
      view.dispatch(tr)
    }

    const actions: Record<string, () => void> = {
      // 退路：把当前块从标题 / 列表 / 引用里退回普通段落
      text: toParagraph,
      // 提示块：键名与 slashItems.ts 的条目 id 同源于 CALLOUTS，两边不会分叉
      ...Object.fromEntries(
        CALLOUTS.map((c) => [`callout-${c.slug}`, () => insertCallout(c.type)] as const)
      ),
      bullet: () => manager().call(wrapInBulletListCommand.key),
      ordered: () => manager().call(wrapInOrderedListCommand.key),
      task: () => manager().call(wrapInTaskListCommand.key),
      quote: () => manager().call(wrapInBlockquoteCommand.key),
      code: () => manager().call(createCodeBlockCommand.key),
      table: () => manager().call(insertTableCommand.key, { row: 3, col: 3 }),
      hr: () => manager().call(insertHrCommand.key),
      math: () => {
        if (!view) return
        const { schema } = view.state
        replaceBlock(mathBlockSchema.type(ctx).create(null, schema.text(MATH_BLOCK_PLACEHOLDER)))
      },
      mermaid: () => {
        if (!view) return
        const { schema } = view.state
        const codeBlock = schema.nodes.code_block
        if (!codeBlock) return
        replaceBlock(codeBlock.create({ language: 'mermaid' }, schema.text(MERMAID_BLOCK_TEMPLATE)))
      },
      image: () => options.onRequestImage?.(),
      // 目录：插一个内容为 [TOC] 的段落 + 一个空段落，光标落在空段落
      //（不落在 [TOC] 段里：落在里面会立刻进入源码层，看到的是原文而不是目录）
      toc: () => {
        if (!view) return
        const { state } = view
        const { $from } = state.selection
        const { schema } = state
        const tocPara = schema.nodes.paragraph.create(null, schema.text(TOC_MARKER))
        const after = schema.nodes.paragraph.create()
        const start = $from.before($from.depth)
        const end = $from.after($from.depth)
        const tr = state.tr.replaceWith(start, end, [tocPara, after])
        // tocPara.nodeSize 跳过整个段落，+1 进入空段落内部
        tr.setSelection(TextSelection.create(tr.doc, start + tocPara.nodeSize + 1))
        view.dispatch(tr)
      }
    }
    for (let level = 1; level <= 6; level++) {
      actions[`h${level}`] = () => manager().call(wrapInHeadingCommand.key, level)
    }

    const ITEMS: SlashItem[] = slashItems.map((meta) => ({
      ...meta,
      run: actions[meta.id] ?? (() => {})
    }))

    const menu = document.createElement('div')
    menu.className = 'ms-slash-menu'
    menu.setAttribute('data-show', 'false')

    let open = false
    let slashPos = -1
    let activeIndex = 0
    // 分组后用于渲染；flat 是同样的条目拍平后的顺序，键盘导航的索引与之一一对应
    let sections: SlashSection[] = groupSlashItems(ITEMS)
    let flat: SlashItem[] = ITEMS

    const relayout = (query: string) => {
      sections = groupSlashItems(filterSlashItems(ITEMS, query))
      flat = sections.flatMap((s) => s.items)
      if (activeIndex >= flat.length) activeIndex = 0
    }

    const render = () => {
      menu.textContent = ''
      let index = 0
      for (const section of sections) {
        const group = document.createElement('div')
        group.className = 'ms-slash-group'

        const title = document.createElement('div')
        title.className = 'ms-slash-group-title'
        title.textContent = section.label
        group.appendChild(title)

        const row = document.createElement('div')
        row.className = 'ms-slash-row'
        for (const item of section.items) {
          const i = index++
          const el = document.createElement('div')
          el.className = 'ms-slash-item' + (i === activeIndex ? ' is-active' : '')
          // 只显示代号的条目（H1–H6）靠 tooltip 说明功能
          el.title = item.tooltip

          const icon = document.createElement('span')
          icon.className = 'ms-slash-icon'
          icon.textContent = item.icon
          el.appendChild(icon)

          if (item.label) {
            const label = document.createElement('span')
            label.className = 'ms-slash-label'
            label.textContent = item.label
            el.appendChild(label)
          }

          el.addEventListener('mousedown', (e) => e.preventDefault())
          el.addEventListener('click', () => selectItem(i))
          row.appendChild(el)
        }
        group.appendChild(row)
        menu.appendChild(group)
      }
      menu.setAttribute('data-show', flat.length > 0 && open ? 'true' : 'false')
      // 选中项变化时滚入可见区域（键盘 ↑↓ 也能跟随滚动）
      menu
        .querySelector<HTMLElement>('.ms-slash-item.is-active')
        ?.scrollIntoView({ block: 'nearest' })
    }

    const updateQuery = () => {
      if (!view || slashPos < 0) return
      const text = view.state.doc.textBetween(slashPos, view.state.selection.from, '\n')
      relayout(text.slice(1))
      render()
    }

    const close = () => {
      if (!open) return
      open = false
      slashPos = -1
      activeIndex = 0
      sections = groupSlashItems(ITEMS)
      flat = ITEMS
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
      const item = flat[index]
      if (!view || !item) return
      const state = view.state
      const from = Math.min(slashPos, state.selection.from)
      const to = Math.max(slashPos, state.selection.from)
      close()
      // 先删除 `/query` 文本，再执行目标动作（块命令基于当前光标所在块）
      if (to > from) view.dispatch(state.tr.delete(from, to))
      item.run()
      view.focus()
    }

    const openAt = (pos: number) => {
      if (!view) return
      open = true
      slashPos = pos
      activeIndex = 0
      sections = groupSlashItems(ITEMS)
      flat = ITEMS
      render()
      if (!menu.parentElement) document.body.appendChild(menu)
      const coords = view.coordsAtPos(pos)
      menu.style.left = `${coords.left}px`
      menu.style.top = `${coords.bottom + 6}px`
      // 视口自适应：底部放不下翻到光标上方，右侧放不下则左移，避免菜单超出屏幕
      const rect = menu.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 4) {
        menu.style.top = `${Math.max(8, coords.top - rect.height - 6)}px`
      }
      if (rect.right > window.innerWidth - 4) {
        menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`
      }
    }

    // 光标是否在段落 / 标题的起始（`/` 只有在此处才呼出菜单）
    const isAtMenuStart = (v: EditorView, pos: number) => {
      const $from = v.state.doc.resolve(pos)
      return canOpenSlashMenu($from.parent.type.name, $from.parentOffset)
    }

    return new Plugin({
      key: new PluginKey('MS_SLASH_MENU'),
      props: {
        handleKeyDown: (v, event) => {
          if (open) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              activeIndex = Math.min(activeIndex + 1, flat.length - 1)
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
          // 段落/标题开头输入 `/` 呼出菜单（不拦截，让 `/` 正常插入）
          if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const { selection } = v.state
            if (selection.empty && isAtMenuStart(v, selection.from)) {
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
