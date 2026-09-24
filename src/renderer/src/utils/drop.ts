const MARKDOWN_RE = /\.(?:md|markdown)$/i
const IMAGE_RE = /\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i

export interface DroppedPaths {
  markdown: string[]
  images: string[]
  unsupported: string[]
}

/**
 * 按扩展名把拖入/粘贴进来的文件分成三类。
 * 拖拽打开文档与拖拽插入图片共用同一个落点，靠这里分流，避免互相抢事件。
 */
export function classifyDroppedPaths(paths: string[]): DroppedPaths {
  const result: DroppedPaths = { markdown: [], images: [], unsupported: [] }
  for (const path of paths) {
    if (!path) {
      result.unsupported.push(path)
    } else if (MARKDOWN_RE.test(path)) {
      result.markdown.push(path)
    } else if (IMAGE_RE.test(path)) {
      result.images.push(path)
    } else {
      result.unsupported.push(path)
    }
  }
  return result
}
