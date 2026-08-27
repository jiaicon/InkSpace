import type Database from 'better-sqlite3'
import type { User, UserInput } from '@shared/types'

// —— SQL 位置（DML）：所有查询集中在本文件顶部，命名清晰、便于 review 与复用 ——
const SQL = {
  list: `SELECT id, username, name, email, role, status, created_at AS createdAt
         FROM users ORDER BY id DESC`,
  getById: `SELECT id, username, name, email, role, status, created_at AS createdAt
            FROM users WHERE id = ?`,
  create: `INSERT INTO users (username, name, email, role, status)
           VALUES (@username, @name, @email, @role, @status)`,
  update: `UPDATE users
           SET username = @username, name = @name, email = @email,
               role = @role, status = @status
           WHERE id = @id`,
  remove: `DELETE FROM users WHERE id = ?`
}

/** 数据访问层（DAO）：只做 SQL 与数据映射，不含业务规则 */
export function createUserRepository(db: Database.Database) {
  return {
    list(): User[] {
      return db.prepare(SQL.list).all() as User[]
    },
    get(id: number): User | undefined {
      return db.prepare(SQL.getById).get(id) as User | undefined
    },
    create(input: UserInput): number {
      const info = db.prepare(SQL.create).run(input)
      return Number(info.lastInsertRowid)
    },
    update(id: number, input: UserInput): boolean {
      return db.prepare(SQL.update).run({ ...input, id }).changes > 0
    },
    remove(id: number): boolean {
      return db.prepare(SQL.remove).run(id).changes > 0
    }
  }
}
