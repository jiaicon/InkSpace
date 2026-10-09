import type { AppSettings } from '@shared/types'
import { unwrap } from './util'

/** settings 模块的渲染进程 API 封装；set 返回更新后的完整设置 */
export const settingsApi = {
  get: () => unwrap<AppSettings>(window.api.settings.get()),
  set: (key: keyof AppSettings, value: string) =>
    unwrap<AppSettings>(window.api.settings.set(key, value)),
  chooseImageDir: (current: string) =>
    unwrap<string | null>(window.api.settings.chooseImageDir(current)),
  /** 别的窗口改了设置时回调（本窗口据此重读设置，保证主题等跨窗口一致） */
  onChanged: (cb: () => void) => window.api.settings.onChanged(cb)
}
