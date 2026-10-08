import { isImagePath } from './drop'

/** file:// 开头的本地文件 URL：取 pathname 并把 Windows 盘符前的斜杠去掉 */
function fromFileUrl(line: string): string | null {
  try {
    const url = new URL(line)
    const decoded = decodeURIComponent(url.pathname)
    // file:///C:/a.png → /C:/a.png → C:/a.png；POSIX 下 /home/a.png 保持原样
    return /^\/[a-zA-Z]:/.test(decoded) ? decoded.slice(1) : decoded
  } catch {
    return null
  }
}

/** 绝对路径判定：Windows 盘符（C:\ 或 C:/）、POSIX（/…）、UNC（\\server\…） */
function isAbsoluteLocalPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || /^[\\/]/.test(path)
}

/**
 * 从剪贴板文本里提取本地图片路径。
 *
 * 在资源管理器里「复制」一个文件再粘贴时，剪贴板给的是**路径文本**（text/plain 或
 * text/uri-list 里的 file:// URI），而不是 File 对象——只检查 clipboardData.files 会漏掉，
 * 结果把路径当普通文字粘进正文。这里把这类文本识别出来交给导入流程。
 *
 * 只认**绝对路径**：否则一句以 a.png 结尾的普通文字也会被当成路径，
 * 那样粘贴纯文本会被拦下来、反而把用户的内容弄丢。网络地址一律忽略；同一路径去重。
 */
export function extractImagePaths(text: string): string[] {
  const found: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (/^https?:/i.test(line)) continue
    const path = line.startsWith('file://') ? fromFileUrl(line) : line
    if (path && isAbsoluteLocalPath(path) && isImagePath(path)) found.push(path)
  }
  return [...new Set(found)]
}
