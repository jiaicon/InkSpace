import { dirname } from 'node:path'
import type { ExportRequest } from '@shared/types'
import { buildExportDocument } from './document'
import { inlineLocalImages } from './images'
import { renderMarkdownToHtml } from './render'

/** 导出时注入的两套主题 CSS（由调用方按当前设置解析后传入） */
export interface ExportThemeCss {
  /** Markdown 主题；空串表示不套主题 */
  markdown: string
  /** 代码块主题 */
  code: string
}

/**
 * 内容管线：Markdown → 正文 HTML → 内嵌本地图片 → 自包含的完整 HTML 文档。
 * 刻意不引入 electron，便于单测；落盘/打印等 IO 由 service.ts 负责。
 */
export async function buildExportHtml(req: ExportRequest, themes: ExportThemeCss): Promise<string> {
  const body = await renderMarkdownToHtml(req.markdown)
  const baseDir = req.sourcePath ? dirname(req.sourcePath) : null
  const inlined = await inlineLocalImages(body, baseDir)
  return buildExportDocument({
    title: req.title,
    body: inlined,
    markdownThemeCss: themes.markdown,
    codeThemeCss: themes.code
  })
}
