import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { openDatabase } from './db/database'
import { migrate } from './db/migrate'
import { registerIpc } from './ipc/register'

// 应用显示名：中文「墨境」；英文名 InkSpace 用于打包（exe/安装器/productName）
app.setName('墨境')

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

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // 组合根（composition root）：这里才接触 Electron，把 db 注入到下层
  const db = openDatabase(join(app.getPath('userData'), 'app.db'))
  migrate(db)
  registerIpc(db)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
