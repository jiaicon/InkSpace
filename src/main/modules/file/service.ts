import { access, mkdir, readFile, rename as fsRename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface FileService {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  rename(path: string, newName: string): Promise<string>
  remove(path: string): Promise<void>
}

/** 文件读写 service：只用 node:fs/promises，不 import Electron，可用临时目录单测。 */
export function createFileService(): FileService {
  async function ensureWrite(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
  }

  return {
    read: (path) => readFile(path, 'utf-8'),
    write: ensureWrite,
    rename: async (path, newName) => {
      const target = join(dirname(path), newName)
      try {
        await access(target)
        throw new Error(`已存在同名文件：${newName}`)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
      await fsRename(path, target)
      return target
    },
    remove: async (path) => {
      await rm(path, { recursive: true, force: true })
    }
  }
}
