import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types'

/**
 * 统一包裹 IPC handler：主进程永不向渲染进程抛异常，而是返回 IpcResult。
 * 每个模块注册 handler 时复用这个 helper，避免重复 try/catch。
 */
export function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

/**
 * 同 handle，但把调用方渲染进程的 webContents id 一并交给 handler。
 * 需要区分「是哪个窗口在请求」时用（多窗口下把结果路由回正确的那个窗口）。
 */
export function handleWithSender(
  channel: string,
  fn: (senderId: number, ...args: unknown[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(event.sender.id, ...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
