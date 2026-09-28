export type EditorMode = 'wysiwyg' | 'source'

export interface OutlineNode {
  id: string
  level: number
  text: string
}

export interface EditorProps {
  initialMarkdown: string
  /** 当前文档所在目录，用于解析文档里的相对图片路径；未保存过为 null */
  docDir?: string | null
  onChange: (md: string) => void
  onChangeDirty: (dirty: boolean) => void
  onModeChange?: (mode: EditorMode) => void
  onOutlineChange?: (outline: OutlineNode[]) => void
  /** 选中工具条「链接」按钮被点击时回调（宿主据此弹出链接对话框） */
  onRequestLink?: () => void
  /** 查找状态变化（匹配数/当前序号）时回调，供查找条展示 */
  onSearchInfo?: (info: SearchInfo) => void
}

/** 查找条件 */
export interface SearchOptions {
  query: string
  caseSensitive: boolean
}

/** 查找结果概览：total 为匹配总数，current 为当前是第几个（1 起；无当前匹配为 0） */
export interface SearchInfo {
  total: number
  current: number
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
  /** 告知当前文档所在目录（用于把相对图片路径解析为可加载 URL）；未保存过传 null */
  setDocDir(dir: string | null): void

  /** 设置查找条件；query 为空表示清除查找。两种编辑模式行为一致 */
  search(options: SearchOptions): void
  searchNext(): void
  searchPrev(): void
  /** 替换当前匹配并跳到下一个 */
  replaceCurrent(replacement: string): void
  replaceAll(replacement: string): void
  clearSearch(): void
}
