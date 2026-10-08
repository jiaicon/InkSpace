import { dirname } from 'node:path'
import type { ExportRequest } from '@shared/types'
import { buildExportDocument } from './document'
import { inlineLocalImages } from './images'
import { hasMath } from './katexCss'
import { hasMermaid, renderMermaidBlocks } from './mermaidBlocks'
import { renderMarkdownToHtml } from './render'

/** 导出时注入的两套主题 CSS（由调用方按当前设置解析后传入） */
export interface ExportThemeCss {
  /** Markdown 主题；空串表示不套主题 */
  markdown: string
  /** 代码块主题 */
  code: string
}

/**
 * 需要时才用到的外部资源（都由调用方注入，因此本模块不依赖 electron，可单测）：
 * 文档里没有公式/图表时，对应的回调根本不会被调用。
 */
export interface ExportRenderers {
  /** 取 KaTeX 样式（含内联字体） */
  katexCss?: () => Promise<string>
  /** 把 mermaid 源码渲染成 SVG */
  mermaid?: (code: string) => Promise<string>
}

/**
 * 内容管线：Markdown → 正文 HTML → 渲染图表 → 内嵌本地图片 → 自包含的完整 HTML 文档。
 * 落盘/打印等 IO 由 service.ts 负责。
 */
export async function buildExportHtml(
  req: ExportRequest,
  themes: ExportThemeCss,
  renderers: ExportRenderers = {}
): Promise<string> {
  let body = await renderMarkdownToHtml(req.markdown)
  // 图表要在内嵌图片之前渲染成 SVG，SVG 里的图片才能一并被内联
  if (renderers.mermaid && hasMermaid(body)) {
    body = await renderMermaidBlocks(body, renderers.mermaid)
  }
  const baseDir = req.sourcePath ? dirname(req.sourcePath) : null
  const inlined = await inlineLocalImages(body, baseDir)
  const katex = renderers.katexCss && hasMath(inlined) ? await renderers.katexCss() : ''
  return buildExportDocument({
    title: req.title,
    body: inlined,
    markdownThemeCss: themes.markdown,
    codeThemeCss: themes.code,
    katexCss: katex
  })
}
