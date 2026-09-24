import { $view } from '@milkdown/kit/utils'
import { imageSchema } from '@milkdown/kit/preset/commonmark'
import type { Node } from '@milkdown/kit/prose/model'
import { buildImageSrc } from '../utils/image'

// 当前编辑文档所在目录：图片 nodeView 靠它把 `./assets/x.png` 解析成 ms-file URL。
// 应用只有一个编辑器实例，切换文档时由 Editor.setDocDir 更新；setMarkdown 会重建整篇
// 文档的 nodeView，因此「先 setDocDir 再 setMarkdown」即可保证用上最新目录。
let currentDocDir: string | null = null

export function setImageDocDir(dir: string | null): void {
  currentDocDir = dir
}

/** 自定义图片渲染：显示时把相对路径解析为可加载 URL，markdown 里仍保留相对路径 */
export const imageView = $view(imageSchema.node, () => (node) => {
  const dom = document.createElement('img')

  const apply = (n: Node): void => {
    dom.src = buildImageSrc(String(n.attrs.src ?? ''), currentDocDir)
    dom.alt = String(n.attrs.alt ?? '')
    const title = n.attrs.title
    if (title) dom.title = String(title)
    else dom.removeAttribute('title')
  }
  apply(node)

  return {
    dom,
    update: (next: Node) => {
      // 换节点类型时交回 ProseMirror 重建
      if (next.type !== node.type) return false
      apply(next)
      return true
    },
    ignoreMutation: () => true
  }
})
