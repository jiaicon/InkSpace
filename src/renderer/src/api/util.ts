import type { IpcResult } from '@shared/types'

/** 解包 IpcResult：失败时抛出 Error，便于页面用 try/catch + message.error */
export async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error ?? '未知错误')
  return r.data as T
}
