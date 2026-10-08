import type Database from 'better-sqlite3'
import { registerSystemIpc } from '../modules/system'
import { registerWorkspaceIpc } from '../modules/workspace'
import { registerFileIpc } from '../modules/file'
import { registerExportIpc } from '../modules/export'
import { registerSettingsIpc } from '../modules/settings'
import { registerThemesIpc } from '../modules/themes'

/**
 * 汇总注册所有模块的 IPC handler。
 * 新增一个模块：只需在这里（以及 preload/index.ts）各加一行，main/index.ts 不动。
 */
export function registerIpc(db: Database.Database): void {
  registerSystemIpc()
  registerWorkspaceIpc(db)
  // settings 先建好再注入 file / export：图片落盘位置、导出主题都由设置决定
  const settings = registerSettingsIpc(db)
  const themes = registerThemesIpc()
  registerFileIpc(settings)
  registerExportIpc(settings, themes)
}
