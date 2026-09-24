import { app, BrowserWindow, dialog } from 'electron'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ExportRequest } from '@shared/types'
import { buildExportHtml } from './compose'

// A4 + 0.6 英寸页边距（Electron 的 margins 单位为英寸）
const PDF_MARGINS = { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }

const FILTERS: Record<'html' | 'pdf', { name: string; extensions: string[] }[]> = {
  html: [{ name: 'HTML 文档', extensions: ['html'] }],
  pdf: [{ name: 'PDF 文档', extensions: ['pdf'] }]
}

/** 去掉文件名里的非法字符，避免默认路径写入失败 */
function safeFileName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名'
  return `${base}.${ext}`
}

/** 默认输出到源文档同目录同名（换个扩展名）；文档未保存过则落到「文档」目录 */
function suggestPath(req: ExportRequest, ext: 'html' | 'pdf'): string {
  if (req.sourcePath) {
    const stem = basename(req.sourcePath, extname(req.sourcePath))
    return join(dirname(req.sourcePath), `${stem}.${ext}`)
  }
  return join(app.getPath('documents'), safeFileName(req.title, ext))
}

async function pickTarget(req: ExportRequest, ext: 'html' | 'pdf'): Promise<string | null> {
  const res = await dialog.showSaveDialog({
    title: ext === 'html' ? '导出为 HTML' : '导出为 PDF',
    defaultPath: suggestPath(req, ext),
    filters: [...FILTERS[ext]]
  })
  return res.canceled || !res.filePath ? null : res.filePath
}

/**
 * 用隐藏窗口打印 PDF。
 * HTML 先落到临时文件再 loadFile：内嵌图片后文档可能很大，data: URL 有长度上限。
 * 页面脚本禁用——导出物里的任何脚本都不该在打印时执行。
 */
async function renderPdf(html: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'ms-export-'))
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false }
  })
  try {
    const file = join(dir, 'export.html')
    await writeFile(file, html, 'utf8')
    await win.loadFile(file)
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: PDF_MARGINS
    })
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await rm(dir, { recursive: true, force: true })
  }
}

/** 导出服务：先让用户确认保存位置，再渲染写盘，取消则不做无用功 */
export function createExportService() {
  return {
    async exportHtml(req: ExportRequest): Promise<string | null> {
      const target = await pickTarget(req, 'html')
      if (!target) return null
      await writeFile(target, await buildExportHtml(req), 'utf8')
      return target
    },

    async exportPdf(req: ExportRequest): Promise<string | null> {
      const target = await pickTarget(req, 'pdf')
      if (!target) return null
      await writeFile(target, await renderPdf(await buildExportHtml(req)))
      return target
    }
  }
}
