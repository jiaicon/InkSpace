import type Database from 'better-sqlite3'
import { registerSystemIpc } from '../modules/system'
import { registerWorkspaceIpc } from '../modules/workspace'
import { registerFileIpc } from '../modules/file'
import { registerExportIpc } from '../modules/export'
import { registerSettingsIpc } from '../modules/settings'
import { registerThemesIpc } from '../modules/themes'
import { registerWindowIpc, type WindowIpcDeps } from '../modules/window'

/**
 * 汇总注册所有模块的 IPC handler。
 * 新增一个领域模块：只需在这里（以及 preload/index.ts）各加一行，main/index.ts 不动。
 * 例外是 window 模块 —— 窗口的创建归 app 生命周期（main/index.ts），所以由它把创建函数注入进来。
 */
export function registerIpc(db: Database.Database, windowDeps: WindowIpcDeps): void {
  registerSystemIpc()
  registerWorkspaceIpc(db)
  // settings 先建好再注入 file / export：图片落盘位置、导出主题都由设置决定
  const settings = registerSettingsIpc(db)
  const themes = registerThemesIpc()
  registerFileIpc(settings)
  registerExportIpc(settings, themes)
  registerWindowIpc(windowDeps)
}
