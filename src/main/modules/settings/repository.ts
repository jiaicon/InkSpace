import type Database from 'better-sqlite3'

// settings KV 表的唯一 SQL owner：其它模块需要读写设置时经由这里，避免同一张表散落多处 SQL
const SQL = {
  get: `SELECT value FROM settings WHERE key = ?`,
  getAll: `SELECT key, value FROM settings`,
  set: `INSERT INTO settings (key, value) VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`
}

export interface SettingsRepository {
  get(key: string): string | undefined
  getAll(): Record<string, string>
  set(key: string, value: string): void
}

/** 数据访问层：settings KV，不含业务规则 */
export function createSettingsRepository(db: Database.Database): SettingsRepository {
  return {
    get(key) {
      const row = db.prepare(SQL.get).get(key) as { value: string } | undefined
      return row?.value
    },
    getAll() {
      const rows = db.prepare(SQL.getAll).all() as { key: string; value: string }[]
      return Object.fromEntries(rows.map((r) => [r.key, r.value]))
    },
    set(key, value) {
      db.prepare(SQL.set).run({ key, value })
    }
  }
}
