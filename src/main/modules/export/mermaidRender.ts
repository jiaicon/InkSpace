import { app, BrowserWindow } from 'electron'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

/**
 * 把 mermaid 源码渲染成 SVG。
 *
 * 主进程没有 DOM，而 mermaid 必须有 DOM 才能渲染，所以在隐藏窗口里跑官方 UMD 包。
 * 窗口与临时页面只建一次并复用（渲染一个 5MB 的包不便宜），退出时统一清理。
 *
 * UMD 包的位置与打包配置绑定：electron-builder 里只保留了
 * `node_modules/mermaid/dist/mermaid.min.js`，其余 117MB（源映射、ESM 分包、未压缩版）都排除了。
 */

let win: BrowserWindow | null = null
let ready: Promise<BrowserWindow> | null = null
let tempDir: string | null = null
let seq = 0

async function createRendererWindow(): Promise<BrowserWindow> {
  const mermaidFile = join(app.getAppPath(), 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
  tempDir = await mkdtemp(join(tmpdir(), 'ms-mermaid-'))
  const page = join(tempDir, 'render.html')
  await writeFile(
    page,
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>` +
      `<script src="${pathToFileURL(mermaidFile).href}"></script></body></html>`,
    'utf8'
  )

  const created = new BrowserWindow({
    show: false,
    // mermaid 需要 JS；沙箱开着即可，它只用页面内的能力
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  await created.loadFile(page)

  // 5MB 的包解析需要一点时间，确认挂上了再返回
  for (let i = 0; i < 20; i++) {
    const ok = await created.webContents.executeJavaScript('typeof window.mermaid !== "undefined"')
    if (ok) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return created
}

async function ensureRenderer(): Promise<BrowserWindow> {
  if (win && !win.isDestroyed()) return win
  if (!ready) {
    ready = createRendererWindow().then((created) => {
      win = created
      return created
    })
  }
  return ready
}

/** 渲染一段 mermaid 源码；失败时抛出（由调用方降级处理） */
export async function renderMermaidSvg(code: string): Promise<string> {
  const target = await ensureRenderer()
  const id = `ms-export-mermaid-${++seq}`
  // 代码来自用户文档：用 JSON.stringify 安全地嵌进表达式，避免注入
  const svg = await target.webContents.executeJavaScript(
    `window.mermaid.render(${JSON.stringify(id)}, ${JSON.stringify(code)}).then((r) => r.svg)`
  )
  return String(svg)
}

/** 退出时清理隐藏窗口与临时目录 */
app.once('will-quit', () => {
  if (win && !win.isDestroyed()) win.destroy()
  win = null
  if (tempDir) {
    void rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})
