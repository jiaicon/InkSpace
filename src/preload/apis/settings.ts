import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** settings 模块的 preload api */
export const settingsApi = {
  get: () => ipcRenderer.invoke(IPC.settingsGet),
  set: (key: string, value: string) => ipcRenderer.invoke(IPC.settingsSet, key, value),
  chooseImageDir: (current: string) => ipcRenderer.invoke(IPC.settingsChooseImageDir, current)
}
