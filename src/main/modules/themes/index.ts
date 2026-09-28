import { app, dialog, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createThemeStore } from './store'

/** 主题目录：<userData>/themes（userData 已是 ASCII 路径，见 main/index.ts） */
export function themesDir(): string {
  return join(app.getPath('userData'), 'themes')
}

/** 组装主题存储（供导出等模块复用，不注册 IPC） */
export function createThemes() {
  return createThemeStore(themesDir())
}

/** 注册 themes 模块的 IPC，并返回 store 供导出侧取主题 CSS */
export function registerThemesIpc() {
  const store = createThemes()

  handle(IPC.themesList, () => store.list())
  handle(IPC.themesGetCss, (id) => store.getCss(id as string))

  handle(IPC.themesImport, async () => {
    const res = await dialog.showOpenDialog({
      title: '导入 Markdown 主题',
      filters: [{ name: 'CSS 样式表', extensions: ['css'] }],
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return store.importFromFile(res.filePaths[0])
  })

  handle(IPC.themesExport, async (id) => {
    const theme = (await store.list()).find((t) => t.id === id)
    const res = await dialog.showSaveDialog({
      title: '导出 Markdown 主题',
      defaultPath: `${theme?.name ?? 'theme'}.css`,
      filters: [{ name: 'CSS 样式表', extensions: ['css'] }]
    })
    if (res.canceled || !res.filePath) return null
    await store.exportToFile(id as string, res.filePath)
    return res.filePath
  })

  handle(IPC.themesReveal, async () => {
    await store.ensureDir()
    await shell.openPath(store.dir())
  })

  return store
}

export type ThemeStoreHandle = ReturnType<typeof createThemes>
