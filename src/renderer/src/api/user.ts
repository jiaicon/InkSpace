import type { UserInput } from '@shared/types'
import { unwrap } from './util'

// —— API 封装位置：页面只 import 本层，不直接触碰 window.api / IPC ——

export const userApi = {
  list: () => unwrap(window.api.user.list()),
  create: (input: UserInput) => unwrap(window.api.user.create(input)),
  update: (id: number, input: UserInput) => unwrap(window.api.user.update(id, input)),
  remove: (id: number) => unwrap(window.api.user.remove(id))
}
