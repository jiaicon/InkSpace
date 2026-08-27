import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { UserInput } from '@shared/types'

/** user 模块的 preload api（invoke 封装，只暴露给渲染进程的受限通道） */
export const userApi = {
  list: () => ipcRenderer.invoke(IPC.userList),
  create: (input: UserInput) => ipcRenderer.invoke(IPC.userCreate, input),
  update: (id: number, input: UserInput) => ipcRenderer.invoke(IPC.userUpdate, id, input),
  remove: (id: number) => ipcRenderer.invoke(IPC.userDelete, id)
}
