import Database from "better-sqlite3";

/**
 * 打开（并配置）一个 SQLite 连接。
 * 纯 better-sqlite3，不依赖 Electron，因此可以在 Node 环境（vitest）里直接单测。
 * 默认路径由上层（main/index.ts）传入 userData 目录。
 */
export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  // WAL：读写并发更好；foreign_keys：启用外键约束
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}
