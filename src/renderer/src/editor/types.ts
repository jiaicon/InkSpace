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
  /** 选中工具条「链接」按钮被点击时回调（宿主据此弹出链接对话框） */
  onRequestLink?: () => void
}

export interface EditorHandle {
  getMarkdown(): string
  setMarkdown(md: string): void
  markSaved(): void
  getMode(): EditorMode
  setMode(mode: EditorMode): void
  focus(): void
  /** 滚动到第 index 个标题（wysiwyg 模式有效） */
  scrollToHeading(index: number): void
  /** 在当前光标处插入图片（src 为 URL） */
  insertImage(src: string): void
  /** 给指定选区加链接；range 缺省时用当前选区（无选区则无操作） */
  setLink(href: string, range?: { from: number; to: number }): void
  /** 当前文本选区；无选区返回 null */
  getSelection(): { from: number; to: number } | null
}
