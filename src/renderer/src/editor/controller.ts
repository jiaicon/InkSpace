import type { EditorMode } from './types'

export interface EditorController {
  getMarkdown(): string
  setMarkdown(md: string): void
  markSaved(): void
  getMode(): EditorMode
  setMode(mode: EditorMode): void
  isDirty(): boolean
  applyEdit(md: string): void
}

export interface EditorControllerHooks {
  onChange: (md: string) => void
  onChangeDirty: (dirty: boolean) => void
  onModeChange: (mode: EditorMode) => void
}

export function createEditorController(
  initialMarkdown: string,
  hooks: EditorControllerHooks
): EditorController {
  let markdown = initialMarkdown
  let baseline = initialMarkdown
  let mode: EditorMode = 'wysiwyg'
  let dirty = false

  function setDirty(next: boolean): void {
    if (next !== dirty) {
      dirty = next
      hooks.onChangeDirty(dirty)
    }
  }

  return {
    getMarkdown: () => markdown,
    setMarkdown: (md) => {
      markdown = md
      baseline = md
      setDirty(false)
    },
    markSaved: () => {
      baseline = markdown
      setDirty(false)
    },
    getMode: () => mode,
    setMode: (m) => {
      if (m !== mode) {
        mode = m
        hooks.onModeChange(m)
      }
    },
    isDirty: () => dirty,
    applyEdit: (md) => {
      if (md === markdown) return
      markdown = md
      setDirty(md !== baseline)
      hooks.onChange(md)
    }
  }
}
