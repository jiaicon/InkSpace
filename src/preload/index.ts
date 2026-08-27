import { contextBridge } from 'electron'
import { userApi } from './apis/user'
import { systemApi } from './apis/system'

// 聚合所有模块的 api，一次性通过 contextBridge 暴露为 window.api。
// 新增模块：在这里加一个字段即可。
const api = {
  user: userApi,
  system: systemApi
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
