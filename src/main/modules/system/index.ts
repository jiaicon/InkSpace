import { app } from 'electron'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import type { SystemInfo } from '@shared/types'

/** 注册 system 模块的 IPC handler（无需数据库的模块示例） */
export function registerSystemIpc(): void {
  handle(IPC.systemInfo, (): SystemInfo => ({
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }))
}
