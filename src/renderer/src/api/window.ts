import { unwrap } from './util'

/** window 模块的渲染进程 API 封装（多窗口） */
export const windowApi = {
  /** 把该文件单独开到一个新窗口；若它已在别的窗口打开，主进程会聚焦那个窗口而不是开第二个 */
  openWithPath: (path: string) =>
    unwrap<{ focusedExisting: boolean }>(window.api.window.openWithPath(path)),
  /** 上报本窗口当前打开的文件（主进程用它避免同一文件被两个窗口同时编辑） */
  reportOpenFiles: (paths: string[]) => unwrap<void>(window.api.window.reportOpenFiles(paths))
}
