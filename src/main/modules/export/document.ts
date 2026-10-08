import exportCss from './export.css?raw'

export interface ExportDocumentOptions {
  /** 文档标题，写入 <title> 与文件名建议 */
  title: string
  /** 已渲染的正文 HTML */
  body: string
  /** Markdown 主题 CSS（空串表示不套主题） */
  markdownThemeCss: string
  /** 代码块主题 CSS */
  codeThemeCss: string
  /** KaTeX 样式（含内联字体）；文档里没有公式时为空串 */
  katexCss: string
}

/** 转义 HTML 元字符，避免标题里的 < > & " ' 破坏文档结构 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 把正文 HTML 包装成自包含的完整 HTML 文档。
 * 样式内联、图片走 data URI（见 images.ts），因此导出文件可离线打开、可直接分享。
 *
 * 正文外套一层 `.milkdown > .editor`：与编辑器里的容器类名一致，这样 Markdown 主题
 * 只需写一份 `.milkdown { --ms-*: … }`，编辑器和导出就同时生效。
 */
export function buildExportDocument({
  title,
  body,
  markdownThemeCss,
  codeThemeCss,
  katexCss
}: ExportDocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${exportCss}
${katexCss}
${markdownThemeCss}
${codeThemeCss}</style>
</head>
<body>
<div class="milkdown">
<div class="editor">
<article class="markdown-body">
${body}
</article>
</div>
</div>
</body>
</html>
`
}
