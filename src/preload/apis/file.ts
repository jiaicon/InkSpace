import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** file 模块的 preload api */
export const fileApi = {
  read: (path: string) => ipcRenderer.invoke(IPC.fileRead, path),
  write: (path: string, content: string) => ipcRenderer.invoke(IPC.fileWrite, path, content),
  create: (suggestDir: string, content: string) => ipcRenderer.invoke(IPC.fileCreate, suggestDir, content),
  rename: (path: string, newName: string) => ipcRenderer.invoke(IPC.fileRename, path, newName),
  remove: (path: string) => ipcRenderer.invoke(IPC.fileDelete, path),
  reveal: (path: string) => ipcRenderer.invoke(IPC.fileReveal, path)
}
