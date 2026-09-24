import { IPC } from '@shared/ipc'
import type { ExportRequest } from '@shared/types'
import { handle } from '../../ipc/util'
import { createExportService } from './service'

/** 注册 export 模块的 IPC handler（导出为 HTML / PDF） */
export function registerExportIpc(): void {
  const svc = createExportService()

  handle(IPC.exportHtml, (req) => svc.exportHtml(req as ExportRequest))
  handle(IPC.exportPdf, (req) => svc.exportPdf(req as ExportRequest))
}
