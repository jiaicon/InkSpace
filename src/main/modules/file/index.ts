import { dialog, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createFileService } from './service'
import { getPendingOpenPath } from './external'

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

  handle(IPC.filePick, async () => {
    const res = await dialog.showOpenDialog({
      title: '打开文件',
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
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

  // 外部打开：返回启动/唤起时待打开的 md 文件路径
  handle(IPC.filePendingOpen, () => getPendingOpenPath())
}
