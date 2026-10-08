import { contextBridge } from 'electron'
import { systemApi } from './apis/system'
import { workspaceApi } from './apis/workspace'
import { fileApi } from './apis/file'
import { exportApi } from './apis/export'
import { settingsApi } from './apis/settings'
import { themesApi } from './apis/themes'

// 聚合所有模块的 api，一次性通过 contextBridge 暴露为 window.api。
const api = {
  system: systemApi,
  workspace: workspaceApi,
  file: fileApi,
  export: exportApi,
  settings: settingsApi,
  themes: themesApi
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
