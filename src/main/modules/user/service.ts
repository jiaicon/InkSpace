import type Database from 'better-sqlite3'
import { createUserRepository } from './repository'
import type { User, UserInput } from '@shared/types'

export interface UserService {
  list(): User[]
  create(input: UserInput): User
  update(id: number, input: UserInput): boolean
  remove(id: number): boolean
}

/**
 * 业务 service：通过依赖注入拿到 db，不 import Electron，
 * 因此可以用 ':memory:' 数据库直接单测。
 */
export function createUserService(db: Database.Database): UserService {
  const repo = createUserRepository(db)
  return {
    list: () => repo.list(),
    create: (input) => {
      const id = repo.create(input)
      return repo.get(id)!
    },
    update: (id, input) => repo.update(id, input),
    remove: (id) => repo.remove(id)
  }
}
