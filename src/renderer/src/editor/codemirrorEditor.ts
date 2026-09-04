import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export interface SourceEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
  insertImage(src: string): void
  setLink(href: string, range?: { from: number; to: number }): void
  getSelection(): { from: number; to: number } | null
}

export function createCodeMirrorEditor(
  parent: HTMLElement,
  initialMarkdown: string,
  onEdit: (md: string) => void
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
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppress) {
          onEdit(update.state.doc.toString())
        }
      })
    ]
  })

  const view = new EditorView({ state, parent })

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
    }
  }
}
