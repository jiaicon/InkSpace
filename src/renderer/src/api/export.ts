import type { ExportRequest } from '@shared/types'
import { unwrap } from './util'

/** export 模块的渲染进程 API 封装；返回保存路径，用户取消为 null */
export const exportApi = {
  html: (req: ExportRequest) => unwrap<string | null>(window.api.export.html(req)),
  pdf: (req: ExportRequest) => unwrap<string | null>(window.api.export.pdf(req))
}
