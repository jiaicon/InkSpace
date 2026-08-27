export type EditorMode = 'wysiwyg' | 'source'

export interface OutlineNode {
  id: string
  level: number
  text: string
}

export interface EditorProps {
  initialMarkdown: string
  onChange: (md: string) => void
  onChangeDirty: (dirty: boolean) => void
  onModeChange?: (mode: EditorMode) => void
  onOutlineChange?: (outline: OutlineNode[]) => void
}

export interface EditorHandle {
  getMarkdown(): string
  setMarkdown(md: string): void
  markSaved(): void
  getMode(): EditorMode
  setMode(mode: EditorMode): void
  focus(): void
}
