import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { imageMime } from '../file/assets'

// 只处理 <img> 上的 src，避免误伤 video/script 等标签
const IMG_SRC_RE = /<img\b[^>]*?\bsrc="([^"]*)"/g
// 远程 / 浏览器可直接加载的地址，无需也不应内嵌
const REMOTE_RE = /^(?:https?:|data:|file:|blob:|mailto:|ftp:|\/\/)/i

function decodePath(src: string): string {
  try {
    return decodeURIComponent(src)
  } catch {
    // 含非法百分号转义时按原样处理
    return src
  }
}

/** 读本地图片并编码成 data URI；读不到（缺失/无权限/非图片）返回 null */
async function readAsDataUri(src: string, baseDir: string): Promise<string | null> {
  const decoded = decodePath(src)
  const abs = isAbsolute(decoded) ? decoded : resolve(baseDir, decoded)
  const mime = imageMime(abs)
  if (!mime) return null
  try {
    const buf = await readFile(abs)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * 把正文 HTML 里引用的本地图片内嵌成 base64 data URI，使导出文件自包含、可离线分享。
 * 远程地址、data URI、非图片资源，以及读不到的本地图片都原样保留（不阻断导出）。
 * baseDir 为源文档所在目录；文档尚未保存过（null）时无从解析相对路径，直接原样返回。
 */
export async function inlineLocalImages(html: string, baseDir: string | null): Promise<string> {
  if (!baseDir) return html

  const srcs = [...html.matchAll(IMG_SRC_RE)].map((m) => m[1])
  if (srcs.length === 0) return html

  const inlined = new Map<string, string>()
  for (const src of new Set(srcs)) {
    if (!src || REMOTE_RE.test(src)) continue
    const dataUri = await readAsDataUri(src, baseDir)
    if (dataUri) inlined.set(src, dataUri)
  }
  if (inlined.size === 0) return html

  return html.replace(IMG_SRC_RE, (tag, src: string) => {
    const dataUri = inlined.get(src)
    return dataUri ? tag.replace(/src="[^"]*"/, `src="${dataUri}"`) : tag
  })
}
