import { hasMermaidContent, mermaidErrorMessage } from '@shared/mermaid'

/** 导出 HTML 里 mermaid 代码块的外形（class 顺序不固定，所以宽松匹配） */
const MERMAID_BLOCK_RE =
  /<pre><code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/g

/** 还原 HTML 实体：代码块内容被 rehype-stringify 转义过，交给 mermaid 前必须还原 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 文档里是否有 mermaid 块——没有就不必去启隐藏窗口渲染 */
export function hasMermaid(html: string): boolean {
  return new RegExp(MERMAID_BLOCK_RE.source).test(html)
}

/**
 * 把导出 HTML 里的 mermaid 代码块换成渲染好的 SVG。
 *
 * 渲染器由调用方注入（主进程用隐藏窗口跑 mermaid），这里只管「找出来、换进去」，
 * 因此可以脱离 Electron 单测。渲染失败的块降级成一段错误提示，不影响整篇导出。
 */
export async function renderMermaidBlocks(
  html: string,
  render: (code: string) => Promise<string>
): Promise<string> {
  const blocks = [...html.matchAll(MERMAID_BLOCK_RE)]
  if (blocks.length === 0) return html

  // 串行渲染：mermaid 渲染要往 DOM 里插临时节点测量，并行容易互相干扰
  const replacements: string[] = []
  for (const block of blocks) {
    const code = decodeHtmlEntities(block[1]).trim()
    // 空块（含只有零宽字符的情况）不送去渲染：mermaid 只会报「看不出图表类型」
    if (!hasMermaidContent(code)) {
      replacements.push('<div class="ms-mermaid-error">空图表</div>')
      continue
    }
    try {
      const svg = await render(code)
      replacements.push(`<div class="ms-mermaid-diagram">${svg}</div>`)
    } catch (err) {
      replacements.push(
        `<div class="ms-mermaid-error">${escapeHtml(mermaidErrorMessage(err))}</div>`
      )
    }
  }

  let index = 0
  return html.replace(MERMAID_BLOCK_RE, () => replacements[index++])
}
