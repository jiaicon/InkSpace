import { Editor, editorViewCtx, rootCtx, defaultValueCtx, commandsCtx } from '@milkdown/kit/core'
import { commonmark, insertImageCommand, toggleLinkCommand } from '@milkdown/kit/preset/commonmark'
import { gfm, columnResizingPlugin } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { $prose, replaceAll } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { slashMenu } from './slashMenu'
import { selectionToolbar } from './selectionToolbar'
import { tableToolbar } from './tableToolbar'
import { wrapInTaskListCommand } from './taskList'
import { taskListToggle } from './taskListToggle'
import { imageView, setImageDocDir } from './imageView'
import { codeHighlight } from './codeHighlight'
import { mathPlugins } from './math'
import { mermaidPlugins } from './mermaid'
import {
  search as searchPlugin,
  SearchQuery,
  getSearchState,
  setSearchState,
  findNext,
  findPrev,
  replaceNext,
  replaceAll as replaceAllMatches
} from 'prosemirror-search'
import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { SearchInfo, SearchOptions } from './types'

export interface MarkdownEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
  insertImage(src: string): void
  setLink(href: string, range?: { from: number; to: number }): void
  getSelection(): { from: number; to: number } | null
  /** 告知当前文档所在目录，用于解析文档里的相对图片路径 */
  setDocDir(dir: string | null): void
  search(options: SearchOptions): void
  searchNext(): void
  searchPrev(): void
  replaceCurrent(replacement: string): void
  replaceAll(replacement: string): void
  clearSearch(): void
}

// —— 查找：prosemirror-search 只提供命令与高亮，匹配数量需要自己遍历统计 ——

/** 当前查找条件变化或文档改动时触发，供适配器上报匹配数 */
let notifySearchChanged: (() => void) | null = null

/** 从元素向上找第一个可滚动的祖先（编辑器的滚动容器） */
function findScroller(from: HTMLElement | null): HTMLElement | null {
  for (let el = from; el; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return el
  }
  return null
}

/**
 * 把当前选区滚到视野内。
 *
 * findNext / findPrev 内部自带 scrollIntoView，但 ProseMirror 的 scrollToSelection
 * 会先看 DOM 选区是否落在编辑器里；查找框拿到焦点时编辑器是失焦的，于是**直接跳过滚动**，
 * 表现就是「按回车没反应、不跳位置」。这里按坐标手动滚，不依赖焦点。
 */
function scrollSelectionIntoView(view: EditorView): void {
  try {
    const scroller = findScroller(view.dom)
    if (!scroller) return
    const caret = view.coordsAtPos(view.state.selection.from)
    const box = scroller.getBoundingClientRect()
    if (caret.top < box.top || caret.bottom > box.bottom) {
      // 滚到垂直居中，长段落里也能看清
      scroller.scrollTop += caret.top - box.top - box.height / 2
    }
  } catch {
    // 位置异常（文档刚变化等）时忽略，不影响查找本身
  }
}

/** 统计匹配总数与当前序号（当前匹配即当前选区） */
function collectMatchInfo(state: EditorState): SearchInfo {
  const active = getSearchState(state)
  if (!active?.query.valid) return { total: 0, current: 0 }

  const { query } = active
  // 搜索范围未指定时视为整篇文档
  const range = active.range ?? { from: 0, to: state.doc.content.size }
  const { from: selFrom, to: selTo } = state.selection
  let total = 0
  let current = 0
  let pos = range.from

  while (pos <= range.to) {
    const hit = query.findNext(state, pos, range.to)
    if (!hit) break
    total += 1
    if (hit.from === selFrom && hit.to === selTo) current = total
    // 空匹配（纯正则）要往前推一格，否则原地死循环
    pos = hit.to > hit.from ? hit.to : hit.to + 1
  }
  return { total, current }
}

/** 把 prosemirror-search 的插件包成 Milkdown 插件 */
const searchExtension = $prose(() => searchPlugin())

