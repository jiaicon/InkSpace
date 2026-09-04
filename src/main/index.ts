import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { openDatabase } from './db/database'
import { migrate } from './db/migrate'
import { registerIpc } from './ipc/register'
import { extractOpenPath, setPendingOpenPath } from './modules/file/external'

// 应用显示名：中文「墨境」；英文名 InkSpace 用于打包（exe/安装器/productName）
app.setName('墨境')

// 单实例：外部「打开方式」再次唤起时，把文件交给已运行实例，而不是开第二个窗口
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  function createWindow(): void {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: '墨境',
      show: false,
      // 开发态窗口图标；打包后 Windows 由 exe 内嵌图标接管（electron-builder 识别 build/icon.png）
      ...(!app.isPackaged ? { icon: join(__dirname, '../../build/icon.png') } : {}),
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    win.on('ready-to-show', () => win.show())

    // 开发态：把渲染进程 console 转发到主进程终端，方便排查渲染层报错
    if (!app.isPackaged) {
      win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
        console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
      })
    }

    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 开发态自动打开 DevTools，便于直接查看控制台
    if (!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' })
  }

  // 已运行实例收到第二个实例（再次右键「打开方式」）时，打开其中的文件
  app.on('second-instance', (_event, argv) => {
    const path = extractOpenPath(argv)
    if (!path) return
    setPendingOpenPath(path)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      win.webContents.send(IPC.fileOpenExternal, path)
    }
  })

  app.whenReady().then(() => {
    // 组合根（composition root）：这里才接触 Electron，把 db 注入到下层
    const db = openDatabase(join(app.getPath('userData'), 'app.db'))
    migrate(db)
    registerIpc(db)

    // 启动参数里若带了 md 文件（右键「打开方式」首启），记录待打开路径，渲染进程启动后拉取
    setPendingOpenPath(extractOpenPath(process.argv))

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
