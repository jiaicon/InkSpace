import { dialog, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createFileService } from './service'

/** 注册 file 模块的 IPC handler（另存对话框、读写、重命名、删除、显示） */
export function registerFileIpc(): void {
  const svc = createFileService()

  handle(IPC.fileRead, (path) => svc.read(path as string))
  handle(IPC.fileWrite, (path, content) => svc.write(path as string, content as string))

  handle(IPC.fileCreate, async (suggestDir, content) => {
    const res = await dialog.showSaveDialog({
      title: '新建文件',
      defaultPath: join(suggestDir as string, '未命名.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (res.canceled || !res.filePath) return null
    await svc.write(res.filePath, content as string)
    return res.filePath
  })

  handle(IPC.fileRename, (path, newName) => svc.rename(path as string, newName as string))

  handle(IPC.fileDelete, async (path) => {
    try {
      await shell.trashItem(path as string)
    } catch {
      await svc.remove(path as string)
    }
  })

  handle(IPC.fileReveal, (path) => shell.showItemInFolder(path as string))
}
