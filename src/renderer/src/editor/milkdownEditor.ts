import { Editor, editorViewCtx, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { replaceAll } from '@milkdown/kit/utils'

export interface MarkdownEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
}

export async function createMilkdownEditor(
  root: HTMLElement,
  initialMarkdown: string,
  onEdit: (md: string) => void
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
    .create()

  editor.action((ctx) => {
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => onEdit(markdown))
  })

  return {
    setContent: (md) => editor.action(replaceAll(md)),
    focus: () => editor.action((ctx) => ctx.get(editorViewCtx).focus()),
    destroy: () => editor.destroy()
  }
}
