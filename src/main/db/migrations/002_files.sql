-- 002_files.sql —— 文件层：工作区配置(KV) + 最近打开
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_files (
  path           TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  last_opened_at INTEGER NOT NULL
);
