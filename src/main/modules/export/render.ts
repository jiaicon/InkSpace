import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

/**
 * 把 Markdown 渲染成正文 HTML 片段（GFM 方言，与编辑器一致）。
 *
 * `sanitize: false` 是刻意的：默认开启的 rehype-sanitize 会剥掉 GFM 任务列表的
 * checkbox、`task-list-item` 类名和表格的 align 属性；而导出的是用户自己的本地文档、
 * 内容本就受信，与 Typora 的行为一致。该选项同时打开原始 HTML 透传。
 */
export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const file = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(markdown)
  return String(file).trim()
}
