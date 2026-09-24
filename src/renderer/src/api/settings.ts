import type { AppSettings } from '@shared/types'
import { unwrap } from './util'

/** settings 模块的渲染进程 API 封装；set 返回更新后的完整设置 */
export const settingsApi = {
  get: () => unwrap<AppSettings>(window.api.settings.get()),
  set: (key: keyof AppSettings, value: string) =>
    unwrap<AppSettings>(window.api.settings.set(key, value)),
  chooseImageDir: (current: string) =>
    unwrap<string | null>(window.api.settings.chooseImageDir(current))
}
