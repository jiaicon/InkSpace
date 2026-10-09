import { unwrap } from './util'

/** window 模块的渲染进程 API 封装（多窗口） */
export const windowApi = {
  /** 启动配置：初始文件 + 是否「只有编辑器」的窗口（分离窗口无左侧文件区） */
  bootstrap: () =>
    unwrap<{ initialPath: string | null; editorOnly: boolean }>(window.api.window.bootstrap()),
  /** 把该文档移到新窗口；**调用方负责关掉本窗口的 tab**（并且先 flush 未落盘的编辑） */
  moveToNewWindow: (path: string) =>
    unwrap<{ moved: boolean; focusedExisting: boolean }>(window.api.window.moveToNewWindow(path)),
  /** 打开前询问：该文件是否已开在别的窗口（是则那个窗口被拿到前面，本窗口不应再开） */
  claimFile: (path: string) =>
    unwrap<{ claimedElsewhere: boolean }>(window.api.window.claimFile(path)),
  /** 上报本窗口当前打开的文件（主进程用它维护「一个文件只在一个窗口」的守卫） */
  reportOpenFiles: (paths: string[]) => unwrap<void>(window.api.window.reportOpenFiles(paths))
}
