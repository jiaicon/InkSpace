import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

// 设置变更广播：在 preload 顶层注册一次，避免 contextBridge 无法返回退订函数的限制
//（与 file 的 onOpenExternal 同一套做法）
let changedHandler: (() => void) | null = null
ipcRenderer.on(IPC.settingsChanged, () => {
  changedHandler?.()
})

/** settings 模块的 preload api */
export const settingsApi = {
  get: () => ipcRenderer.invoke(IPC.settingsGet),
  set: (key: string, value: string) => ipcRenderer.invoke(IPC.settingsSet, key, value),
  chooseImageDir: (current: string) => ipcRenderer.invoke(IPC.settingsChooseImageDir, current),
  /** 别的窗口改了设置时回调；本窗口据此重读设置 */
  onChanged: (cb: () => void) => {
    changedHandler = cb
  }
}
