import { app, dialog } from 'electron'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createSettingsRepository } from './repository'
import { createSettingsService, type SettingsService } from './service'

/** 统一图片目录的默认值：系统图片目录下的 InkSpace，首次插入时自动创建 */
export function defaultImageDir(): string {
  return join(app.getPath('pictures'), 'InkSpace')
}

/** 组装 settings service（供其它模块复用，不注册 IPC） */
export function createSettings(db: Database.Database): SettingsService {
  return createSettingsService(createSettingsRepository(db), defaultImageDir())
}

/**
 * 注册 settings 模块的 IPC，并返回 service 供 file 模块决定图片落盘位置。
 * 两个 handler 都回传最新设置，渲染端拿到即可直接更新界面，省一次往返。
 */
export function registerSettingsIpc(db: Database.Database): SettingsService {
  const svc = createSettings(db)

  handle(IPC.settingsGet, () => svc.getAll())
  handle(IPC.settingsSet, (key, value) => {
    svc.set(key as string, value as string)
    return svc.getAll()
  })

  handle(IPC.settingsChooseImageDir, async (current) => {
    const res = await dialog.showOpenDialog({
      title: '选择图片存放目录',
      defaultPath: (current as string) || defaultImageDir(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  return svc
}
