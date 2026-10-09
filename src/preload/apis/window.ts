import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** window 模块的 preload api（多窗口） */
export const windowApi = {
  /** 窗口启动时拉取自己的配置（初始文件 + 是否「只有编辑器」的窗口） */
  bootstrap: () => ipcRenderer.invoke(IPC.windowBootstrap),
  /** 把该文档**移**到新窗口；本窗口的 tab 由调用方负责关掉 */
  moveToNewWindow: (path: string) => ipcRenderer.invoke(IPC.windowMoveToNewWindow, path),
  /** 打开前询问该文件是否已开在别的窗口（是则那个窗口会被拿到前面） */
  claimFile: (path: string) => ipcRenderer.invoke(IPC.windowClaimFile, path),
  /** 上报本窗口当前打开的文件，供主进程做「一个文件只在一个窗口」的守卫 */
  reportOpenFiles: (paths: string[]) => ipcRenderer.invoke(IPC.windowReportOpenFiles, paths)
}
