import type Database from 'better-sqlite3'
import type { RecentFile } from '@shared/types'
import { createSettingsRepository } from '../settings/repository'

// —— SQL 位置（DML） ——
const SQL = {
  listRecent: `SELECT path, title, last_opened_at AS lastOpenedAt
               FROM recent_files ORDER BY last_opened_at DESC`,
  upsertRecent: `INSERT INTO recent_files (path, title, last_opened_at)
                 VALUES (@path, @title, @lastOpenedAt)
                 ON CONFLICT(path) DO UPDATE
                 SET title = excluded.title, last_opened_at = excluded.last_opened_at`,
  deleteRecent: `DELETE FROM recent_files WHERE path = ?`,
  clearRecent: `DELETE FROM recent_files`
}

/**
 * 数据访问层：recent_files。
 * settings KV 的 SQL 归 settings 模块所有（settings 表是共享 KV），这里只做转发，
 * 保持工作区自身的读写接口不变。
 */
export function createWorkspaceRepository(db: Database.Database) {
  const settings = createSettingsRepository(db)
  return {
    getSetting(key: string): string | undefined {
      return settings.get(key)
    },
    setSetting(key: string, value: string): void {
      settings.set(key, value)
    },
    listRecent(): RecentFile[] {
      return db.prepare(SQL.listRecent).all() as RecentFile[]
    },
    upsertRecent(path: string, title: string): void {
      db.prepare(SQL.upsertRecent).run({ path, title, lastOpenedAt: Date.now() })
    },
    deleteRecent(path: string): void {
      db.prepare(SQL.deleteRecent).run(path)
    },
    clearRecent(): void {
      db.prepare(SQL.clearRecent).run()
    }
  }
}
