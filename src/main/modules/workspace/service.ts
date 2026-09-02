import type Database from 'better-sqlite3'
import type { RecentFile } from '@shared/types'
import { createWorkspaceRepository } from './repository'

export interface WorkspaceService {
  getLastWorkspace(): string | null
  setLastWorkspace(path: string): void
  listRecent(): RecentFile[]
  addRecent(path: string, title: string): void
  removeRecent(path: string): void
}

/**
 * 工作区业务 service：不 import Electron，可用 ':memory:' 直接单测。
 * （readTree 在 Task 3 补入）
 */
export function createWorkspaceService(db: Database.Database): WorkspaceService {
  const repo = createWorkspaceRepository(db)
  return {
    getLastWorkspace: () => repo.getSetting('lastWorkspace') ?? null,
    setLastWorkspace: (path) => repo.setSetting('lastWorkspace', path),
    listRecent: () => repo.listRecent(),
    addRecent: (path, title) => repo.upsertRecent(path, title),
    removeRecent: (path) => repo.deleteRecent(path)
  }
}
