import type Database from 'better-sqlite3'
import initSql from './migrations/001_init.sql?raw'
import initFilesSql from './migrations/002_files.sql?raw'

// 迁移清单：按数组顺序执行，文件名记入 _migrations 表保证幂等
const migrations: { name: string; sql: string }[] = [
  { name: '001_init.sql', sql: initSql },
  { name: '002_files.sql', sql: initFilesSql }
]

/** 执行尚未应用过的迁移 */
export function migrate(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )`)

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name)
  )

  const applyOne = db.transaction((m: { name: string; sql: string }) => {
    db.exec(m.sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(m.name)
  })

  for (const m of migrations) {
    if (!applied.has(m.name)) applyOne(m)
  }
}
