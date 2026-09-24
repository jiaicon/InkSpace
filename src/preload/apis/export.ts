import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { ExportRequest } from '@shared/types'

/** export 模块的 preload api */
export const exportApi = {
  html: (req: ExportRequest) => ipcRenderer.invoke(IPC.exportHtml, req),
  pdf: (req: ExportRequest) => ipcRenderer.invoke(IPC.exportPdf, req)
}
