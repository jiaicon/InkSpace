import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { addHljsClassToCodeBlocks, type HastNode } from './ensureCodeClass'
import { transformCallouts } from './calloutBlocks'
import { addHeadingIds } from './headingIds'
import { collectHastHeadings, replaceTocPlaceholder } from './tocBlocks'

/**
 * 给所有代码块补上 hljs 类。
 * rehype-highlight 只处理标注了语言的代码块，没标注的不会被打上 hljs 类，
 * 而代码主题的底色/内边距/文字色都依赖这个类——不补就会完全没有样式。
 */
function rehypeEnsureHljsClass() {
  return (tree: HastNode): void => addHljsClassToCodeBlocks(tree)
}

/**
 * 把 `> [!TYPE]` 的引用块换成带样式的 div.callout。
 * 放在 hljs 补类之后：块内的代码块先拿到 hljs 类，再整体被搬进 div，互不干扰。
 */
function rehypeCallouts() {
  return (tree: HastNode): void => transformCallouts(tree)
}

/**
 * 给标题加锚点 id。必须在 TOC 替换之前跑 —— 目录链接要用到这些 id。
 * 注意：这会让**所有**导出产物的标题带上 id（spec §5.3 已记录的唯一既有产物变化）。
 */
function rehypeHeadingIds() {
  return (tree: HastNode): void => addHeadingIds(tree)
}

/** 把根层 `[TOC]` 段落换成 nav.toc 嵌套列表 */
function rehypeToc() {
  return (tree: HastNode): void => {
    replaceTocPlaceholder(tree, collectHastHeadings(tree))
  }
}

/**
 * 把 Markdown 渲染成正文 HTML 片段（GFM 方言 + 代码块高亮，与编辑器一致）。
 *
 * 管线刻意不用 `remark-html`：它把「mdast → hast → html」包成一步，中间插不进
 * rehype 插件（高亮就在这一步）。官方也建议正式项目直接用这三件套。
 *
 * `allowDangerousHtml` 是刻意的：默认会丢掉正文里的原始 HTML，而这里导出的是
 * 用户自己的本地文档、内容本就受信，与 Typora 行为一致。
 *
 * rehype-highlight 默认 `detect: false` + `common` 语言集，与编辑器同一套：
 * 只在代码块标注了语言时高亮，不猜语言。
 * remark-math + rehype-katex 把 `$...$` / `$$...$$` 渲染成与编辑器一致的 KaTeX 公式；
 * 其样式与字体由 compose 侧按「文档里是否有公式」决定是否内联。
 */
export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight)
    .use(rehypeEnsureHljsClass)
    .use(rehypeCallouts)
    .use(rehypeHeadingIds)
    .use(rehypeToc)
    .use(rehypeKatex)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown)
  return String(file).trim()
}
