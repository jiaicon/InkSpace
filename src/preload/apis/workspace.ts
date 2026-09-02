import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** workspace 模块的 preload api */
export const workspaceApi = {
  pick: () => ipcRenderer.invoke(IPC.workspacePick),
  last: () => ipcRenderer.invoke(IPC.workspaceLast),
  tree: (root: string) => ipcRenderer.invoke(IPC.workspaceTree, root),
  recentList: () => ipcRenderer.invoke(IPC.recentList),
  recentAdd: (path: string, title: string) => ipcRenderer.invoke(IPC.recentAdd, path, title),
  recentRemove: (path: string) => ipcRenderer.invoke(IPC.recentRemove, path)
}
