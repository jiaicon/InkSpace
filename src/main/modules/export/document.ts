import exportCss from './export.css?raw'

export interface ExportDocumentOptions {
  /** 文档标题，写入 <title> 与文件名建议 */
  title: string
  /** 已渲染的正文 HTML */
  body: string
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
 */
export function buildExportDocument({ title, body }: ExportDocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${exportCss}</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>
`
}
