/** 图片扩展名别名归一（jpeg → jpg），与主进程白名单保持一致 */
const EXT_ALIAS: Record<string, string> = { jpeg: 'jpg' }

/** 粘贴的截图常没有文件名，只能靠 MIME 推断扩展名 */
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/avif': 'avif'
}

const ALLOWED = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

/** 从文件名或 MIME 推断图片扩展名；都不是受支持的图片类型时返回 null */
export function extFromImageFile(name: string, mime: string): string | null {
  const fromName = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()
  const candidate = fromName ?? MIME_EXT[mime.toLowerCase()]
  if (!candidate || !ALLOWED.has(candidate)) return null
  return EXT_ALIAS[candidate] ?? candidate
}

/**
 * 编辑器里显示图片用的 src。
 * 相对于文档目录的本地图片走自定义协议 ms-file（渲染进程的页面地址不是文档路径，
 * 相对路径直接交给 <img> 会解析到应用目录上）；网络地址等直接原样返回。
 */
export function buildImageSrc(rawSrc: string, docDir: string | null): string {
  if (!rawSrc) return rawSrc
  if (/^(?:https?:|data:|blob:|file:|ms-file:)/i.test(rawSrc)) return rawSrc
  if (!docDir) return rawSrc
  return `ms-file://local/?dir=${encodeURIComponent(docDir)}&p=${encodeURIComponent(rawSrc)}`
}
