import { basename, dirname, extname, join } from 'node:path'
import type { AppSettings } from '@shared/types'

/** 可作为文档资源读写的图片扩展名（ms-file 协议与保存图片共用同一份白名单） */
export const IMAGE_EXTS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif'
] as const

export function isAllowedImageExt(ext: string): boolean {
  return (IMAGE_EXTS as readonly string[]).includes(ext.toLowerCase())
}

/** 图片扩展名 → MIME（保存图片与 ms-file 协议、导出内嵌共用同一份映射） */
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif'
}

/** 按路径推断图片 MIME；不在白名单内返回 null */
export function imageMime(path: string): string | null {
  const ext = extname(path).slice(1).toLowerCase()
  return MIME[ext] ?? null
}

/** 按扩展名判断是否允许访问的图片路径 */
export function isAllowedImagePath(path: string): boolean {
  const ext = extname(path).slice(1)
  return ext !== '' && isAllowedImageExt(ext)
}

/** 本地时间格式化为 yyyyMMddHHmmss，用作图片文件名的时间戳部分 */
export function formatStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    String(date.getFullYear()) +
    p(date.getMonth() + 1) +
    p(date.getDate()) +
    p(date.getHours()) +
    p(date.getMinutes()) +
    p(date.getSeconds())
  )
}

/**
 * 图片存到文档旁的 assets/ 子目录，返回写进 markdown 的相对路径。
 * 用正斜杠：markdown 里应保持平台无关，也便于导出时按相对路径解析。
 */
export function buildImageRelPath(
  ext: string,
  stamp: string,
  rand: string,
  subdir = 'assets'
): string {
  return `./${subdir}/image-${stamp}-${rand}.${ext}`
}

/** 取文档名（不含扩展名）并清掉文件名非法字符，用作统一目录下的图片名前缀 */
export function docStem(docPath: string): string {
  const raw = basename(docPath, extname(docPath))
  const safe = raw.replace(/[\\/:*?"<>|]/g, '_').trim()
  return safe || 'doc'
}

export type ImagePlacementSettings = Pick<AppSettings, 'imageStorage' | 'imageDir' | 'imageSubdir'>

export interface ImagePlacementOptions {
  docPath: string
  settings: ImagePlacementSettings
  ext: string
  stamp: string
  rand: string
}

export interface ImagePlacement {
  /** 实际写入的绝对路径 */
  absPath: string
  /** 写进 markdown 的引用；一律正斜杠，跨平台且 markdown 友好 */
  refPath: string
}

/**
 * 按设置决定图片落在哪、以及 markdown 里写什么路径。
 *
 * - 统一目录：所有文档的图片集中到 imageDir（绝对路径），引用写绝对路径。
 *   markdown 因此不再可迁移（换机器/发给别人会裂图），这是该模式的固有代价。
 * - 随文档：图片放文档旁的子目录，引用写相对路径，文档整包搬走仍可用。
 */
export function planImagePlacement(o: ImagePlacementOptions): ImagePlacement {
  const { docPath, settings, ext, stamp, rand } = o

  if (settings.imageStorage === 'unified') {
    const absPath = join(settings.imageDir, `${docStem(docPath)}-${stamp}-${rand}.${ext}`)
    return { absPath, refPath: absPath.replace(/\\/g, '/') }
  }

  const subdir = settings.imageSubdir || 'assets'
  return {
    absPath: join(dirname(docPath), subdir, `image-${stamp}-${rand}.${ext}`),
    refPath: buildImageRelPath(ext, stamp, rand, subdir)
  }
}
