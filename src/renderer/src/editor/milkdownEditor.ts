import { Editor, editorViewCtx, rootCtx, defaultValueCtx, commandsCtx } from '@milkdown/kit/core'
import { commonmark, insertImageCommand, toggleLinkCommand } from '@milkdown/kit/preset/commonmark'
import { gfm, columnResizingPlugin } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { $prose, replaceAll } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { slashMenu } from './slashMenu'
import { selectionToolbar } from './selectionToolbar'
import { tableToolbar } from './tableToolbar'
import { wrapInTaskListCommand } from './taskList'

export interface MarkdownEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
  insertImage(src: string): void
  setLink(href: string): void
  hasSelection(): boolean
}

// 空文档占位提示
const placeholder = $prose(() => {
  const key = new PluginKey('MILKDOWN_PLACEHOLDER')
  return new Plugin({
    key,
    props: {
      decorations(state) {
        const doc = state.doc
        const empty =
          doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.content.size === 0
        if (!empty) return null
        return DecorationSet.create(doc, [
          Decoration.widget(0, () => {
            const span = document.createElement('span')
            span.className = 'ms-placeholder'
            span.textContent = '开始写作… 支持 # 标题、- 列表、> 引用、``` 代码块'
            return span
          })
        ])
      }
    }
  })
})

export interface MilkdownEditorOptions {
  onRequestLink?: () => void
}

export async function createMilkdownEditor(
  root: HTMLElement,
  initialMarkdown: string,
  onEdit: (md: string) => void,
  options: MilkdownEditorOptions = {}
): Promise<MarkdownEditorAdapter> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, initialMarkdown)
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(clipboard)
    .use(trailing)
    .use(placeholder)
    .use(slashMenu)
    .use(selectionToolbar(options))
    .use(tableToolbar)
    .use(columnResizingPlugin)
    .use(wrapInTaskListCommand)
    .create()

  editor.action((ctx) => {
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => onEdit(markdown))
  })

  return {
    setContent: (md) => editor.action(replaceAll(md)),
    focus: () => editor.action((ctx) => ctx.get(editorViewCtx).focus()),
    destroy: () => editor.destroy(),
    insertImage: (src) =>
      editor.action((ctx) => {
        ctx.get(commandsCtx).call(insertImageCommand.key, { src })
        ctx.get(editorViewCtx).focus()
      }),
    setLink: (href) =>
      editor.action((ctx) => {
        ctx.get(commandsCtx).call(toggleLinkCommand.key, { href })
        ctx.get(editorViewCtx).focus()
      }),
    hasSelection: () => {
      let has = false
      editor.action((ctx) => {
        has = !ctx.get(editorViewCtx).state.selection.empty
      })
      return has
    }
  }
}
