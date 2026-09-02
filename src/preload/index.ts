import { contextBridge } from 'electron'
import { userApi } from './apis/user'
import { systemApi } from './apis/system'
import { workspaceApi } from './apis/workspace'
import { fileApi } from './apis/file'

// 聚合所有模块的 api，一次性通过 contextBridge 暴露为 window.api。
const api = {
  user: userApi,
  system: systemApi,
  workspace: workspaceApi,
  file: fileApi
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
