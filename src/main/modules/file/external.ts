import { existsSync } from 'node:fs'

// 外部打开（右键 md「打开方式」）流程：主进程先记录待打开路径，
// 渲染进程启动后拉取（首启），或运行中收到 second-instance 推送。
let pendingOpenPath: string | null = null

// 多窗口：新建的窗口各自带一个初始文件，**按窗口隔离** ——
// 若共用上面那个全局槽，两个窗口会抢同一个文件。
const initialPathByWindow = new Map<number, string>()

export function setPendingOpenPath(path: string | null): void {
  pendingOpenPath = path
}

/** 新建窗口时记下它该打开的文件（键用 webContents.id） */
export function setInitialPathForWindow(webContentsId: number, path: string): void {
  initialPathByWindow.set(webContentsId, path)
}

/**
 * 取该窗口要打开的文件：优先它自己的初始文件（**取走即删**，避免重挂载时重复打开），
 * 否则回落到全局槽（首启的「打开方式」/ second-instance）。
 * 全局槽保持「不消费」语义，与改动前一致。
 */
export function takePendingOpenPath(webContentsId: number): string | null {
  const mine = initialPathByWindow.get(webContentsId)
  if (mine !== undefined) {
    initialPathByWindow.delete(webContentsId)
    return mine
  }
  return pendingOpenPath
}

/** 窗口关掉时清掉它的记录，别让这张表随开窗次数一直涨 */
export function forgetWindow(webContentsId: number): void {
  initialPathByWindow.delete(webContentsId)
}

/** 从启动参数里解析出要打开的 md 文件路径（过滤掉 exe 自身与各种开关） */
export function extractOpenPath(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue
    const lower = arg.toLowerCase()
    if ((lower.endsWith('.md') || lower.endsWith('.markdown')) && existsSync(arg)) {
      return arg
    }
  }
  return null
}
