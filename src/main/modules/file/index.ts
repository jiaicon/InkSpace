import { dialog, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createFileService } from './service'
import { getPendingOpenPath } from './external'
import { formatStamp, isAllowedImageExt, planImagePlacement } from './assets'
import type { SettingsService } from '../settings/service'

/** 注册 file 模块的 IPC handler（另存对话框、读写、重命名、删除、显示、图片落盘） */
export function registerFileIpc(settings: SettingsService): void {
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

  // 粘贴/拖入的图片：按设置规划落点后写盘，返回写进 markdown 的路径
  handle(IPC.fileSaveImage, async (docPath, data, ext) => {
    const clean = String(ext).toLowerCase().replace(/^\./, '')
    if (!isAllowedImageExt(clean)) throw new Error(`不支持的图片格式：${ext}`)
    // 时间戳 + 随机后缀：同一秒内连续粘贴也不会互相覆盖
    const plan = planImagePlacement({
      docPath: docPath as string,
      settings: settings.getAll(),
      ext: clean,
      stamp: formatStamp(new Date()),
      rand: randomBytes(2).toString('hex')
    })
    await svc.saveImage(plan.absPath, data as Uint8Array)
    return plan.refPath
  })

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
