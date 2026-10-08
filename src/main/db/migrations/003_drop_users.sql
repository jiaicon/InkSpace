-- 003_drop_users.sql —— 移除企业后台 demo 遗留的 users 表
-- 001_init.sql 曾建过该表，但应用改为 Markdown 编辑器后已无任何代码引用它。
-- 保留 001 原文以维持迁移历史的完整性（已应用的迁移不改写），
-- 用本迁移让「已跑过 001 的旧库」与「全新库」收敛到同一 schema。
DROP TABLE IF EXISTS users;
