import type { MarkdownThemeInfo } from '@shared/types'
import { unwrap } from './util'

/** themes 模块的渲染进程 API 封装 */
export const themesApi = {
  list: () => unwrap<MarkdownThemeInfo[]>(window.api.themes.list()),
  getCss: (id: string) => unwrap<string | null>(window.api.themes.getCss(id)),
  /** 弹出文件选择框导入 .css；用户取消返回 null */
  import: () => unwrap<MarkdownThemeInfo | null>(window.api.themes.import()),
  /** 弹出保存框导出主题；用户取消返回 null */
  export: (id: string) => unwrap<string | null>(window.api.themes.export(id)),
  reveal: () => unwrap<void>(window.api.themes.reveal())
}
