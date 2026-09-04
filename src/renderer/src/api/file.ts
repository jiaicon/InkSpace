import { unwrap } from './util'

/** file 模块的渲染进程 API 封装 */
export const fileApi = {
  read: (path: string) => unwrap<string>(window.api.file.read(path)),
  write: (path: string, content: string) => unwrap<void>(window.api.file.write(path, content)),
  create: (suggestDir: string, content: string) =>
    unwrap<string | null>(window.api.file.create(suggestDir, content)),
  rename: (path: string, newName: string) => unwrap<string>(window.api.file.rename(path, newName)),
  remove: (path: string) => unwrap<void>(window.api.file.remove(path)),
  reveal: (path: string) => unwrap<void>(window.api.file.reveal(path)),
  pick: () => unwrap<string | null>(window.api.file.pick()),
  pendingOpen: () => unwrap<string | null>(window.api.file.pendingOpen()),
  onOpenExternal: (cb: (path: string) => void) => window.api.file.onOpenExternal(cb),
  getPathForFile: (file: File) => {
    // 主方案：preload 的 webUtils.getPathForFile（Electron 官方 API）
    const viaWebUtils = window.api.file.getPathForFile(file)
    if (viaWebUtils) return viaWebUtils
    // 兜底：sandbox:false 下 File.path 仍可用（Electron 31 已弃用、32 移除）
    return (file as unknown as { path?: string }).path ?? ''
  }
}
