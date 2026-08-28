import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export interface SourceEditorAdapter {
  setContent(md: string): void
  focus(): void
  destroy(): void
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
    destroy: () => view.destroy()
  }
}
