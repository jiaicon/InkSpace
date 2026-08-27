import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Heading } from 'mdast'
import type { OutlineNode } from './types'

export function buildAnchorId(index: number): string {
  return `h-${index}`
}

export function parseOutline(markdown: string): OutlineNode[] {
  const tree = remark().use(remarkGfm).parse(markdown)
  const outline: OutlineNode[] = []
  visit(tree, 'heading', (node) => {
    const heading = node as Heading
    const text = toString(heading)
    if (text.trim()) {
      outline.push({ id: buildAnchorId(outline.length), level: heading.depth, text })
    }
  })
  return outline
}
