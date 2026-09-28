import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import {
  search,
  SearchQuery,
  setSearchQuery,
  getSearchQuery,
  findNext,
  findPrevious,
  replaceNext as cmReplaceNext,
  replaceAll as cmReplaceAll
} from '@codemirror/search'
import type { SearchInfo, SearchOptions } from './types'

export interface SourceEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
  insertImage(src: string): void
  setLink(href: string, range?: { from: number; to: number }): void
  getSelection(): { from: number; to: number } | null
  setDocDir(dir: string | null): void
  search(options: SearchOptions): void
  searchNext(): void
  searchPrev(): void
  replaceCurrent(replacement: string): void
  replaceAll(replacement: string): void
  clearSearch(): void
}

/** 统计匹配总数与当前序号（当前匹配即当前选区） */
function collectMatchInfo(view: EditorView): SearchInfo {
  const query = getSearchQuery(view.state)
  if (!query.valid) return { total: 0, current: 0 }

  const { from: selFrom, to: selTo } = view.state.selection.main
  let total = 0
  let current = 0
  // CM 的 cursor 类型只声明了 next()，用 while 而不是 for...of
  const cursor = query.getCursor(view.state)
  for (let hit = cursor.next(); !hit.done; hit = cursor.next()) {
    total += 1
    if (hit.value.from === selFrom && hit.value.to === selTo) current = total
  }
  return { total, current }
}

/**
 * 把当前匹配滚到视野内。
 * CodeMirror 的命令自带 scrollToMatch，但编辑器失焦时（焦点在查找框）不一定生效，
 * 表现就是「按回车不跳位置」。这里按坐标兜底，两种焦点状态下都能跳到位。
 */
function scrollSelectionIntoView(view: EditorView): void {
  try {
    const head = view.state.selection.main.head
    const caret = view.coordsAtPos(head)
    if (!caret) return
    const box = view.scrollDOM.getBoundingClientRect()
    if (caret.top < box.top || caret.bottom > box.bottom) {
      // 滚到垂直居中
      view.scrollDOM.scrollTop += caret.top - box.top - box.height / 2
    }
  } catch {
    // 位置异常时忽略，不影响查找本身
  }
}

export function createCodeMirrorEditor(
  parent: HTMLElement,
  initialMarkdown: string,
  onEdit: (md: string) => void,
  onSearchInfo?: (info: SearchInfo) => void
): SourceEditorAdapter {
  let suppress = false

  const state = EditorState.create({
    doc: initialMarkdown,
    extensions: [
      lineNumbers(),
      EditorView.lineWrapping,
      history(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown(),
      // 只用它的查询状态与匹配高亮；不挂 searchKeymap、也不调 openSearchPanel，
      // 面板就不会出现——查找 UI 由应用自己的查找条统一提供，两种编辑模式才一致
      search(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppress) {
          onEdit(update.state.doc.toString())
        }
        // 文档、选区变化都会改变匹配数/当前序号；
        // 只改查找条件（setSearchQuery 效果）时两个标志都不置位，必须单独判断，
        // 否则「查不到结果」时会一直显示上一次的数字
        const queryTouched = update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(setSearchQuery))
        )
        if (update.docChanged || update.selectionSet || queryTouched) {
          onSearchInfo?.(collectMatchInfo(update.view))
        }
      })
    ]
  })

  const view = new EditorView({ state, parent })

  const applyQuery = (query: SearchQuery): void => {
    view.dispatch({ effects: setSearchQuery.of(query) })
  }

  /** 用当前查找条件 + 新的替换文本重建查询 */
  const queryWithReplacement = (replacement: string): SearchQuery | null => {
    const current = getSearchQuery(view.state)
    if (!current.valid) return null
    return new SearchQuery({
      search: current.search,
      caseSensitive: current.caseSensitive,
      replace: replacement
    })
  }

  return {
    setContent: (md) => {
      suppress = true
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: md } })
      suppress = false
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    insertImage: (src) => {
      const { from, to } = view.state.selection.main
      view.dispatch({ changes: { from, to, insert: `![](${src})` } })
      view.focus()
    },
    setLink: (href, range) => {
      const from = range ? range.from : view.state.selection.main.from
      const to = range ? range.to : view.state.selection.main.to
      const text = view.state.doc.sliceString(from, to)
      view.dispatch({ changes: { from, to, insert: `[${text}](${href})` } })
      view.focus()
    },
    getSelection: () => {
      const { from, to } = view.state.selection.main
      return from === to ? null : { from, to }
    },
    // 源码模式显示的是原始 markdown 文本，没有图片需要解析，无需处理
    setDocDir: () => {},

    // —— 查找 / 替换 ——
    search: (options) => {
      const query = new SearchQuery({
        search: options.query,
        caseSensitive: options.caseSensitive
      })
      applyQuery(query)
      if (query.valid) {
        findNext(view)
        scrollSelectionIntoView(view)
      }
    },
    searchNext: () => {
      findNext(view)
      scrollSelectionIntoView(view)
    },
    searchPrev: () => {
      findPrevious(view)
      scrollSelectionIntoView(view)
    },
    replaceCurrent: (replacement) => {
      const query = queryWithReplacement(replacement)
      if (!query) return
      applyQuery(query)
      cmReplaceNext(view)
      scrollSelectionIntoView(view)
    },
    replaceAll: (replacement) => {
      const query = queryWithReplacement(replacement)
      if (!query) return
      applyQuery(query)
      cmReplaceAll(view)
      scrollSelectionIntoView(view)
    },
    clearSearch: () => {
      applyQuery(new SearchQuery({ search: '' }))
    }
  }
}
