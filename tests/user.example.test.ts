import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db/database'
import { migrate } from '../src/main/db/migrate'
import { createUserService } from '../src/main/modules/user/service'

// 证明「数据库 + 迁移 SQL + service」这条链在纯 Node 环境可跑（不依赖 Electron）
describe('user example (db + sql + service)', () => {
  it('creates and lists users', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const svc = createUserService(db)

    const created = svc.create({
      username: 'alice',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
      status: 1
    })

    expect(created.id).toBe(1)
    expect(svc.list()).toHaveLength(1)
    expect(svc.list()[0].username).toBe('alice')
  })

  it('rejects duplicate username via UNIQUE constraint', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const svc = createUserService(db)
    const input = { username: 'bob', name: 'Bob', email: 'b@x.com', role: 'user', status: 1 }
    svc.create(input)
    expect(() => svc.create(input)).toThrow()
  })
})
