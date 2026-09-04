import { ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/ipc'

// 外部打开（右键 md「打开方式」）：主进程推送的文件路径回调。
// 在 preload 顶层注册一次，避免 contextBridge 无法返回退订函数的限制。
let openExternalHandler: ((path: string) => void) | null = null
ipcRenderer.on(IPC.fileOpenExternal, (_event, path: string) => {
  openExternalHandler?.(path)
})

/** file 模块的 preload api */
export const fileApi = {
  read: (path: string) => ipcRenderer.invoke(IPC.fileRead, path),
  write: (path: string, content: string) => ipcRenderer.invoke(IPC.fileWrite, path, content),
  create: (suggestDir: string, content: string) =>
    ipcRenderer.invoke(IPC.fileCreate, suggestDir, content),
  rename: (path: string, newName: string) => ipcRenderer.invoke(IPC.fileRename, path, newName),
  remove: (path: string) => ipcRenderer.invoke(IPC.fileDelete, path),
  reveal: (path: string) => ipcRenderer.invoke(IPC.fileReveal, path),
  pick: () => ipcRenderer.invoke(IPC.filePick),
  pendingOpen: () => ipcRenderer.invoke(IPC.filePendingOpen),
  onOpenExternal: (cb: (path: string) => void) => {
    openExternalHandler = cb
  },
  // 拖拽文件时，从 DOM File 对象取绝对路径（替代已废弃的 File.path）
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      // File 对象经过 contextBridge 序列化后可能不再是原生 File，避免抛错打断 drop
      return ''
    }
  }
}
