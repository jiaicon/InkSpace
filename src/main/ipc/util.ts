import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types'

/**
 * 统一包裹 IPC handler：主进程永不向渲染进程抛异常，而是返回 IpcResult。
 * 每个模块注册 handler 时复用这个 helper，避免重复 try/catch。
 */
export function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (_event, ...args: unknown[]): IpcResult<unknown> => {
    try {
      return { ok: true, data: fn(...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
