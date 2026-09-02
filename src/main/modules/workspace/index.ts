import { dialog } from 'electron'
import type Database from 'better-sqlite3'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createWorkspaceService } from './service'

/** 注册 workspace 模块的 IPC handler（打开文件夹对话框、树、recent） */
export function registerWorkspaceIpc(db: Database.Database): void {
  const svc = createWorkspaceService(db)

  handle(IPC.workspacePick, async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    svc.setLastWorkspace(path)
    return { path, tree: await svc.readTree(path) }
  })

  handle(IPC.workspaceLast, () => svc.getLastWorkspace())
  handle(IPC.workspaceTree, (root) => svc.readTree(root as string))
  handle(IPC.recentList, () => svc.listRecent())
  handle(IPC.recentAdd, (path, title) => svc.addRecent(path as string, title as string))
  handle(IPC.recentRemove, (path) => svc.removeRecent(path as string))
}