/** 监听查找条件、文档与选区变化，向上报告匹配数 */
const searchReporter = $prose(
  () =>
    new Plugin({
      key: new PluginKey('MS_SEARCH_REPORTER'),
      view: () => ({
        update: (view, prev) => {
          if (!notifySearchChanged) return
          const before = getSearchState(prev)
          const after = getSearchState(view.state)
          const queryChanged = before?.query.eq(after?.query ?? before.query) === false
          // 选区变化也要上报：findNext/findPrev 只移动选区，查询与文档都没变，
          // 漏掉的话「当前第几个」会一直停在 0
          const selectionChanged = !prev.selection.eq(view.state.selection)
          if (view.state.doc !== prev.doc || queryChanged || selectionChanged) notifySearchChanged()
        }
      })
    })
)

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
  /** 斜杠菜单「图片」项被选中时回调（宿主弹出插入图片对话框） */
  onRequestImage?: () => void
  onSearchInfo?: (info: SearchInfo) => void
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
    .use(slashMenu({ onRequestImage: options.onRequestImage }))
    .use(selectionToolbar(options))
    .use(tableToolbar)
    .use(columnResizingPlugin)
    .use(wrapInTaskListCommand)
    .use(taskListToggle)
    .use(imageView)
    .use(codeHighlight)
    .use(mathPlugins)
    .use(mermaidPlugins)
    .use(searchExtension)
    .use(searchReporter)
    .create()

  editor.action((ctx) => {
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => onEdit(markdown))
  })

  // 查找状态或文档变化时，把最新匹配数报给查找条
  notifySearchChanged = () => {
    editor.action((ctx) => {
      options.onSearchInfo?.(collectMatchInfo(ctx.get(editorViewCtx).state))
    })
  }

  return {
    setContent: (md) => editor.action(replaceAll(md)),
    focus: () => editor.action((ctx) => ctx.get(editorViewCtx).focus()),
    destroy: () => editor.destroy(),
    insertImage: (src) =>
      editor.action((ctx) => {
        ctx.get(commandsCtx).call(insertImageCommand.key, { src })
        ctx.get(editorViewCtx).focus()
      }),
    setLink: (href, range) =>
      editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          // 弹窗打开期间编辑器失焦，实时选区已丢失；用请求时保存的 range 恢复选区，
          // 再走 toggleLinkCommand（与加粗/斜体同一套命令分发路径，最稳）。
          if (range && range.from !== range.to) {
            view.dispatch(
              view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to))
            )
          }
          ctx.get(commandsCtx).call(toggleLinkCommand.key, { href })
          view.focus()
        } catch (err) {
          console.error('[setLink] 加链接失败：', err, { href, range })
        }
      }),
    getSelection: () => {
      let range: { from: number; to: number } | null = null
      editor.action((ctx) => {
        const s = ctx.get(editorViewCtx).state.selection
        if (!s.empty) range = { from: s.from, to: s.to }
      })
      return range
    },
    setDocDir: (dir) => setImageDocDir(dir),

    // —— 查找 / 替换（命令与高亮由 prosemirror-search 提供） ——
    search: (options) =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const query = new SearchQuery({
          search: options.query,
          caseSensitive: options.caseSensitive
        })
        view.dispatch(setSearchState(view.state.tr, query))
        // 立刻跳到第一个匹配，便于看到位置；空查询则只清除
        if (query.valid) {
          findNext(view.state, view.dispatch, view)
          scrollSelectionIntoView(view)
        }
      }),

    searchNext: () =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        findNext(view.state, view.dispatch, view)
        scrollSelectionIntoView(view)
      }),

    searchPrev: () =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        findPrev(view.state, view.dispatch, view)
        scrollSelectionIntoView(view)
      }),

    replaceCurrent: (replacement) =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const active = getSearchState(view.state)
        if (!active?.query.valid) return
        // 替换文本存在查询对象里，命令从那里取
        const query = new SearchQuery({
          search: active.query.search,
          caseSensitive: active.query.caseSensitive,
          replace: replacement
        })
        view.dispatch(setSearchState(view.state.tr, query))
        replaceNext(view.state, view.dispatch, view)
        scrollSelectionIntoView(view)
      }),

    replaceAll: (replacement) =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const active = getSearchState(view.state)
        if (!active?.query.valid) return
        const query = new SearchQuery({
          search: active.query.search,
          caseSensitive: active.query.caseSensitive,
          replace: replacement
        })
        view.dispatch(setSearchState(view.state.tr, query))
        replaceAllMatches(view.state, view.dispatch, view)
        scrollSelectionIntoView(view)
      }),

    clearSearch: () =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(setSearchState(view.state.tr, new SearchQuery({ search: '' })))
      })
  }
}
