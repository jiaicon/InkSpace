import type Database from 'better-sqlite3'
import type { RecentFile } from '@shared/types'

// —— SQL 位置（DML） ——
const SQL = {
  getSetting: `SELECT value FROM settings WHERE key = ?`,
  setSetting: `INSERT INTO settings (key, value) VALUES (@key, @value)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  listRecent: `SELECT path, title, last_opened_at AS lastOpenedAt
               FROM recent_files ORDER BY last_opened_at DESC`,
  upsertRecent: `INSERT INTO recent_files (path, title, last_opened_at)
                 VALUES (@path, @title, @lastOpenedAt)
                 ON CONFLICT(path) DO UPDATE
                 SET title = excluded.title, last_opened_at = excluded.last_opened_at`,
  deleteRecent: `DELETE FROM recent_files WHERE path = ?`
}

/** 数据访问层：settings KV + recent_files，不含业务规则 */
export function createWorkspaceRepository(db: Database.Database) {
  return {
    getSetting(key: string): string | undefined {
      const row = db.prepare(SQL.getSetting).get(key) as { value: string } | undefined
      return row?.value
    },
    setSetting(key: string, value: string): void {
      db.prepare(SQL.setSetting).run({ key, value })
    },
    listRecent(): RecentFile[] {
      return db.prepare(SQL.listRecent).all() as RecentFile[]
    },
    upsertRecent(path: string, title: string): void {
      db.prepare(SQL.upsertRecent).run({ path, title, lastOpenedAt: Date.now() })
    },
    deleteRecent(path: string): void {
      db.prepare(SQL.deleteRecent).run(path)
    }
  }
}
