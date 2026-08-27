import type Database from 'better-sqlite3'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createUserService } from './service'
import type { UserInput } from '@shared/types'

/** 注册 user 模块的 IPC handler（由 register.ts 统一调用） */
export function registerUserIpc(db: Database.Database): void {
  const svc = createUserService(db)

  handle(IPC.userList, () => svc.list())
  handle(IPC.userCreate, (input) => svc.create(input as UserInput))
  handle(IPC.userUpdate, (id, input) => svc.update(id as number, input as UserInput))
  handle(IPC.userDelete, (id) => svc.remove(id as number))
}
