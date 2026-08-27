import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** system 模块的 preload api */
export const systemApi = {
  getInfo: () => ipcRenderer.invoke(IPC.systemInfo)
}
