import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** themes 模块的 preload api（Markdown 主题） */
export const themesApi = {
  list: () => ipcRenderer.invoke(IPC.themesList),
  getCss: (id: string) => ipcRenderer.invoke(IPC.themesGetCss, id),
  import: () => ipcRenderer.invoke(IPC.themesImport),
  export: (id: string) => ipcRenderer.invoke(IPC.themesExport, id),
  reveal: () => ipcRenderer.invoke(IPC.themesReveal)
}
