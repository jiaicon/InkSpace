import type { BrowserWindow } from 'electron'
import { forgetWindow } from '../file/external'

/**
 * 文档窗口登记表：webContents.id → 窗口。
 *
 * 为什么需要它：`BrowserWindow.getAllWindows()` 里混着**非文档窗口** ——
 * mermaid 的复用隐藏窗口、导出 PDF 的 `show:false` 窗口都在里面，
 * 拿它来猜「哪个是主界面」迟早出错。要认文档窗口就只认这张表。
 */
const registry = new Map<number, BrowserWindow>()

/** 每个窗口当前打开的文件集合（渲染进程上报）—— 「同一文件别开两个窗口」守卫的依据 */
const openFiles = new Map<number, Set<string>>()

/** 「只有编辑器、没有左侧文件区」的窗口（分离出去的窗口） */
const editorOnlyIds = new Set<number>()

/** Windows 下路径大小写不敏感，比较前统一 */
function normalize(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

export function registerDocumentWindow(win: BrowserWindow): void {
  const id = win.webContents.id
  registry.set(id, win)
  win.on('closed', () => {
    registry.delete(id)
    openFiles.delete(id)
    editorOnlyIds.delete(id)
    forgetWindow(id)
  })
}

/** 标记该窗口为「只有编辑器」（分离窗口）；渲染进程启动时拉取并据此少渲染左侧栏 */
export function markEditorOnly(webContentsId: number): void {
  editorOnlyIds.add(webContentsId)
}

export function isEditorOnly(webContentsId: number): boolean {
  return editorOnlyIds.has(webContentsId)
}

export function documentWindowCount(): number {
  return registry.size
}

/** 登记在册的文档窗口（顺序 = 创建顺序） */
export function documentWindows(): BrowserWindow[] {
  return [...registry.values()]
}

/** 找到正在显示该文件、且不是 exceptId 那个窗口的窗口 */
export function findOtherWindowShowing(path: string, exceptId: number): BrowserWindow | null {
  const target = normalize(path)
  for (const [id, win] of registry) {
    if (id === exceptId) continue
    if (openFiles.get(id)?.has(target)) return win
  }
  return null
}

/** 渲染进程上报它当前打开的文件（tab 集合变化时） */
export function reportOpenFiles(webContentsId: number, paths: readonly string[]): void {
  if (!registry.has(webContentsId)) return
  openFiles.set(webContentsId, new Set(paths.map(normalize)))
}
