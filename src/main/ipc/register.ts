import type Database from 'better-sqlite3'
import { registerUserIpc } from '../modules/user'
import { registerSystemIpc } from '../modules/system'

/**
 * 汇总注册所有模块的 IPC handler。
 * 新增一个模块：只需在这里（以及 preload/index.ts）各加一行，main/index.ts 不动。
 */
export function registerIpc(db: Database.Database): void {
  registerUserIpc(db)
  registerSystemIpc()
}
