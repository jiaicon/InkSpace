/** 从路径取文件名并去掉 .md 扩展名 */
export function titleFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.md$/i, '')
}

/** 取父目录（兼容 / 与 \）；无父目录返回空串 */
export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx < 0 ? '' : path.slice(0, idx)
}
