-- 001_init.sql —— 建表 DDL（schema 变更一律走迁移，按文件名顺序只执行一次）
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  email      TEXT,
  role       TEXT    NOT NULL DEFAULT 'user',
  status     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
