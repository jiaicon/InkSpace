// 主进程与渲染进程共享的类型定义（两端都能 import，保证 IPC 契约一致）

/** 系统信息（system 模块） */
export interface SystemInfo {
  platform: string
  arch: string
  appVersion: string
  electron: string
  node: string
  chrome: string
}

/** IPC 统一返回结构：主进程永不 throw，错误以 error 字段返回 */
export interface IpcResult<T> {
  ok: boolean
  data?: T
  error?: string
}

/** 文件树节点（file 为叶，directory 有 children） */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

/** 最近打开的一条记录 */
export interface RecentFile {
  path: string
  title: string
  lastOpenedAt: number // epoch 毫秒
}

/** 工作区信息：根路径 + 文件树 */
export interface WorkspaceInfo {
  path: string
  tree: FileTreeNode[]
}

/** 导出入参（export 模块）：把当前文档交给主进程渲染落盘 */
export interface ExportRequest {
  /** 当前文档的 Markdown 源码 */
  markdown: string
  /** 源文档路径；未保存过为 null（影响相对图片解析与默认文件名） */
  sourcePath: string | null
  /** 文档标题（文件名去掉扩展名），用于 <title> 与默认文件名 */
  title: string
}

export type ThemeMode = 'light' | 'dark'

/** 图片存放策略：统一目录（绝对路径）/ 随文档（相对路径，可迁移） */
export type ImageStorageMode = 'unified' | 'relative'

/** 应用设置（settings 模块，存于 settings KV 表） */
export interface AppSettings {
  theme: ThemeMode
  imageStorage: ImageStorageMode
  /** 统一目录模式的绝对路径 */
  imageDir: string
  /** 随文档模式下的子目录名（相对文档目录） */
  imageSubdir: string
  /** 代码块主题 id；'auto' 表示跟随明暗自动挑选 */
  highlightTheme: string
  /** mermaid 图表主题 id；'auto' 表示跟随明暗自动挑选 */
  mermaidTheme: string
  /** Markdown 主题 id；'auto' 表示不套主题、跟随基础亮暗 */
  markdownTheme: string
}

/** 一个 Markdown 主题的元信息（内置或自定义） */
export interface MarkdownThemeInfo {
  id: string
  name: string
  description?: string
  /** 内置主题写在代码里，自定义主题来自 userData/themes/<id>/ */
  builtin: boolean
}

/** 全局搜索的一条命中：行号从 1 起；text 是裁剪过的上下文，column 是命中在该文本里的起始列 */
export interface SearchMatch {
  line: number
  text: string
  column: number
}

/** 全局搜索中某个文件的全部命中 */
export interface SearchFileResult {
  path: string
  name: string
  matches: SearchMatch[]
}

/** 全局搜索结果；truncated 表示命中数达到上限、结果被截断 */
export interface SearchResponse {
  files: SearchFileResult[]
  totalMatches: number
  truncated: boolean
}
