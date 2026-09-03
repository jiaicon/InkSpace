import type Database from 'better-sqlite3'
import type { FileTreeNode, RecentFile } from '@shared/types'
import { createWorkspaceRepository } from './repository'
import { buildFileTree } from './tree'

export interface WorkspaceService {
  getLastWorkspace(): string | null
  setLastWorkspace(path: string): void
  readTree(root: string): Promise<FileTreeNode[]>
  listRecent(): RecentFile[]
  addRecent(path: string, title: string): void
  removeRecent(path: string): void
  clearRecent(): void
}

/**
 * 工作区业务 service：不 import Electron，可用 ':memory:' 直接单测。
 */
export function createWorkspaceService(db: Database.Database): WorkspaceService {
  const repo = createWorkspaceRepository(db)
  return {
    getLastWorkspace: () => repo.getSetting('lastWorkspace') ?? null,
    setLastWorkspace: (path) => repo.setSetting('lastWorkspace', path),
    readTree: (root) => buildFileTree(root),
    listRecent: () => repo.listRecent(),
    addRecent: (path, title) => repo.upsertRecent(path, title),
    removeRecent: (path) => repo.deleteRecent(path),
    clearRecent: () => repo.clearRecent()
  }
}
