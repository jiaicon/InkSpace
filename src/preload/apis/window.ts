import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** window 模块的 preload api（多窗口） */
export const windowApi = {
  /** 把该文件单独开到一个新窗口；若它已在别的窗口打开，主进程会聚焦那个窗口而不是开第二个 */
  openWithPath: (path: string) => ipcRenderer.invoke(IPC.windowOpenWithPath, path),
  /** 上报本窗口当前打开的文件，供主进程做「同一文件不开两个窗口」的守卫 */
  reportOpenFiles: (paths: string[]) => ipcRenderer.invoke(IPC.windowReportOpenFiles, paths)
}
