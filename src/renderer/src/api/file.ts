import { unwrap } from './util'

/** file 模块的渲染进程 API 封装 */
export const fileApi = {
  read: (path: string) => unwrap<string>(window.api.file.read(path)),
  write: (path: string, content: string) => unwrap<void>(window.api.file.write(path, content)),
  create: (suggestDir: string, content: string) =>
    unwrap<string | null>(window.api.file.create(suggestDir, content)),
  rename: (path: string, newName: string) => unwrap<string>(window.api.file.rename(path, newName)),
  remove: (path: string) => unwrap<void>(window.api.file.remove(path)),
  reveal: (path: string) => unwrap<void>(window.api.file.reveal(path))
}
