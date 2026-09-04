import { existsSync } from 'node:fs'

// 外部打开（右键 md「打开方式」）流程：主进程先记录待打开路径，
// 渲染进程启动后拉取（首启），或运行中收到 second-instance 推送。
let pendingOpenPath: string | null = null

export function setPendingOpenPath(path: string | null): void {
  pendingOpenPath = path
}

export function getPendingOpenPath(): string | null {
  return pendingOpenPath
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
